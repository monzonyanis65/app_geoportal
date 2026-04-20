const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const pool = require('./db');

// A generic endpoint to search using a RIF or other identifiers safely
app.get('/api/search', async (req, res) => {
    try {
        const queryStr = req.query.query;
        const layersParam = req.query.layers;

        if (!queryStr) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        const queryValue = `%${queryStr}%`;

        // Define which schemas and tables we want to search in (which correspond to WMS layers)
        let searchTables = [
            { schema: 'concordia', table: 'Concordia' },
            { schema: 'concordia', table: 'concordia' },
            { schema: 'pmm', table: 'Pmm' },
            { schema: 'pmm', table: 'pmm' },
            { schema: 'sjb', table: 'Sjb' },
            { schema: 'sjb', table: 'sjb' },
            { schema: 'ssb', table: 'ssb' },
            { schema: 'ssb', table: 'ssb_cerrados' },
            { schema: 'public', table: 'Sambil_Locales_pb' },
            { schema: 'public', table: 'Sambil_Locales_p1' }
        ];

        // Filter based on active layers if provided by the frontend
        if (layersParam) {
            const activeLayers = layersParam.split(',').map(l => l.toLowerCase());
            console.log('Front-end Active Layers:', activeLayers);
            
            searchTables = searchTables.filter(st => {
                const tableLower = st.table.toLowerCase();
                // Match if exact name, if starts with the name (e.g. pmm_etiquetas starts with pmm),
                // or if it's a known alias like ssb_cerrados
                return activeLayers.some(al => 
                    al === tableLower || 
                    al === `${tableLower}_etiquetas` ||
                    al.startsWith(tableLower) ||
                    (tableLower === 'ssb_cerrados' && al === 'ssb')
                );
            });
            
            console.log('Tables to search after filtering:', searchTables.map(st => st.table));
        }

        if (searchTables.length === 0) {
            console.log('No matching tables found for the active layers.');
            return res.json({ results: [] });
        }


        // Query all tables in parallel for faster performance
        const searchPromises = searchTables.map(async (st) => {
            const sch = st.schema;
            const table = st.table;

            try {
                const columnsQuery = `
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = $1 AND table_name = $2;
                `;
                const colsRes = await pool.query(columnsQuery, [sch, table]);
                if (colsRes.rows.length === 0) return []; // Skip if table doesn't exist

                const colsMap = {};
                colsRes.rows.forEach(r => {
                    colsMap[r.column_name.toLowerCase()] = r.column_name;
                });

                const searchFields = [];
                const rifCol = colsMap['rif_nro'] || colsMap['rif'];
                if (rifCol) searchFields.push(`"${rifCol}"`);
                if (colsMap['ci_nro']) searchFields.push(`"${colsMap['ci_nro']}"`);
                const razonCol = colsMap['razon social'] || colsMap['razon_social'];
                if (razonCol) searchFields.push(`"${razonCol}"`);
                if (colsMap['cod_cat']) searchFields.push(`"${colsMap['cod_cat']}"`);

                if (searchFields.length > 0) {
                    let geomSelect = "";
                    if (colsMap['geom']) {
                        geomSelect = `, ST_Y(ST_Transform(ST_Centroid(geom), 4326)) as lat, ST_X(ST_Transform(ST_Centroid(geom), 4326)) as lng`;
                    }

                    const whereClause = searchFields.map(f => `CAST(${f} AS TEXT) ILIKE $1`).join(' OR ');

                    let safeFieldsSelect = [];
                    if (razonCol) safeFieldsSelect.push(`"${razonCol}" as razon_social`);
                    const dirCol = colsMap['direccion'] || colsMap['dirección'] || colsMap['callejero'];
                    if (dirCol) safeFieldsSelect.push(`"${dirCol}" as direccion`);
                    if (colsMap['estatus']) safeFieldsSelect.push(`"${colsMap['estatus']}" as estatus`);

                    let selectStr = safeFieldsSelect.length > 0 ? safeFieldsSelect.join(', ') : "'Registro' as type";

                    const sql = `
                        SELECT 
                            ${selectStr}
                            ${geomSelect}
                        FROM "${sch}"."${table}"
                        WHERE ${whereClause}
                        LIMIT 10;
                    `;

                    const sqlRes = await pool.query(sql, [queryValue]);
                    return sqlRes.rows.map(r => ({
                        ...r,
                        schema: sch,
                        table: table
                    }));
                }
                return [];
            } catch (error) {
                console.error(`Error searching table ${sch}.${table}:`, error.message);
                return [];
            }
        });

        const resultsArrays = await Promise.all(searchPromises);
        const results = resultsArrays.flat();




        res.json({ results });

    } catch (err) {
        console.error('Error executing search query', err.stack);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// New endpoint to handle map clicks directly via PostGIS (Bypassing GeoServer GetFeatureInfo)
app.get('/api/click', async (req, res) => {
    try {
        const { lat, lng, layers } = req.query;
        if (!lat || !lng) return res.status(400).json({ error: 'Lat and Lng are required' });

        let searchTables = [
            { schema: 'concordia', table: 'Concordia' },
            { schema: 'pmm', table: 'pmm' },
            { schema: 'sjb', table: 'sjb' },
            { schema: 'ssb', table: 'ssb' },
            { schema: 'sjb', table: 'Sambil_Locales_pb' },
            { schema: 'sjb', table: 'Sambil_Locales_p1' },
            { schema: 'vialidad_manzanas', table: 'Man_sc' },
            { schema: 'vialidad_manzanas', table: 'Parroquias_sc' },
            { schema: 'vialidad_manzanas', table: 'Sectores_Sc' }
        ];

        if (layers) {
            const activeLayers = layers.split(',').map(l => l.toLowerCase().replace('geoportal:', ''));
            searchTables = searchTables.filter(st => {
                const tb = st.table.toLowerCase();
                return activeLayers.some(al => al.includes(tb));
            });
        }

        const clickPromises = searchTables.map(async (st) => {
            try {
                // Create a point in EPSG:4326 (lat/lng), transform to EPSG:32618 (local projection)
                // Intersect with the geometry column. Fallback SRID forcing to avoid projection errors.
                const sql = `
                    SELECT 
                        *, 
                        ST_AsGeoJSON(ST_Transform(ST_SetSRID(geom, 32618), 4326)) as geom_json
                    FROM "${st.schema}"."${st.table}"
                    WHERE ST_Intersects(
                        ST_SetSRID(geom, 32618), 
                        ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 32618)
                    )
                    LIMIT 1;
                `;
                const dbRes = await pool.query(sql, [parseFloat(lng), parseFloat(lat)]);
                
                if (dbRes.rows.length > 0) {
                    return dbRes.rows.map(r => {
                        const { geom, geom_json, ...props } = r;
                        return {
                            type: 'Feature',
                            geometry: geom_json ? JSON.parse(geom_json) : null,
                            properties: { ...props, schema: st.schema, table: st.table }
                        };
                    });
                }
                return [];
            } catch (err) {
                console.error(`Click failed on ${st.schema}.${st.table}:`, err.message);
                return [];
            }
        });

        const resultsArrays = await Promise.all(clickPromises);
        const features = resultsArrays.flat();

        res.json({ type: 'FeatureCollection', features });

    } catch (err) {
        console.error('Click error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Run server
app.listen(port, () => {
    console.log(`Backend geoportal server listening at http://localhost:${port}`);
});
