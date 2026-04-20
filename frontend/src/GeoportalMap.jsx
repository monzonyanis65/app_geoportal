import React, { useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, ZoomControl, useMap, LayersControl, useMapEvents, Marker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Menu, Layers, Map as MapIcon, Compass } from 'lucide-react';
import L from 'leaflet';

import logoAlcaldia from './imagenes/logo_alcaldia.png';
import logoSumat from './imagenes/logo_sumat.png';

// iconos de leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const { BaseLayer } = LayersControl;

const WMS_BASE_URL = import.meta.env.VITE_GEOSERVER_URL || 'http://localhost:8080/geoserver/geoportal/wms';
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const DEFAULT_CENTER = [7.768, -72.225]; // San Cristóbal
const DEFAULT_ZOOM = 13;
const SAN_CRISTOBAL_BOUNDS = [
    [7.70, -72.30], // Suroeste
    [7.85, -72.15]  // Noreste
];

const CAPAS_WMS = [
    { id: 'geoportal:concordia_etiquetas', name: 'Concordia (Comercios)', color: 'bg-red-500', hexColor: '#ef4444', defaultActive: false, labelField: 'razon_social', labelMaxScale: 2000, category: 'parroquia' },
    { id: 'geoportal:Man_sc', name: 'Manzanas', color: 'bg-blue-500', hexColor: '#3b82f6', defaultActive: false, labelField: 'id_manzana', labelMaxScale: 15000, category: 'base' },
    { id: 'geoportal:Parroquias_sc', name: 'Parroquias', color: 'bg-green-500', hexColor: '#22c55e', defaultActive: false, labelField: 'nombre', labelMaxScale: 100000, category: 'base' },
    { id: 'geoportal:Sectores_Sc', name: 'Sectores', color: 'bg-purple-500', hexColor: '#a855f7', defaultActive: false, labelField: 'sector', labelMaxScale: 40000, category: 'base' },
    { id: 'geoportal:pmm_etiquetas', name: 'Pedro Maria Morantes', color: 'bg-orange-500', hexColor: '#f97316', defaultActive: false, labelField: 'razon_social', labelMaxScale: 2000, category: 'parroquia' },
    { id: 'geoportal:sjb_etiquetas', name: 'San Juan Bautista', color: 'bg-cyan-500', hexColor: '#06b6d4', defaultActive: false, labelField: 'razon_social', labelMaxScale: 2000, category: 'parroquia' },
    { id: 'geoportal:ssb_etiquetas', name: 'San Sebastian', color: 'bg-pink-500', hexColor: '#ec4899', defaultActive: false, labelField: 'razon_social', labelMaxScale: 2000, category: 'parroquia' },
    { id: 'geoportal:Sambil_Locales_pb', name: 'Sambil - Planta Baja', color: 'bg-amber-600', hexColor: '#d97706', defaultActive: false, labelField: 'Razon_Social', labelMaxScale: 1500, category: 'sambil' },
    { id: 'geoportal:Sambil_Locales_p1', name: 'Sambil - Nivel 1', color: 'bg-yellow-500', hexColor: '#eab308', defaultActive: false, labelField: 'Razon_Social', labelMaxScale: 1500, category: 'sambil' }
];

//funcion para generar el sld dinámico para cada capa
const obtenerCuerpoSld = (layerId, hexColor, labelField, labelMaxScale = 5000) => {
    const layerName = layerId.includes(':') ? layerId.split(':')[1] : layerId;

    const textSymbolizer = labelField ? `
          <TextSymbolizer>
            <Geometry>
              <ogc:Function name="centroid">
                <ogc:PropertyName>geom</ogc:PropertyName>
              </ogc:Function>
            </Geometry>
            <Label>
              <ogc:Function name="strReplace">
                <ogc:PropertyName>${labelField}</ogc:PropertyName>
                <ogc:Literal> — sec_sc</ogc:Literal>
                <ogc:Literal></ogc:Literal>
                <ogc:Literal>true</ogc:Literal>
              </ogc:Function>
            </Label>
            <Font>
              <CssParameter name="font-family">Arial</CssParameter>
              <CssParameter name="font-size">9</CssParameter>
              <CssParameter name="font-style">normal</CssParameter>
              
            </Font>
            <LabelPlacement>
              <PointPlacement>
                <AnchorPoint>
                  <AnchorPointX>0.5</AnchorPointX>
                  <AnchorPointY>0.5</AnchorPointY>
                </AnchorPoint>
              </PointPlacement>
            </LabelPlacement>
            <Fill>
              <CssParameter name="fill">#222222</CssParameter>
            </Fill>
            <VendorOption name="autoWrap">65</VendorOption>
            <VendorOption name="goodnessOfFit">0.1</VendorOption>
            <VendorOption name="maxDisplacement">300</VendorOption>
            <VendorOption name="group">yes</VendorOption>
            <VendorOption name="labelAllGroup">false</VendorOption>
            <VendorOption name="repeat">1000000</VendorOption>
            <VendorOption name="partials">false</VendorOption>
          </TextSymbolizer>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>${layerName}</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <Name>Poligono</Name>
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">${hexColor}</CssParameter>
              <CssParameter name="fill-opacity">0.6</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#111111</CssParameter>
              <CssParameter name="stroke-width">0.8</CssParameter>
              <CssParameter name="stroke-opacity">0.8</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        ${textSymbolizer ? `
        <Rule>
          <Name>Etiquetas</Name>
          <MaxScaleDenominator>${labelMaxScale}</MaxScaleDenominator>
          ${textSymbolizer}
        </Rule>` : ''}
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;
};

//funcion para centrar el mapa automaticamente
function MapController({ center, zoom }) {
    const map = useMap();
    React.useEffect(() => {
        if (center) {
            map.flyTo(center, zoom || 18, {
                duration: 1.5,
                easeLinearity: 0.25
            });
        }
    }, [center, zoom, map]);
    return null;
}

//funcion para obtener la geometria de la capa seleccionada
function WMSGetFeatureInfo({ url, idsCapasActivas, alEncontrarLugar }) {
    const map = useMapEvents({
        click(e) {
            if (idsCapasActivas.length === 0) {
                alEncontrarLugar(null, null);
                return;
            }

            const BBOX = map.getBounds().toBBoxString();
            const WIDTH = map.getSize().x;
            const HEIGHT = map.getSize().y;
            const X = Math.round(e.containerPoint.x);
            const Y = Math.round(e.containerPoint.y);

            // GeoServer espera una lista de capas separadas por comas
            // INYECTAMOS BYPASS: Reemplazamos las vistas SQL que dan NullPointerException
            // por sus tablas base físicas equivalentes SOLO para el evento de click.
            const queryLayersArray = idsCapasActivas.map(id => {
                if (id === 'geoportal:concordia_etiquetas') return 'geoportal:Concordia';
                if (id === 'geoportal:pmm_etiquetas') return 'geoportal:pmm';
                if (id === 'geoportal:sjb_etiquetas') return 'geoportal:sjb';
                if (id === 'geoportal:ssb_etiquetas') return 'geoportal:ssb';
                return id;
            });
            const queryLayersStr = queryLayersArray.join(',');

            const getFeatureInfoUrl = `${API_BASE_URL}/api/click?lat=${e.latlng.lat}&lng=${e.latlng.lng}&layers=${idsCapasActivas.join(',')}`;

            fetch(getFeatureInfoUrl)
                .then(res => res.json())
                .then(data => {
                    if (data && data.features && data.features.length > 0) {
                        const feature = data.features[0];
                        alEncontrarLugar(feature, e.latlng);
                    } else {
                        alEncontrarLugar(null, null);
                    }
                })
                .catch(err => {
                    console.error("GetFeatureInfo Error:", err);
                    alEncontrarLugar(null, null);
                });
        }
    });
    return null;
}

export default function GeoportalMap() {
    const [capasActivas, setCapasActivas] = useState(
        CAPAS_WMS.reduce((acc, capa) => ({ ...acc, [capa.id]: capa.defaultActive }), {})
    );

    const [consultaBusqueda, setConsultaBusqueda] = useState('');
    const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
    const [estaBuscando, setEstaBuscando] = useState(false);

    // Estado del centro del mapa
    const [centroMapa, setCentroMapa] = useState(null);

    // Click personalizado de las capas WMS para mostrar Popups
    const [elementoClickeado, setElementoClickeado] = useState(null);

    const [mostrarCapas, setMostrarCapas] = useState(false);
    const [buscadorEnfocado, setBuscadorEnfocado] = useState(false);

    const alternarCapa = (idCapa) => {
        setCapasActivas(prev => ({
            ...prev,
            [idCapa]: !prev[idCapa]
        }));
    };

    const idsCapasActivas = CAPAS_WMS
        .filter(capa => capasActivas[capa.id])
        .sort((a, b) => {
            // Prioridad: 'parroquia' (comercios) antes que 'base' (manzanas, sectores)
            if (a.category === 'parroquia' && b.category === 'base') return -1;
            if (a.category === 'base' && b.category === 'parroquia') return 1;
            return 0;
        })
        .map(l => l.id);

    React.useEffect(() => {
        const buscarUbicaciones = async () => {
            if (consultaBusqueda.trim().length < 3) {
                setResultadosBusqueda([]);
                setEstaBuscando(false);
                return;
            }

            setEstaBuscando(true);
            setElementoClickeado(null); // Limpiar cualquier popup

            try {
                const nombresCapasActivas = idsCapasActivas.map(id => id.split(':')[1]);
                const respuesta = await fetch(`${API_BASE_URL}/api/search?query=${encodeURIComponent(consultaBusqueda)}&layers=${nombresCapasActivas.join(',')}`);
                const datos = await respuesta.json();
                if (datos.results) {
                    setResultadosBusqueda(datos.results);
                }
            } catch (error) {
                console.error('Error buscando:', error);
            } finally {
                setEstaBuscando(false);
            }
        };

        const timeoutId = setTimeout(buscarUbicaciones, 800);
        return () => clearTimeout(timeoutId);

    }, [consultaBusqueda, idsCapasActivas]);

    const manejarEnvioBusqueda = (e) => {
        e.preventDefault();
        // El envío ahora se maneja automáticamente al escribir, esto previene recargas al presionar Enter
    };

    const manejarClickResultado = (resultado) => {
        if (resultado.lat && resultado.lng) {
            const coordenadas = [resultado.lat, resultado.lng];
            setCentroMapa(coordenadas);
            setElementoClickeado({
                properties: resultado,
                latlng: coordenadas
            });
        }
        setResultadosBusqueda([]);
        setConsultaBusqueda('');
        setBuscadorEnfocado(false);
    };

    const manejarLugarEncontrado = (caracteristicasLugar, coordenadas) => {
        if (caracteristicasLugar) {
            setElementoClickeado({
                properties: caracteristicasLugar.properties || {},
                geometry: caracteristicasLugar.geometry,
                latlng: coordenadas,
                id: caracteristicasLugar.id || JSON.stringify(coordenadas)
            });
        } else {
            setElementoClickeado(null);
        }
    };

    // Ayuda para extraer el nombre básico y dirección
    const obtenerDetallesLugar = (propiedades) => {
        // Prioridad de nombres según la capa
        let nombre =
            propiedades.Razon_Social ||
            propiedades.razon_social ||
            propiedades['Razon Social'] ||
            propiedades.Nombre ||
            propiedades.nombre ||
            propiedades.Sector ||
            propiedades.sector ||
            propiedades.id_manzana ||
            propiedades.tipo_comercio ||
            'Registro Catastral';

        // Intentar limpiar el nombre si tiene el sufijo de base de datos
        if (typeof nombre === 'string') {
            nombre = nombre.replace(' — sec_sc', '');
        }

        let direccion = 
            propiedades.direccion || 
            propiedades['Direccion'] || 
            propiedades.Ubicacion ||
            propiedades.Local ||
            propiedades.Nivel ||
            propiedades.callejero || 
            '';

        // Si no hay dirección (común en capas base), mostramos el tipo de capa como contexto
        if (!direccion) {
            if (propiedades.id_manzana) direccion = "Manzana Catastral";
            else if (propiedades.sector || propiedades.Sector) direccion = "Sector Geográfico";
            else if (propiedades.nombre || propiedades.Nombre) direccion = "Ámbito Parroquial";
            else if (propiedades.Razon_Social) direccion = "Local Comercial - Sambil";
            else direccion = "Información Geográfica";
        }

        return { nombre, direccion };
    };

    return (
        <div className="w-full h-screen relative font-sans bg-gray-100">

            {/* Top Navbar Header */}
            <nav className="absolute top-0 left-0 w-full h-[72px] bg-white shadow z-[9999] flex items-center justify-between px-4 md:px-6 border-b border-gray-200">
                <div className="flex items-center gap-2 md:gap-6">
                    {/* Alcaldía Logo */}
                    <div className="flex items-center justify-center">
                        <img src={logoAlcaldia} alt="Logo Alcaldía" className="h-[40px] md:h-[52px] w-auto object-contain drop-shadow-sm" />
                    </div>

                    <div className="hidden md:flex ml-4 absolute inset-0 flex-col items-center justify-center pointer-events-none">
                        <h1 className="text-xl font-bold text-gray-800 tracking-tight leading-tight">Geoportal Catastral</h1>
                        <p className="text-[13px] font-medium text-gray-500 ">Alcaldía del Municipio San Cristóbal</p>
                    </div>
                </div>
                {/* Sumat Logo */}
                <div className="flex items-center justify-center pl-2 md:pl-4 border-l-2 border-gray-100">
                    <img src={logoSumat} alt="Logo SUMAT" className="h-[36px] md:h-[46px] w-auto object-contain drop-shadow-sm" />
                </div>
            </nav>

            {/* Map Content Area */}
            <div className="absolute top-[72px] left-0 right-0 bottom-0 z-0">

                {/* Floating Search Bar */}
                <div className={`absolute top-4 left-4 right-20 md:right-auto md:w-full md:max-w-[390px] transition-all duration-300 ${buscadorEnfocado ? 'shadow-2xl' : 'shadow-md'} bg-white rounded-2xl flex flex-col ${idsCapasActivas.length === 0 ? 'opacity-80' : ''}`}>
                    <form onSubmit={manejarEnvioBusqueda} className="flex items-center px-4 py-3">
                        <input
                            type="text"
                            placeholder={idsCapasActivas.length === 0 ? "Selecciona una capa para buscar..." : "Buscar lugares o RIF..."}
                            value={consultaBusqueda}
                            onChange={(e) => setConsultaBusqueda(e.target.value)}
                            onFocus={() => { if (idsCapasActivas.length > 0) setBuscadorEnfocado(true) }}
                            onBlur={() => setTimeout(() => setBuscadorEnfocado(false), 200)}
                            disabled={idsCapasActivas.length === 0}
                            className={`flex-1 outline-none text-[15px] placeholder-gray-500 text-gray-800 bg-transparent ${idsCapasActivas.length === 0 ? 'cursor-not-allowed' : ''}`}
                        />
                        {estaBuscando ? (
                            <div className="p-2 ml-1 text-gray-400">
                                <Search size={22} className="animate-spin opacity-50" />
                            </div>
                        ) : (
                            <button type="submit" disabled={idsCapasActivas.length === 0} className={`p-2 ml-1 rounded-full transition-colors ${idsCapasActivas.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-gray-100'}`}>
                                <Search size={22} />
                            </button>
                        )}
                    </form>

                    {/* Search Results Dropdown */}
                    {resultadosBusqueda.length > 0 && buscadorEnfocado && (
                        <div className="border-t border-gray-100 max-h-[60vh] overflow-y-auto w-full pb-2">
                            {resultadosBusqueda.map((res, i) => (
                                <div
                                    key={i}
                                    onMouseDown={() => manejarClickResultado(res)}
                                    className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <div className="bg-gray-200 p-2 rounded-full text-gray-600">
                                        <MapIcon size={18} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800 text-[15px]">{res.razon_social || res.type}</p>
                                        <p className="text-sm text-gray-500 truncate max-w-[280px]">{res.direccion || 'Táchira, Venezuela'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Floating Layer Menu */}
                <div className="absolute top-4 right-4 z-[1000]">
                    <div className="relative">
                        <button
                            onMouseEnter={() => setMostrarCapas(true)}
                            onClick={() => setMostrarCapas(!mostrarCapas)}
                            className="bg-white w-12 h-12 rounded-xl shadow-md flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors border border-gray-200"
                        >
                            <Layers size={24} />
                        </button>

                        {mostrarCapas && (
                            <div
                                onMouseLeave={() => setMostrarCapas(false)}
                                className="absolute top-14 right-0 w-64 bg-white rounded-2xl shadow-xl p-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-200"
                            >
                                <div className="space-y-4">
                                    {/* Grupo 1: Capas Parroquia */}
                                    <div>
                                        <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-2 px-2 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                            Capa Parroquia
                                        </h3>
                                        <div className="space-y-0.5">
                                            {CAPAS_WMS.filter(c => c.category === 'parroquia').map(capa => (
                                                <label key={capa.id} className="flex items-center py-1.5 px-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        checked={capasActivas[capa.id]}
                                                        onChange={() => alternarCapa(capa.id)}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <span className={`w-3 h-3 rounded-full ml-3 ${capa.color} shadow-sm border border-white`}></span>
                                                    <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                                                        {capa.name.replace(' (Comercios)', '')}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Grupo Sambil */}
                                    <div className="border-t border-gray-100 pt-3">
                                        <h3 className="text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-2 px-2 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div>
                                            CC Sambil
                                        </h3>
                                        <div className="space-y-0.5">
                                            {CAPAS_WMS.filter(c => c.category === 'sambil').map(capa => (
                                                <label key={capa.id} className="flex items-center py-1.5 px-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        checked={capasActivas[capa.id]}
                                                        onChange={() => alternarCapa(capa.id)}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <span className={`w-3 h-3 rounded-full ml-3 ${capa.color} shadow-sm border border-white`}></span>
                                                    <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                                                        {capa.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-3">
                                        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-2 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                            Capas de Estructura
                                        </h3>
                                        <div className="space-y-0.5">
                                            {CAPAS_WMS.filter(c => c.category === 'base').map(capa => (
                                                <label key={capa.id} className="flex items-center py-1.5 px-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                                                    <input
                                                        type="checkbox"
                                                        checked={capasActivas[capa.id]}
                                                        onChange={() => alternarCapa(capa.id)}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <span className={`w-3 h-3 rounded-full ml-3 ${capa.color} shadow-sm border border-white`}></span>
                                                    <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                                                        {capa.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Map Area */}
                <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    minZoom={12}
                    maxBounds={SAN_CRISTOBAL_BOUNDS}
                    maxBoundsViscosity={1.0}
                    className="w-full h-full z-0 relative"
                    zoomControl={false}
                >
                    {/* Leaflet zoom control */}
                    <ZoomControl position="bottomright" />

                    {/* control capas base */}
                    <LayersControl position="bottomleft">
                        <BaseLayer checked name="Google Maps (Calles)">
                            <TileLayer
                                attribution='&copy; Google Maps'
                                url="http://mt0.google.com/vt/lyrs=m&hl=es&x={x}&y={y}&z={z}"
                                maxZoom={21}
                            />
                        </BaseLayer>
                        <BaseLayer name="Google Maps (Satélite Híbrido)">
                            <TileLayer
                                attribution='&copy; Google Maps'
                                url="http://mt0.google.com/vt/lyrs=s,h&hl=es&x={x}&y={y}&z={z}"
                                maxZoom={21}
                            />
                        </BaseLayer>
                        <BaseLayer name="Google Maps (Satélite Puro)">
                            <TileLayer
                                attribution='&copy; Google Maps'
                                url="http://mt0.google.com/vt/lyrs=s&hl=es&x={x}&y={y}&z={z}"
                                maxZoom={21}
                            />
                        </BaseLayer>
                    </LayersControl>

                    {/* WMS capas */}
                    {CAPAS_WMS.map(capa => (
                        capasActivas[capa.id] && (
                            <WMSTileLayer
                                key={capa.id}
                                url={WMS_BASE_URL}
                                layers={capa.id}
                                format="image/png"
                                transparent={true}
                                version="1.1.0"
                                zIndex={100}
                                maxZoom={21}
                                buffer={128}
                                tiled={true}
                                sld_body={obtenerCuerpoSld(capa.id, capa.hexColor, capa.labelField, capa.labelMaxScale)}
                            />
                        )
                    ))}

                    {/* click para obtener informacion */}
                    <WMSGetFeatureInfo
                        url={WMS_BASE_URL}
                        idsCapasActivas={idsCapasActivas}
                        alEncontrarLugar={manejarLugarEncontrado}
                    />

                    {/* poligonos seleccionados para obtener informacion de las capas */}
                    {elementoClickeado && (elementoClickeado.geometry || (elementoClickeado.properties && elementoClickeado.properties.geometry)) && (
                        <GeoJSON
                            key={elementoClickeado.id || (elementoClickeado.properties && elementoClickeado.properties.id) || JSON.stringify(elementoClickeado.latlng)}
                            data={elementoClickeado.geometry || elementoClickeado.properties.geometry}
                            style={{
                                color: '#eab308', // Strong Yellow outline (Tailwind yellow-500)
                                weight: 5,
                                fillColor: '#fef08a', // Yellow fill
                                fillOpacity: 0.7
                            }}
                        />
                    )}

                    {/* popup para obtener informacion de las capas seleccionadas */}
                    {elementoClickeado && (
                        <Popup
                            position={elementoClickeado.latlng}
                            autoPan={true}
                            className="rounded-xl shadow-md border-0 custom-popup min-w-[220px]"
                            eventHandlers={{
                                remove: () => setElementoClickeado(null)
                            }}
                        >
                            {(() => {
                                const { nombre, direccion } = obtenerDetallesLugar(elementoClickeado.properties);
                                return (
                                    <div className="py-2 px-1">
                                        <h3 className="font-bold text-gray-900 text-[16px] mb-2 leading-tight flex items-start gap-2">
                                            <Compass size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                            <span>{nombre}</span>
                                        </h3>
                                        <div className="ml-6 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <p className="text-gray-600 text-[13.5px] leading-relaxed font-medium">{direccion}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </Popup>
                    )}

                    {/* Controlador de busqueda centrado */}
                    <MapController center={centroMapa} />
                </MapContainer>

            </div>
        </div>
    );
}
