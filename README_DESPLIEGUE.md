# Guía de Instalación y Despliegue - Geoportal Catastral

Este documento detalla los pasos necesarios para configurar y ejecutar el Geoportal Catastral en un nuevo entorno.

## 1. Requisitos Previos
- **Node.js** (v18 o superior) y npm.
- **PostgreSQL** (v14+) + extensión **PostGIS**.
- **GeoServer** (v2.20+) funcionando localmente (por defecto en puerto 8080).
- **Google Chrome** u otro navegador moderno.

---

## 2. Configuración de la Base de Datos (PostgreSQL)
1. Crear una base de datos llamada `catastrogis` en PostgreSQL.
2. Habilitar la extensión PostGIS:
   ```sql
   CREATE EXTENSION postgis;
   ```
3. Importar el archivo de respaldo `bd_geoportal` incluido en la raíz del proyecto.
4. Asegurarse de que el usuario `postgres` tenga permisos sobre las tablas del esquema `vialidad_manzanas` y `concordia`.

---

## 3. Configuración de GeoServer
Para que el mapa funcione, GeoServer debe exponer las capas a través de WMS.

1. **Workspace**: Crear un espacio de trabajo llamado `geoportal`.
2. **Store**: Crear un nuevo Almacén de Datos de tipo **PostGIS** apuntando a la base de datos `catastrogis`.
3. **Capas (Layers)**: Publicar las siguientes capas con estos nombres exactos:
   - `geoportal:Concordia` (Esquema: concordia, Tabla: concordia)
   - `geoportal:Man_sc` (Esquema: vialidad_manzanas, Tabla: Man_sc)
   - `geoportal:Parroquias_sc` (Esquema: vialidad_manzanas, Tabla: Parroquias_sc)
   - `geoportal:Sectores_Sc` (Esquema: vialidad_manzanas, Tabla: Sectores_Sc)
   - `geoportal:pmm` (Tabla de parroquia Pedro Maria Morantes)
   - `geoportal:sjb` (Tabla de parroquia San Juan Bautista)
   - `geoportal:ssb` (Tabla de parroquia San Sebastian)
4. **CORS**: Asegurarse de que GeoServer tenga habilitado CORS en su archivo `web.xml` para permitir peticiones desde el frontend (puerto 5173).

---

## 4. Configuración del Backend (API de Búsqueda)
1. Entrar a la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar variables de entorno (opcional, utiliza valores por defecto en `db.js`):
   Crea un archivo `.env` con las credenciales de tu DB:
   ```env
   DB_USER=postgres
   DB_PASSWORD=tu_contraseña
   DB_NAME=catastrogis
   DB_HOST=localhost
   DB_PORT=5432
   ```
4. Iniciar el servidor:
   ```bash
   node index.js
   ```

---

## 5. Configuración del Frontend
1. Entrar a la carpeta `frontend`:
   ```bash
   cd frontend
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Iniciar el entorno de desarrollo:
   ```bash
   npm run dev
   ```
4. Abrir en el navegador: `http://localhost:5173`

---

## Notas Importantes
- **Estilos Dinámicos**: El Geoportal genera los estilos (SLD) directamente desde el código React (`GeoportalMap.jsx`), por lo que no es necesario crear estilos manuales en GeoServer.
- **Acceso Directo**: Las capas comerciales tienen prioridad de clic sobre las manzanas.
- **Limpieza de Nombres**: El sistema limpia automáticamente el sufijo `— sec_sc` de los nombres de las parroquias.
