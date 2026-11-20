// Theme toggle functionality
const THEME_KEY = 'theme-preference';
let currentTheme = localStorage.getItem(THEME_KEY) || 'dark';

const hiddenBasemaps = { map: false, 'map-alertas': false, 'map-metas': false };

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    updateMapTileLayers();
}

function updateMapTileLayers() {
    const tileUrl = currentTheme === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution = currentTheme === 'dark' 
        ? '© OpenStreetMap contributors © CARTO' 
        : '© OpenStreetMap contributors';
    
    if (window.mapTileLayer) window.map.removeLayer(window.mapTileLayer);
    window.mapTileLayer = L.tileLayer(tileUrl, { attribution }).addTo(window.map);
    if (hiddenBasemaps['map']) window.map.removeLayer(window.mapTileLayer);
    
    if (window.mapAlertas && window.mapAlertasTileLayer) window.mapAlertas.removeLayer(window.mapAlertasTileLayer);
    if (window.mapAlertas) {
        window.mapAlertasTileLayer = L.tileLayer(tileUrl, { attribution }).addTo(window.mapAlertas);
        if (hiddenBasemaps['map-alertas']) window.mapAlertas.removeLayer(window.mapAlertasTileLayer);
    }
    
    if (window.mapMetas && window.mapMetasTileLayer) window.mapMetas.removeLayer(window.mapMetasTileLayer);
    if (window.mapMetas) {
        window.mapMetasTileLayer = L.tileLayer(tileUrl, { attribution }).addTo(window.mapMetas);
        if (hiddenBasemaps['map-metas']) window.mapMetas.removeLayer(window.mapMetasTileLayer);
    }
}

function toggleTheme() {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// Estado global
let currentData = {};
let geoJsonLayer = null;
let depositoData = {};
let currentTipo = 'todos';
let currentPoblacion = 'GLOBAL';

let totalMetaNiños = 0;
let totalMetaEmbarazadas = 0;
let totalAsistidosNiños = 0;
let totalAsistidosEmbarazadas = 0;

const map = L.map('map', { zoomControl: false, zoomSnap: 0.3, zoomDelta: 0.3, wheelPxPerZoomLevel: 160 }).setView([-23.5, -58.0], 6);

const getTileUrl = () => currentTheme === 'dark' 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const getTileAttribution = () => currentTheme === 'dark'
    ? '© OpenStreetMap contributors © CARTO'
    : '© OpenStreetMap contributors';

const mainTileLayer = L.tileLayer(getTileUrl(), { attribution: getTileAttribution() }).addTo(map);

window.map = map;
window.mapTileLayer = mainTileLayer;
registerMapLabels('map');

const regionColors = {
    'PARAGUARÍ': '#e74c3c', 'MISIONES': '#3498db', 'ITAPÚA': '#2ecc71',
    'ALTO PARAGUAY': '#9b59b6', 'BOQUERÓN': '#f39c12', 'PRESIDENTE HAYES': '#1abc9c',
    'CANINDEYÚ': '#e67e22', 'AMAMBAY': '#34495e', 'ÑEEMBUCÚ': '#c0392b',
    'CAAZAPÁ': '#16a085', 'CENTRAL': '#8e44ad', 'CAAGUAZÚ': '#f1c40f',
    'GUAIRÁ': '#d35400', 'ALTO PARANÁ': '#27ae60', 'CORDILLERA': '#2980b9',
    'SAN PEDRO': '#e91e63', 'CONCEPCIÓN': '#00bcd4', 'CAPITAL': '#2c3e50'
};

function getRegionColor(regionName) {
    const normalizedName = regionName.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nameMappings = {
        'PARAGUARI': 'PARAGUARÍ', 'ITAPUA': 'ITAPÚA', 'BOQUERON': 'BOQUERÓN',
        'CANINDEYU': 'CANINDEYÚ', 'ÑEEMBUCU': 'ÑEEMBUCÚ', 'CAAZAPA': 'CAAZAPÁ',
        'CAAGUAZU': 'CAAGUAZÚ', 'GUAIRA': 'GUAIRÁ', 'ALTO PARANA': 'ALTO PARANÁ',
        'CONCEPCION': 'CONCEPCIÓN', 'ASUNCION': 'CAPITAL'
    };
    const mappedName = nameMappings[normalizedName] || normalizedName;
    return regionColors[mappedName] || '#95a5a6';
}

async function loadGeoJSON() {
    try {
        const response = await fetch('regiones_paraguay.geojson');
        return await response.json();
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
        return null;
    }
}

function generateRegionLegend() {
    const legendContainer = document.getElementById('region-legend');
    legendContainer.innerHTML = '';
    
    const ordenRegiones = [
        'CONCEPCIÓN', 'SAN PEDRO', 'CORDILLERA', 'GUAIRÁ', 'CAAGUAZÚ',
        'CAAZAPÁ', 'ITAPÚA', 'MISIONES', 'PARAGUARÍ', 'ALTO PARANÁ',
        'CENTRAL', 'ÑEEMBUCÚ', 'AMAMBAY', 'CANINDEYÚ', 'PRESIDENTE HAYES',
        'BOQUERÓN', 'ALTO PARAGUAY', 'CAPITAL'
    ];
    
    const regions = ordenRegiones.filter(r => regionColors[r]);
    
    let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 80px; row-gap: 8px;">';
    regions.forEach(region => {
        html += `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: ${regionColors[region]}; width: 20px; height: 16px; border-radius: 3px; flex-shrink: 0;"></span>
                <span style="font-size: 0.72rem; color: #333; white-space: nowrap;">${region}</span>
            </div>
        `;
    });
    html += '</div>';
    legendContainer.innerHTML = html;
}

async function loadFilters() {
    try {
        const añosRes = await fetch('/api/años');
        const años = await añosRes.json();
        const añoSelect = document.getElementById('año');
        añoSelect.innerHTML = '<option value="TODOS">Todos los Años</option>';
        años.forEach(año => { añoSelect.innerHTML += `<option value="${año}">${año}</option>`; });

        const mesesRes = await fetch('/api/meses');
        const meses = await mesesRes.json();
        const mesSelect = document.getElementById('mes');
        mesSelect.innerHTML = '<option value="TODOS">Todos los Meses</option>';
        meses.forEach(mes => { mesSelect.innerHTML += `<option value="${mes}">${mes}</option>`; });

        const regionesRes = await fetch('/api/regiones');
        const regiones = await regionesRes.json();
        const regionSelect = document.getElementById('region');
        regionSelect.innerHTML = '<option value="TODOS">Todas las Regiones</option>';
        regiones.forEach(region => { regionSelect.innerHTML += `<option value="${region}">${region}</option>`; });
        
        const metaAñoSelect = document.getElementById('meta-año');
        metaAñoSelect.innerHTML = '<option value="TODOS">Todos los Años</option>';
        años.forEach(año => { metaAñoSelect.innerHTML += `<option value="${año}">${año}</option>`; });
        
        const metaMesSelect = document.getElementById('meta-mes');
        metaMesSelect.innerHTML = '<option value="TODOS">Todos los Meses</option>';
        meses.forEach(mes => { metaMesSelect.innerHTML += `<option value="${mes}">${mes}</option>`; });
        
        const compAñoSelect = document.getElementById('comparacion-año');
        if (compAñoSelect) {
            compAñoSelect.innerHTML = '<option value="TODOS">Todos los Años</option>';
            años.forEach(año => { compAñoSelect.innerHTML += `<option value="${año}">${año}</option>`; });
        }
        
        const compMesSelect = document.getElementById('comparacion-mes');
        if (compMesSelect) {
            compMesSelect.innerHTML = '<option value="TODOS">Todos los Meses</option>';
            meses.forEach(mes => { compMesSelect.innerHTML += `<option value="${mes}">${mes}</option>`; });
        }
        
        document.getElementById('meta-año').addEventListener('change', loadMetas);
        document.getElementById('meta-mes').addEventListener('change', loadMetas);
        document.getElementById('meta-tipo').addEventListener('change', loadMetas);
        document.getElementById('meta-poblacion').addEventListener('change', loadMetas);
        document.getElementById('alertas-poblacion').addEventListener('change', loadAlertas);
        
        if (compAñoSelect) compAñoSelect.addEventListener('change', loadComparacionRegiones);
        if (compMesSelect) compMesSelect.addEventListener('change', loadComparacionRegiones);
        const compTipoSelect = document.getElementById('comparacion-tipo');
        if (compTipoSelect) compTipoSelect.addEventListener('change', loadComparacionRegiones);
        const compPoblacionSelect = document.getElementById('comparacion-poblacion');
        if (compPoblacionSelect) compPoblacionSelect.addEventListener('change', loadComparacionRegiones);
        
        await loadDepositoData();
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

async function loadDepositoData(region = 'TODOS') {
    try {
        const res = await fetch(`/api/deposito?region=${region}`);
        depositoData = await res.json();
    } catch (error) {
        console.error('Error loading deposito:', error);
    }
}

// ========== FUNCIÓN PARA OCULTAR/MOSTRAR TARJETAS SEGÚN POBLACIÓN ==========
function updatePoblacionCardsVisibility(poblacion) {
    const cardLatinoTotal = document.getElementById('card-latino-total');
    const cardLatinoNuevos = document.getElementById('card-latino-nuevos');
    const cardIndigenaTotal = document.getElementById('card-indigena-total');
    const cardIndigenaNuevos = document.getElementById('card-indigena-nuevos');
    const cardLatinoRegion = document.getElementById('card-latino-region');
    const cardIndigenaRegion = document.getElementById('card-indigena-region');
    
    if (poblacion === 'LATINO') {
        // Mostrar solo tarjetas de Latino
        if (cardLatinoTotal) cardLatinoTotal.style.display = 'flex';
        if (cardLatinoNuevos) cardLatinoNuevos.style.display = 'flex';
        if (cardIndigenaTotal) cardIndigenaTotal.style.display = 'none';
        if (cardIndigenaNuevos) cardIndigenaNuevos.style.display = 'none';
        if (cardLatinoRegion) cardLatinoRegion.style.display = 'flex';
        if (cardIndigenaRegion) cardIndigenaRegion.style.display = 'none';
    } else if (poblacion === 'INDIGENA') {
        // Mostrar solo tarjetas de Indígena
        if (cardLatinoTotal) cardLatinoTotal.style.display = 'none';
        if (cardLatinoNuevos) cardLatinoNuevos.style.display = 'none';
        if (cardIndigenaTotal) cardIndigenaTotal.style.display = 'flex';
        if (cardIndigenaNuevos) cardIndigenaNuevos.style.display = 'flex';
        if (cardLatinoRegion) cardLatinoRegion.style.display = 'none';
        if (cardIndigenaRegion) cardIndigenaRegion.style.display = 'flex';
    } else {
        // GLOBAL - mostrar ambas
        if (cardLatinoTotal) cardLatinoTotal.style.display = 'flex';
        if (cardLatinoNuevos) cardLatinoNuevos.style.display = 'flex';
        if (cardIndigenaTotal) cardIndigenaTotal.style.display = 'flex';
        if (cardIndigenaNuevos) cardIndigenaNuevos.style.display = 'flex';
        if (cardLatinoRegion) cardLatinoRegion.style.display = 'flex';
        if (cardIndigenaRegion) cardIndigenaRegion.style.display = 'flex';
    }
}

async function fetchData() {
    const tipoDato = document.getElementById('tipo-dato').value;
    const poblacion = document.getElementById('poblacion').value;
    const año = document.getElementById('año').value;
    const mes = document.getElementById('mes').value;
    const region = document.getElementById('region').value;
    
    currentTipo = tipoDato;
    currentPoblacion = poblacion;
    
    // Actualizar visibilidad de tarjetas de población
    updatePoblacionCardsVisibility(poblacion);
    
    await loadDepositoData(region);
    
    try {
        let data = [];
        
        if (tipoDato === 'todos') {
            const [ninosData, embarazadasData, ceData] = await Promise.all([
                fetch(`/api/ninos/resumen?año=${año}&mes=${mes}&region=${region}&poblacion=${poblacion}`).then(r => r.json()),
                fetch(`/api/embarazadas/resumen?año=${año}&mes=${mes}&region=${region}&poblacion=${poblacion}`).then(r => r.json()),
                fetch(`/api/ce/resumen?año=${año}&mes=${mes}&region=${region}&poblacion=${poblacion}`).then(r => r.json())
            ]);
            
            const combinedData = {};
            
            const initRegion = (regionName) => {
                if (!combinedData[regionName]) {
                    combinedData[regionName] = { 
                        REGION: regionName, TOTAL_ASISTIDO: 0, SEGUIMIENTO: 0, FINALIZADOS: 0,
                        ATRASOS: 0, DESERCIONES: 0, T_SALIDA: 0, T_ENTRADA: 0, NUEVO_INGRESO: 0,
                        META_NIÑOS: 0, NUEVO_INGRESO_NIÑOS: 0, META_EMBARAZADAS: 0, NUEVO_INGRESO_EMBARAZADAS: 0
                    };
                }
            };
            
            ninosData.forEach(item => {
                initRegion(item.REGION);
                combinedData[item.REGION].TOTAL_ASISTIDO += (item.TOTAL_ASISTIDO || 0);
                combinedData[item.REGION].SEGUIMIENTO += (item.SEGUIMIENTO || 0);
                combinedData[item.REGION].FINALIZADOS += (item.FINALIZADOS || 0);
                combinedData[item.REGION].ATRASOS += (item.ATRASOS || 0);
                combinedData[item.REGION].DESERCIONES += (item.DESERCIONES || 0);
                combinedData[item.REGION].T_SALIDA += (item.T_SALIDA || 0);
                combinedData[item.REGION].T_ENTRADA += (item.T_ENTRADA || 0);
                combinedData[item.REGION].NUEVO_INGRESO += (item.NUEVO_INGRESO || 0);
                combinedData[item.REGION].META_NIÑOS += (item.META || 0);
                combinedData[item.REGION].NUEVO_INGRESO_NIÑOS += (item.NUEVO_INGRESO || 0);
            });
            
            embarazadasData.forEach(item => {
                initRegion(item.REGION);
                combinedData[item.REGION].TOTAL_ASISTIDO += (item.TOTAL_ASISTIDO || 0);
                combinedData[item.REGION].SEGUIMIENTO += (item.SEGUIMIENTO || 0);
                combinedData[item.REGION].FINALIZADOS += (item.FINALIZADOS || 0);
                combinedData[item.REGION].ATRASOS += (item.ATRASOS || 0);
                combinedData[item.REGION].DESERCIONES += (item.DESERCIONES || 0);
                combinedData[item.REGION].T_SALIDA += (item.T_SALIDA || 0);
                combinedData[item.REGION].T_ENTRADA += (item.T_ENTRADA || 0);
                combinedData[item.REGION].NUEVO_INGRESO += (item.NUEVO_INGRESO || 0);
                combinedData[item.REGION].META_EMBARAZADAS += (item.META || 0);
                combinedData[item.REGION].NUEVO_INGRESO_EMBARAZADAS += (item.NUEVO_INGRESO || 0);
            });
            
            ceData.forEach(item => {
                initRegion(item.REGION);
                combinedData[item.REGION].TOTAL_ASISTIDO += (item.TOTAL_ASISTIDO || 0);
                combinedData[item.REGION].SEGUIMIENTO += (item.SEGUIMIENTO || 0);
                combinedData[item.REGION].FINALIZADOS += (item.FINALIZADOS || 0);
                combinedData[item.REGION].ATRASOS += (item.ATRASOS || 0);
                combinedData[item.REGION].DESERCIONES += (item.DESERCIONES || 0);
                combinedData[item.REGION].T_SALIDA += (item.T_SALIDA || 0);
                combinedData[item.REGION].T_ENTRADA += (item.T_ENTRADA || 0);
                combinedData[item.REGION].NUEVO_INGRESO += (item.NUEVO_INGRESO || 0);
            });
            
            data = Object.values(combinedData);
        } else {
            const endpoint = `/api/${tipoDato}/resumen?año=${año}&mes=${mes}&region=${region}&poblacion=${poblacion}`;
            const response = await fetch(endpoint);
            data = await response.json();
        }
        
        currentData = {};
        totalMetaNiños = 0;
        totalMetaEmbarazadas = 0;
        totalAsistidosNiños = 0;
        totalAsistidosEmbarazadas = 0;
        
        data.forEach(item => {
            const normalizedRegion = item.REGION.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            currentData[normalizedRegion] = item;
            
            if (tipoDato === 'todos') {
                totalMetaNiños += (item.META_NIÑOS || 0);
                totalMetaEmbarazadas += (item.META_EMBARAZADAS || 0);
                totalAsistidosNiños += (item.NUEVO_INGRESO_NIÑOS || 0);
                totalAsistidosEmbarazadas += (item.NUEVO_INGRESO_EMBARAZADAS || 0);
            } else if (tipoDato === 'ninos') {
                totalMetaNiños += (item.META || 0);
                totalAsistidosNiños += (item.NUEVO_INGRESO || 0);
            } else if (tipoDato === 'embarazadas') {
                totalMetaEmbarazadas += (item.META || 0);
                totalAsistidosEmbarazadas += (item.NUEVO_INGRESO || 0);
            }
        });
        
        await updateMap();
        updateStats(data);
        await loadPoblacionTotales(año, mes, region, tipoDato);
        
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function loadPoblacionTotales(año, mes, region, tipo) {
    try {
        const response = await fetch(`/api/poblacion/totales?año=${año}&mes=${mes}&region=${region}&tipo=${tipo}`);
        const data = await response.json();
        
        document.getElementById('total-latino').textContent = (data.latino?.total_asistido || 0).toLocaleString();
        document.getElementById('latino-nuevos').textContent = (data.latino?.nuevo_ingreso || 0).toLocaleString();
        document.getElementById('total-indigena').textContent = (data.indigena?.total_asistido || 0).toLocaleString();
        document.getElementById('indigena-nuevos').textContent = (data.indigena?.nuevo_ingreso || 0).toLocaleString();
    } catch (error) {
        console.error('Error loading poblacion totales:', error);
    }
}

async function updateMap() {
    const selectedRegion = document.getElementById('region').value;
    const geojson = await loadGeoJSON();
    
    if (!geojson) return;
    
    if (geoJsonLayer) map.removeLayer(geoJsonLayer);
    
    function style(feature) {
        const regionName = feature.properties.dpto_desc;
        const normalizedRegionName = regionName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const normalizedSelectedRegion = selectedRegion !== 'TODOS' ? selectedRegion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() : 'TODOS';
        const isSelectedRegion = selectedRegion !== 'TODOS' && normalizedRegionName === normalizedSelectedRegion;
        const isOtherRegion = selectedRegion !== 'TODOS' && normalizedRegionName !== normalizedSelectedRegion;
        
        return {
            fillColor: getRegionColor(regionName),
            weight: isSelectedRegion ? 5 : 2,
            opacity: isOtherRegion ? 0.3 : 1,
            color: isSelectedRegion ? '#fff' : '#2c3e50',
            fillOpacity: isSelectedRegion ? 0.9 : (isOtherRegion ? 0.2 : 0.7)
        };
    }
    
    function highlightFeature(e) {
        const layer = e.target;
        layer.setStyle({ weight: 5, color: '#fff', fillOpacity: 0.9 });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) layer.bringToFront();
    }
    
    function resetHighlight(e) { geoJsonLayer.resetStyle(e.target); }
    
    function showRegionCard(e) {
        const regionName = e.target.feature.properties.dpto_desc;
        showRegionDetails(regionName);
        document.getElementById('region-card').classList.add('active');
        map.fitBounds(e.target.getBounds());
    }
    
    function onEachFeature(feature, layer) {
        layer.bindTooltip(feature.properties.dpto_desc, {
            permanent: true, direction: 'center', className: 'region-label', opacity: 1
        });
        layer.on({ mouseover: highlightFeature, mouseout: resetHighlight, click: showRegionCard });
    }
    
    geoJsonLayer = L.geoJson(geojson, { style: style, onEachFeature: onEachFeature }).addTo(map);
}

async function showRegionDetails(regionName) {
    const normalizedTargetName = regionName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    
    let regionData = null;
    const nameMappings = {
        'PRESIDENTE HAYES': ['PRESIDENTE HAYES', 'PRESIDENTEHAYES'],
        'ALTO PARAGUAY': ['ALTO PARAGUAY', 'ALTOPARAGUAY'],
        'BOQUERON': ['BOQUERON', 'BOQUERÓN'],
        'ITAPUA': ['ITAPUA', 'ITAPÚA'],
        'CANINDEYU': ['CANINDEYU', 'CANINDEYÚ'],
        'ÑEEMBUCU': ['ÑEEMBUCU', 'ÑEEMBUCÚ'],
        'CAAZAPA': ['CAAZAPA', 'CAAZAPÁ'],
        'CAAGUAZU': ['CAAGUAZU', 'CAAGUAZÚ'],
        'GUAIRA': ['GUAIRA', 'GUAIRÁ'],
        'ALTO PARANA': ['ALTO PARANA', 'ALTO PARANÁ', 'ALTOPARANA'],
        'PARAGUARI': ['PARAGUARI', 'PARAGUARÍ'],
        'CONCEPCION': ['CONCEPCION', 'CONCEPCIÓN'],
        'ASUNCION': ['ASUNCION', 'ASUNCIÓN', 'CAPITAL']
    };
    
    const mappedNames = nameMappings[normalizedTargetName] || [normalizedTargetName];
    for (const key of Object.keys(currentData)) {
        for (const mappedName of mappedNames) {
            if (key === mappedName || key.includes(mappedName) || mappedName.includes(key)) {
                regionData = currentData[key];
                break;
            }
        }
        if (regionData) break;
    }
    
    const regionColor = getRegionColor(regionName);
    document.getElementById('card-region-name').textContent = regionName;
    document.getElementById('card-region-color').style.backgroundColor = regionColor;
    
    if (regionData) {
        document.getElementById('card-total-asistidos').textContent = (regionData.TOTAL_ASISTIDO || 0).toLocaleString();
        document.getElementById('card-seguimiento').textContent = (regionData.SEGUIMIENTO || 0).toLocaleString();
        document.getElementById('card-finalizados').textContent = (regionData.FINALIZADOS || 0).toLocaleString();
        document.getElementById('card-atrasos').textContent = (regionData.ATRASOS || 0).toLocaleString();
        document.getElementById('card-deserciones').textContent = (regionData.DESERCIONES || 0).toLocaleString();
        document.getElementById('card-traslados').textContent = ((regionData.T_SALIDA || 0) + (regionData.T_ENTRADA || 0)).toLocaleString();
        document.getElementById('card-nuevo-ingreso').textContent = (regionData.NUEVO_INGRESO || 0).toLocaleString();
        
        let kilos = 0;
        for (const key of Object.keys(depositoData)) {
            const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            if (keyNorm.includes(normalizedTargetName) || normalizedTargetName.includes(keyNorm)) {
                kilos = depositoData[key];
                break;
            }
        }
        document.getElementById('card-kilos').textContent = (kilos || 0).toLocaleString();
        
        const año = document.getElementById('año').value;
        const mes = document.getElementById('mes').value;
        try {
            const pobResponse = await fetch(`/api/poblacion/totales?año=${año}&mes=${mes}&region=${regionName}&tipo=${currentTipo}`);
            const pobData = await pobResponse.json();
            document.getElementById('card-latino').textContent = (pobData.latino?.total_asistido || 0).toLocaleString();
            document.getElementById('card-indigena').textContent = (pobData.indigena?.total_asistido || 0).toLocaleString();
        } catch (e) {
            document.getElementById('card-latino').textContent = '0';
            document.getElementById('card-indigena').textContent = '0';
        }
        
        const metaNinos = regionData.META_NIÑOS || regionData.META || 0;
        const nuevoIngresoNinos = regionData.NUEVO_INGRESO_NIÑOS || regionData.NUEVO_INGRESO || 0;
        const metaEmbarazadas = regionData.META_EMBARAZADAS || 0;
        const nuevoIngresoEmbarazadas = regionData.NUEVO_INGRESO_EMBARAZADAS || 0;
        
        const pctMetaNinos = metaNinos > 0 ? ((nuevoIngresoNinos / metaNinos) * 100).toFixed(1) : '0.0';
        const pctMetaEmbarazadas = metaEmbarazadas > 0 ? ((nuevoIngresoEmbarazadas / metaEmbarazadas) * 100).toFixed(1) : '0.0';
        
        document.getElementById('card-meta-ninos').textContent = pctMetaNinos + '%';
        document.getElementById('card-meta-embarazadas').textContent = pctMetaEmbarazadas + '%';
        
        updateCardIndicators(regionData);
    } else {
        ['card-total-asistidos', 'card-seguimiento', 'card-finalizados', 'card-atrasos', 
         'card-deserciones', 'card-traslados', 'card-kilos', 'card-nuevo-ingreso',
         'card-latino', 'card-indigena', 'card-meta-ninos', 'card-meta-embarazadas'].forEach(id => {
            document.getElementById(id).textContent = '0';
        });
        document.getElementById('card-indicators').innerHTML = '<p style="color: #aaa; text-align: center;">Sin datos disponibles</p>';
    }
}

function updateCardIndicators(regionData) {
    const indicatorsContainer = document.getElementById('card-indicators');
    
    if (currentTipo === 'todos') {
        indicatorsContainer.innerHTML = '<p style="color: #aaa; text-align: center; padding: 10px;">Seleccione un tipo de dato para ver indicadores nutricionales</p>';
        return;
    }
    
    let indicators = [];
    if (currentTipo === 'ninos') {
        indicators = [
            { value: 'DESNUTRICION', label: 'Desnutrición' },
            { value: 'RIESGO_DESNUTRICION', label: 'Riesgo Desnutrición' },
            { value: 'ADECUADO', label: 'Adecuado' },
            { value: 'SOBREPESO', label: 'Sobrepeso' },
            { value: 'OBESIDAD', label: 'Obesidad' }
        ];
    } else if (currentTipo === 'embarazadas') {
        indicators = [
            { value: 'BAJO_PESO', label: 'Bajo Peso' },
            { value: 'ADECUADO', label: 'Adecuado' },
            { value: 'SOBREPESO', label: 'Sobrepeso' },
            { value: 'OBESIDAD', label: 'Obesidad' }
        ];
    } else if (currentTipo === 'ce') {
        indicators = [
            { value: 'NUEVO_INGRESO', label: 'Nuevo Ingreso' },
            { value: 'SEGUIMIENTO', label: 'Seguimiento' },
            { value: 'FINALIZADOS', label: 'Finalizados' }
        ];
    }
    
    const sumIndicators = indicators.reduce((sum, ind) => sum + (regionData[ind.value] || 0), 0);
    const total = sumIndicators || 1;
    
    let html = '<div class="region-card-indicators">';
    indicators.forEach(ind => {
        const value = regionData[ind.value] || 0;
        const percentage = ((value / total) * 100).toFixed(1);
        const barColor = percentage < 15 ? '#27ae60' : (percentage < 30 ? '#f1c40f' : (percentage < 50 ? '#e67e22' : '#e74c3c'));
        
        html += `
            <div class="region-card-indicator">
                <span class="label">${ind.label}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="value">${value.toLocaleString()}</span>
                    <span class="percentage">${percentage}%</span>
                    <div class="bar">
                        <div class="bar-fill" style="width: ${percentage}%; background: ${barColor};"></div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    indicatorsContainer.innerHTML = html;
}

function updateStats(data) {
    const totalAsistidos = data.reduce((sum, d) => sum + (d.TOTAL_ASISTIDO || 0), 0);
    const totalSeguimiento = data.reduce((sum, d) => sum + (d.SEGUIMIENTO || 0), 0);
    const totalFinalizados = data.reduce((sum, d) => sum + (d.FINALIZADOS || 0), 0);
    const totalAtrasos = data.reduce((sum, d) => sum + (d.ATRASOS || 0), 0);
    const totalDeserciones = data.reduce((sum, d) => sum + (d.DESERCIONES || 0), 0);
    const totalTSalida = data.reduce((sum, d) => sum + (d.T_SALIDA || 0), 0);
    const totalTEntrada = data.reduce((sum, d) => sum + (d.T_ENTRADA || 0), 0);
    const totalIngresosNuevos = data.reduce((sum, d) => sum + (d.NUEVO_INGRESO || 0), 0);
    
    document.getElementById('total-asistidos').textContent = totalAsistidos.toLocaleString();
    document.getElementById('total-seguimiento').textContent = totalSeguimiento.toLocaleString();
    document.getElementById('total-finalizados').textContent = totalFinalizados.toLocaleString();
    document.getElementById('total-atrasos').textContent = totalAtrasos.toLocaleString();
    document.getElementById('total-deserciones').textContent = totalDeserciones.toLocaleString();
    document.getElementById('t-salida').textContent = totalTSalida.toLocaleString();
    document.getElementById('t-entrada').textContent = totalTEntrada.toLocaleString();
    document.getElementById('ingresos-nuevos').textContent = totalIngresosNuevos.toLocaleString();
    
    const totalMetaNiñosCalc = data.reduce((sum, d) => sum + (d.META_NIÑOS || d.META || 0), 0);
    const totalMetaEmbarazadasCalc = data.reduce((sum, d) => sum + (d.META_EMBARAZADAS || 0), 0);
    const totalNuevoIngresoNiños = data.reduce((sum, d) => sum + (d.NUEVO_INGRESO_NIÑOS || d.NUEVO_INGRESO || 0), 0);
    const totalNuevoIngresoEmbarazadas = data.reduce((sum, d) => sum + (d.NUEVO_INGRESO_EMBARAZADAS || 0), 0);
    
    const pctMetaNiñosCalc = totalMetaNiñosCalc > 0 ? ((totalNuevoIngresoNiños / totalMetaNiñosCalc) * 100).toFixed(1) : '0.0';
    const pctMetaEmbarazadasCalc = totalMetaEmbarazadasCalc > 0 ? ((totalNuevoIngresoEmbarazadas / totalMetaEmbarazadasCalc) * 100).toFixed(1) : '0.0';
    
    document.getElementById('meta-ninos').textContent = pctMetaNiñosCalc + '%';
    document.getElementById('meta-embarazadas').textContent = pctMetaEmbarazadasCalc + '%';
    
    const metaNinosEl = document.getElementById('meta-ninos').parentElement;
    const metaEmbarazadasEl = document.getElementById('meta-embarazadas').parentElement;
    
    if (currentTipo === 'todos') {
        metaNinosEl.style.display = 'flex';
        metaEmbarazadasEl.style.display = 'flex';
    } else if (currentTipo === 'ninos') {
        metaNinosEl.style.display = 'flex';
        metaEmbarazadasEl.style.display = 'none';
    } else if (currentTipo === 'embarazadas') {
        metaNinosEl.style.display = 'none';
        metaEmbarazadasEl.style.display = 'flex';
    } else {
        metaNinosEl.style.display = 'none';
        metaEmbarazadasEl.style.display = 'none';
    }
    
    let kilosDisponibles = 0;
    const selectedRegion = document.getElementById('region').value;
    
    if (selectedRegion !== 'TODOS') {
        const normalizedRegionName = selectedRegion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        for (const key of Object.keys(depositoData)) {
            const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
            if (keyNorm.includes(normalizedRegionName) || normalizedRegionName.includes(keyNorm)) {
                kilosDisponibles = depositoData[key];
                break;
            }
        }
    } else {
        Object.values(depositoData).forEach(value => { kilosDisponibles += value || 0; });
    }
    
    document.getElementById('kilos-disponibles').textContent = kilosDisponibles.toLocaleString();
}

// Event listeners
document.getElementById('tipo-dato').addEventListener('change', fetchData);
document.getElementById('poblacion').addEventListener('change', fetchData);
document.getElementById('año').addEventListener('change', fetchData);
document.getElementById('mes').addEventListener('change', fetchData);
document.getElementById('region').addEventListener('change', fetchData);

document.getElementById('clear-filters').addEventListener('click', function() {
    document.getElementById('tipo-dato').value = 'todos';
    document.getElementById('poblacion').value = 'GLOBAL';
    document.getElementById('año').value = 'TODOS';
    document.getElementById('mes').value = 'TODOS';
    document.getElementById('region').value = 'TODOS';
    fetchData();
});

document.getElementById('card-close').addEventListener('click', function() {
    document.getElementById('region-card').classList.remove('active');
});

// Analysis buttons
document.querySelectorAll('.analysis-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        const panel = this.getAttribute('data-panel');
        document.querySelectorAll('.analysis-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        document.querySelectorAll('.analysis-panel').forEach(p => p.classList.remove('active'));
        
        if (panel === 'none') {
            document.getElementById('map').style.display = 'block';
            document.querySelector('.stats-grid').style.display = 'grid';
        } else if (panel === 'regiones') {
            document.getElementById('panel-regiones').classList.add('active');
            document.getElementById('map').style.display = 'none';
            document.querySelector('.stats-grid').style.display = 'none';
            await loadComparacionRegiones();
        } else if (panel === 'años') {
            document.getElementById('panel-años').classList.add('active');
            document.getElementById('map').style.display = 'none';
            document.querySelector('.stats-grid').style.display = 'none';
            await loadComparacionAños();
        } else if (panel === 'alertas') {
            document.getElementById('panel-alertas').classList.add('active');
            document.getElementById('map').style.display = 'none';
            document.querySelector('.stats-grid').style.display = 'none';
            await loadAlertas();
        } else if (panel === 'metas') {
            document.getElementById('panel-metas').classList.add('active');
            document.getElementById('map').style.display = 'none';
            document.querySelector('.stats-grid').style.display = 'none';
            await loadMetas();
        } else if (panel === 'nutricional') {
            document.getElementById('panel-nutricional').classList.add('active');
            document.getElementById('map').style.display = 'none';
            document.querySelector('.stats-grid').style.display = 'none';
            await loadAnalisisNutricional();
        }
    });
});

async function loadComparacionRegiones() {
    const año = document.getElementById('comparacion-año')?.value || 'TODOS';
    const mes = document.getElementById('comparacion-mes')?.value || 'TODOS';
    const tipo = document.getElementById('comparacion-tipo')?.value || 'todos';
    const poblacion = document.getElementById('comparacion-poblacion')?.value || 'GLOBAL';
    const container = document.getElementById('tabla-regiones');
    
    try {
        const response = await fetch(`/api/comparacion/regiones?año=${año}&mes=${mes}&tipo=${tipo}&poblacion=${poblacion}`);
        const data = await response.json();
        
        if (Object.keys(data).length === 0) {
            container.innerHTML = '<p style="color: #aaa;">No hay datos disponibles</p>';
            return;
        }
        
        let html = '<table class="comparison-table"><thead><tr><th>Región</th>';
        
        if (tipo === 'todos') {
            html += '<th>Nuevo Ingreso</th><th>Seguimiento</th><th>Finalizados</th><th>Atrasos</th><th>Deserciones</th><th>Total</th>';
        } else if (tipo === 'ninos') {
            html += '<th>Nuevo Ingreso</th><th>Desnutrición</th><th>Riesgo</th><th>Adecuado</th><th>Seguimiento</th><th>Total</th>';
        } else if (tipo === 'embarazadas') {
            html += '<th>Nuevo Ingreso</th><th>Bajo Peso</th><th>Adecuado</th><th>Seguimiento</th><th>Total</th>';
        } else {
            html += '<th>Nuevo Ingreso</th><th>Seguimiento</th><th>Finalizados</th><th>Total</th>';
        }
        html += '</tr></thead><tbody>';
        
        for (const region of Object.keys(data)) {
            const v = data[region];
            html += `<tr><td style="font-weight:600;">${region}</td>`;
            
            if (tipo === 'todos') {
                const ni = (v.NUEVO_INGRESO_NINOS||0) + (v.NUEVO_INGRESO_EMB||0) + (v.NUEVO_INGRESO_CE||0);
                const seg = (v.SEGUIMIENTO_NINOS||0) + (v.SEGUIMIENTO_EMB||0) + (v.SEGUIMIENTO_CE||0);
                const fin = (v.FINALIZADOS_NINOS||0) + (v.FINALIZADOS_EMB||0) + (v.FINALIZADOS_CE||0);
                const atr = (v.ATRASOS_NINOS||0) + (v.ATRASOS_EMB||0) + (v.ATRASOS_CE||0);
                const des = (v.DESERCIONES_NINOS||0) + (v.DESERCIONES_EMB||0) + (v.DESERCIONES_CE||0);
                const tot = (v.TOTAL_ASISTIDO_NINOS||0) + (v.TOTAL_ASISTIDO_EMB||0) + (v.TOTAL_ASISTIDO_CE||0);
                html += `<td>${ni.toLocaleString()}</td><td>${seg.toLocaleString()}</td><td>${fin.toLocaleString()}</td><td>${atr.toLocaleString()}</td><td>${des.toLocaleString()}</td><td class="highlight">${tot.toLocaleString()}</td>`;
            } else if (tipo === 'ninos') {
                html += `<td>${(v.NUEVO_INGRESO||0).toLocaleString()}</td><td>${(v.DESNUTRICION||0).toLocaleString()}</td><td>${(v.RIESGO_DESNUTRICION||0).toLocaleString()}</td><td>${(v.ADECUADO||0).toLocaleString()}</td><td>${(v.SEGUIMIENTO||0).toLocaleString()}</td><td class="highlight">${(v.TOTAL_ASISTIDO||0).toLocaleString()}</td>`;
            } else if (tipo === 'embarazadas') {
                html += `<td>${(v.NUEVO_INGRESO||0).toLocaleString()}</td><td>${(v.BAJO_PESO||0).toLocaleString()}</td><td>${(v.ADECUADO||0).toLocaleString()}</td><td>${(v.SEGUIMIENTO||0).toLocaleString()}</td><td class="highlight">${(v.TOTAL_ASISTIDO||0).toLocaleString()}</td>`;
            } else {
                html += `<td>${(v.NUEVO_INGRESO_CE||0).toLocaleString()}</td><td>${(v.SEGUIMIENTO_CE||0).toLocaleString()}</td><td>${(v.FINALIZADOS_CE||0).toLocaleString()}</td><td class="highlight">${(v.TOTAL_ASISTIDO_CE||0).toLocaleString()}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading comparación regiones:', error);
        container.innerHTML = '<p style="color: #e94560;">Error al cargar datos</p>';
    }
}

async function loadAlertas() {
    const año = document.getElementById('año').value;
    const mes = document.getElementById('mes').value;
    const poblacion = document.getElementById('alertas-poblacion')?.value || 'GLOBAL';
    const container = document.getElementById('alertas-detalle');
    
    try {
        const response = await fetch(`/api/alertas?año=${año}&mes=${mes}&poblacion=${poblacion}`);
        const data = await response.json();
        
        if (data.length === 0) {
            container.innerHTML = '<p style="color: #aaa;">No hay datos disponibles</p>';
            return;
        }
        
        data.sort((a, b) => b.overall_alert - a.overall_alert);
        
        let html = '<div class="alerts-grid">';
        for (const item of data) {
            const alertClass = item.overall_alert === 2 ? 'red' : (item.overall_alert === 1 ? 'yellow' : 'green');
            html += `
                <div class="alert-card ${alertClass}">
                    <div class="region-name"><span class="region-color" style="background: ${getRegionColor(item.region)};"></span>${item.region}</div>
                    <div class="alert-indicator"><span class="label">Desnutridos</span><span class="value">${item.desnutricion.toLocaleString()}</span><span class="badge ${item.alert_desnutricion === 2 ? 'red' : (item.alert_desnutricion === 1 ? 'yellow' : 'green')}">${item.pct_desnutricion}%</span></div>
                    <div class="alert-indicator"><span class="label">Riesgo Desp.</span><span class="value">${item.riesgo.toLocaleString()}</span><span class="badge ${item.alert_riesgo === 2 ? 'red' : (item.alert_riesgo === 1 ? 'yellow' : 'green')}">${item.pct_riesgo}%</span></div>
                    <div class="alert-indicator"><span class="label">Atrasos</span><span class="value">${item.atrasos.toLocaleString()}</span><span class="badge ${item.alert_atrasos === 2 ? 'red' : (item.alert_atrasos === 1 ? 'yellow' : 'green')}">${item.pct_atrasos}%</span></div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        
        await initAlertasMap(data);
    } catch (error) {
        console.error('Error loading alertas:', error);
        container.innerHTML = '<p style="color: #e94560;">Error al cargar datos</p>';
    }
}

async function loadMetas() {
    const año = document.getElementById('meta-año').value;
    const mes = document.getElementById('meta-mes').value;
    const tipo = document.getElementById('meta-tipo').value;
    const poblacion = document.getElementById('meta-poblacion')?.value || 'GLOBAL';
    const container = document.getElementById('metas-detalle');
    
    try {
        const response = await fetch(`/api/metas?año=${año}&mes=${mes}&tipo=${tipo}&poblacion=${poblacion}`);
        const data = await response.json();
        
        if (data.length === 0) {
            container.innerHTML = '<p style="color: #aaa;">No hay datos disponibles</p>';
            return;
        }
        
        data.sort((a, b) => b.alert_level - a.alert_level);
        
        let html = '<div class="alerts-grid">';
        for (const item of data) {
            const alertClass = item.alert_level === 2 ? 'red' : (item.alert_level === 1 ? 'yellow' : 'green');
            const statusText = item.alert_level === 2 ? 'Por Debajo de Meta' : (item.alert_level === 1 ? 'En Proceso' : 'Meta Cumplida');
            html += `
                <div class="alert-card ${alertClass}">
                    <div class="region-name"><span class="region-color" style="background: ${getRegionColor(item.region)};"></span>${item.region}</div>
                    <div class="alert-indicator"><span class="label">Estado</span><span class="badge ${alertClass}">${statusText}</span></div>
                    <div class="alert-indicator"><span class="label">% Cumplimiento</span><span class="value" style="font-size:1.2em;font-weight:bold;">${item.pct_cumplimiento}%</span></div>
                    <div class="alert-indicator"><span class="label">Nuevos Ingresos</span><span class="value">${item.nuevo_ingreso.toLocaleString()}</span></div>
                    <div class="alert-indicator"><span class="label">Meta</span><span class="value">${item.meta.toLocaleString()}</span></div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        
        await initMetasMap(data);
    } catch (error) {
        console.error('Error loading metas:', error);
        container.innerHTML = '<p style="color: #e94560;">Error al cargar datos</p>';
    }
}

let mapAlertas = null, geoJsonLayerAlertas = null;
let mapMetas = null, geoJsonLayerMetas = null;

async function initAlertasMap(alertasData) {
    setTimeout(async () => {
        if (!mapAlertas) {
            mapAlertas = L.map('map-alertas', { zoomControl: false, zoomSnap: 0.3, zoomDelta: 0.3 }).setView([-23.5, -58.0], 6);
            const tileLayer = L.tileLayer(getTileUrl(), { attribution: getTileAttribution() }).addTo(mapAlertas);
            window.mapAlertas = mapAlertas;
            window.mapAlertasTileLayer = tileLayer;
            registerMapLabels('map-alertas');
        }
        
        const geojson = await loadGeoJSON();
        if (!geojson) return;
        if (geoJsonLayerAlertas) mapAlertas.removeLayer(geoJsonLayerAlertas);
        
        const alertasDict = {};
        alertasData.forEach(item => { alertasDict[item.region] = item; });
        
        function getAlertColor(level) {
            if (level === 2) return '#e74c3c';
            if (level === 1) return '#f1c40f';
            return '#27ae60';
        }
        
        geoJsonLayerAlertas = L.geoJSON(geojson, {
            style: function(feature) {
                const normalizedName = feature.properties.dpto_desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
                const alertData = alertasDict[normalizedName] || alertasDict[feature.properties.dpto_desc];
                const level = alertData ? alertData.overall_alert : 0;
                return { fillColor: getAlertColor(level), weight: 2, opacity: 1, color: '#2c3e50', fillOpacity: 0.7 };
            },
            onEachFeature: function(feature, layer) {
                layer.bindTooltip(feature.properties.dpto_desc, { permanent: true, direction: 'center', className: 'region-label', opacity: 1 });
                const normalizedName = feature.properties.dpto_desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
                const alertData = alertasDict[normalizedName] || alertasDict[feature.properties.dpto_desc];
                let popup = `<h4>${feature.properties.dpto_desc}</h4>`;
                if (alertData) {
                    popup += `<div class="popup-row"><span class="label">Desnutridos:</span><span class="value">${alertData.desnutricion.toLocaleString()} (${alertData.pct_desnutricion}%)</span></div>
                              <div class="popup-row"><span class="label">Riesgo:</span><span class="value">${alertData.riesgo.toLocaleString()} (${alertData.pct_riesgo}%)</span></div>
                              <div class="popup-row"><span class="label">Atrasos:</span><span class="value">${alertData.atrasos.toLocaleString()} (${alertData.pct_atrasos}%)</span></div>`;
                } else {
                    popup += '<p>Sin datos</p>';
                }
                layer.bindPopup(popup);
            }
        }).addTo(mapAlertas);
        
        mapAlertas.invalidateSize();
    }, 100);
}

async function initMetasMap(metasData) {
    setTimeout(async () => {
        if (!mapMetas) {
            mapMetas = L.map('map-metas', { zoomControl: false, zoomSnap: 0.3, zoomDelta: 0.3 }).setView([-23.5, -58.0], 6);
            const tileLayer = L.tileLayer(getTileUrl(), { attribution: getTileAttribution() }).addTo(mapMetas);
            window.mapMetas = mapMetas;
            window.mapMetasTileLayer = tileLayer;
            registerMapLabels('map-metas');
        }
        
        const geojson = await loadGeoJSON();
        if (!geojson) return;
        if (geoJsonLayerMetas) mapMetas.removeLayer(geoJsonLayerMetas);
        
        const metasDict = {};
        metasData.forEach(item => { metasDict[item.region] = item; });
        
        function getMetaColor(pct) {
            if (pct >= 80) return '#27ae60';
            if (pct >= 60) return '#f1c40f';
            return '#e74c3c';
        }
        
        geoJsonLayerMetas = L.geoJSON(geojson, {
            style: function(feature) {
                const normalizedName = feature.properties.dpto_desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
                const metaData = metasDict[normalizedName] || metasDict[feature.properties.dpto_desc];
                const pct = metaData ? metaData.pct_cumplimiento : 0;
                return { fillColor: getMetaColor(pct), weight: 2, opacity: 1, color: '#2c3e50', fillOpacity: 0.7 };
            },
            onEachFeature: function(feature, layer) {
                layer.bindTooltip(feature.properties.dpto_desc, { permanent: true, direction: 'center', className: 'region-label', opacity: 1 });
                const normalizedName = feature.properties.dpto_desc.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
                const metaData = metasDict[normalizedName] || metasDict[feature.properties.dpto_desc];
                let popup = `<h4>${feature.properties.dpto_desc}</h4>`;
                if (metaData) {
                    const statusText = metaData.alert_level === 2 ? 'Por Debajo de Meta' : (metaData.alert_level === 1 ? 'En Proceso' : 'Meta Cumplida');
                    popup += `<div class="popup-row"><span class="label">Estado:</span><span class="value">${statusText}</span></div>
                              <div class="popup-row"><span class="label">% Cumplimiento:</span><span class="value">${metaData.pct_cumplimiento}%</span></div>
                              <div class="popup-row"><span class="label">Nuevos:</span><span class="value">${metaData.nuevo_ingreso.toLocaleString()}</span></div>
                              <div class="popup-row"><span class="label">Meta:</span><span class="value">${metaData.meta.toLocaleString()}</span></div>`;
                } else {
                    popup += '<p>Sin datos</p>';
                }
                layer.bindPopup(popup);
            }
        }).addTo(mapMetas);
        
        mapMetas.invalidateSize();
    }, 100);
}

async function loadComparacionAños() {
    const region = document.getElementById('region-comparacion').value;
    const container = document.getElementById('tabla-años');
    const poblacion = document.getElementById('comparacion-poblacion')?.value || 'GLOBAL';
    
    try {
        const response = await fetch(`/api/comparacion/años?region=${region}&tipo=ninos&poblacion=${poblacion}`);
        const data = await response.json();
        
        if (Object.keys(data).length === 0) {
            container.innerHTML = '<p style="color: #aaa;">No hay datos disponibles</p>';
            return;
        }
        
        const years = Object.keys(data).sort();
        let html = '<div class="year-comparison-grid">';
        for (const año of years) {
            const v = data[año];
            html += `
                <div class="year-card">
                    <div class="year">${año}</div>
                    <div class="stat"><span class="label">Total Asistidos</span><span class="value highlight">${(v.TOTAL_ASISTIDO || 0).toLocaleString()}</span></div>
                    <div class="stat"><span class="label">Desnutrición</span><span class="value">${(v.DESNUTRICION || 0).toLocaleString()}</span></div>
                    <div class="stat"><span class="label">Riesgo Desp.</span><span class="value">${(v.RIESGO_DESNUTRICION || 0).toLocaleString()}</span></div>
                    <div class="stat"><span class="label">Seguimiento</span><span class="value">${(v.SEGUIMIENTO || 0).toLocaleString()}</span></div>
                    <div class="stat"><span class="label">Atrasos</span><span class="value">${(v.ATRASOS || 0).toLocaleString()}</span></div>
                    <div class="stat"><span class="label">Nuevos Ingresos</span><span class="value">${(v.NUEVO_INGRESO || 0).toLocaleString()}</span></div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading comparación años:', error);
        container.innerHTML = '<p style="color: #e94560;">Error al cargar datos</p>';
    }
}

async function loadRegionComparacion() {
    try {
        const response = await fetch('/api/regiones');
        const regiones = await response.json();
        const select = document.getElementById('region-comparacion');
        select.innerHTML = '<option value="TODOS">Todas las Regiones</option>';
        regiones.forEach(region => { select.innerHTML += `<option value="${region}">${region}</option>`; });
        select.addEventListener('change', loadComparacionAños);
    } catch (error) {
        console.error('Error loading regions for comparison:', error);
    }
}

async function init() {
    setTheme(currentTheme);
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    
    const startPresentationBtn = document.getElementById('start-presentation');
    if (startPresentationBtn) {
        startPresentationBtn.addEventListener('click', function() {
            const filtros = {
                año: document.getElementById('año').value,
                tipo: document.getElementById('tipo-dato').value,
                mes: document.getElementById('mes').value,
                poblacion: document.getElementById('poblacion').value
            };
            localStorage.setItem('presentation-filtros', JSON.stringify(filtros));
            localStorage.setItem('presentation-theme', currentTheme);
            window.location.href = 'presentacion.html';
        });
    }
    
    generateRegionLegend();
    await loadFilters();
    await loadRegionComparacion();
    await fetchData();
}

init();

function getMapInstanceForFullscreen(id) {
    if (id === 'map') return window.map;
    if (id === 'map-alertas') return window.mapAlertas;
    if (id === 'map-metas') return window.mapMetas;
    return null;
}

document.querySelectorAll('.map-fullscreen-btn').forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    const mapEl = document.getElementById(targetId);
    if (!mapEl) return;
    
    btn.addEventListener('mousedown', e => e.stopPropagation());
    btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    
    btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
            if (mapEl.requestFullscreen) mapEl.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    });
});

document.addEventListener('fullscreenchange', () => {
    const fsEl = document.fullscreenElement;
    document.querySelectorAll('.map-fullscreen-btn').forEach(btn => {
        const id = btn.getAttribute('data-target');
        const mapEl = document.getElementById(id);
        if (!mapEl) return;
        if (fsEl === mapEl) {
            mapEl.classList.add('map-fullscreen');
            btn.innerHTML = '✕';
        } else {
            mapEl.classList.remove('map-fullscreen');
            btn.innerHTML = '⛶';
        }
        const mapObj = getMapInstanceForFullscreen(id);
        if (mapObj) setTimeout(() => mapObj.invalidateSize(), 300);
    });
});

function updateLabelScale(mapEl, mapObj) {
    if (!mapEl || !mapObj) return;
    const z = mapObj.getZoom();
    const scale = Math.max(0.7, Math.min(2.4, 0.7 + (z - 5) * 0.18));
    mapEl.style.setProperty('--label-scale', scale.toFixed(2));
}

function registerMapLabels(id) {
    const mapObj = getMapInstanceForFullscreen(id);
    const mapEl = document.getElementById(id);
    if (!mapObj || !mapEl) return;
    updateLabelScale(mapEl, mapObj);
    mapObj.on('zoomend', () => updateLabelScale(mapEl, mapObj));
}

const mapTargetIds = ['map', 'map-alertas', 'map-metas'];
const toggleLabelsBtn = document.getElementById('toggle-labels');
let labelsVisible = true;
if (toggleLabelsBtn) {
    toggleLabelsBtn.addEventListener('click', () => {
        labelsVisible = !labelsVisible;
        mapTargetIds.forEach(id => {
            const mapEl = document.getElementById(id);
            if (mapEl) mapEl.classList.toggle('hide-region-labels', !labelsVisible);
        });
        toggleLabelsBtn.style.opacity = labelsVisible ? '1' : '0.45';
    });
}

document.querySelectorAll('.map-zoom-btn').forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    const action = btn.getAttribute('data-zoom');
    btn.addEventListener('mousedown', e => e.stopPropagation());
    btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const mapObj = getMapInstanceForFullscreen(targetId);
        if (mapObj) { if (action === 'in') mapObj.zoomIn(); else mapObj.zoomOut(); }
    });
});

function getTileLayerForMap(id) {
    if (id === 'map') return window.mapTileLayer;
    if (id === 'map-alertas') return window.mapAlertasTileLayer;
    if (id === 'map-metas') return window.mapMetasTileLayer;
    return null;
}

document.querySelectorAll('.map-basemap-btn').forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    btn.addEventListener('mousedown', e => e.stopPropagation());
    btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const mapObj = getMapInstanceForFullscreen(targetId);
        const tileLayer = getTileLayerForMap(targetId);
        if (!mapObj || !tileLayer) return;
        const hidden = !hiddenBasemaps[targetId];
        hiddenBasemaps[targetId] = hidden;
        if (hidden) { mapObj.removeLayer(tileLayer); btn.innerHTML = '🚫'; }
        else { mapObj.addLayer(tileLayer); btn.innerHTML = '🗺️'; }
    });
});

// Nutricional analysis
let chartDistribucion = null, chartTop5 = null, chartEvolucionAnual = null, chartEvolucionMensual = null;

async function loadAnalisisNutricional() {
    const tipoSelect = document.getElementById('nutricional-tipo');
    const poblacionSelect = document.getElementById('nutricional-poblacion');
    const añoSelect = document.getElementById('nutricional-año');
    const regionSelect = document.getElementById('nutricional-region');
    
    if (añoSelect.options.length <= 1) {
        const añosRes = await fetch('/api/años');
        const años = await añosRes.json();
        añoSelect.innerHTML = '<option value="TODOS">Todos los Años</option>';
        años.forEach(a => { añoSelect.innerHTML += `<option value="${a}">${a}</option>`; });
        
        const regionesRes = await fetch('/api/regiones');
        const regiones = await regionesRes.json();
        regionSelect.innerHTML = '<option value="TODOS">Todas las Regiones</option>';
        regiones.forEach(r => { regionSelect.innerHTML += `<option value="${r}">${r}</option>`; });
    }
    
    tipoSelect.onchange = loadAnalisisNutricional;
    poblacionSelect.onchange = loadAnalisisNutricional;
    añoSelect.onchange = loadAnalisisNutricional;
    regionSelect.onchange = loadAnalisisNutricional;
    
    const tipo = tipoSelect.value;
    const poblacion = poblacionSelect.value;
    const año = añoSelect.value;
    const region = regionSelect.value;
    
    await loadChartDistribucion(tipo, poblacion, año, region);
    await loadChartTop5(tipo, poblacion, año);
}

async function loadChartDistribucion(tipo, poblacion, año, region) {
    try {
        const response = await fetch(`/api/nutricional/distribucion?tipo=${tipo}&año=${año}&region=${region}&poblacion=${poblacion}`);
        const data = await response.json();
        
        const ctx = document.getElementById('chart-distribucion').getContext('2d');
        if (chartDistribucion) chartDistribucion.destroy();
        
        const labels = [], values = [], colors = [];
        
        if (tipo === 'ninos' || tipo === 'ambos') {
            labels.push('Desnutrición', 'Riesgo', 'Adecuado', 'Sobrepeso', 'Obesidad');
            values.push(data.desnutricion, data.riesgo_desnutricion, data.adecuado, data.sobrepeso, data.obesidad);
            colors.push('#c0392b', '#e67e22', '#27ae60', '#f39c12', '#9b59b6');
        }
        if (tipo === 'embarazadas') {
            labels.length = 0; values.length = 0; colors.length = 0;
            labels.push('Bajo Peso', 'Adecuado', 'Sobrepeso', 'Obesidad');
            values.push(data.bajo_peso, data.adecuado, data.sobrepeso, data.obesidad);
            colors.push('#e74c3c', '#27ae60', '#f39c12', '#9b59b6');
        }
        
        chartDistribucion = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff' } } } }
        });
    } catch (error) {
        console.error('Error loading chart distribucion:', error);
    }
}

async function loadChartTop5(tipo, poblacion, año) {
    try {
        const response = await fetch(`/api/nutricional/top5?tipo=${tipo}&año=${año}&poblacion=${poblacion}`);
        const data = await response.json();
        
        const ctx = document.getElementById('chart-top5').getContext('2d');
        if (chartTop5) chartTop5.destroy();
        
        const labels = data.map(d => d.region);
        const values = data.map(d => d.porcentaje);
        
        chartTop5 = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '% ' + (data[0]?.indicador || 'Casos'),
                    data: values,
                    backgroundColor: values.map(v => v > 20 ? '#e74c3c' : (v > 10 ? '#f39c12' : '#27ae60'))
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { ticks: { color: '#fff' }, grid: { display: false } }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });
    } catch (error) {
        console.error('Error loading chart top5:', error);
    }
}