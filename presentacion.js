// presentacion.js - Modo Presentación Interactivo PANI (con filtro de población)

const presentationState = {
    regions: [
        'CONCEPCIÓN', 'SAN PEDRO', 'CORDILLERA', 'GUAIRÁ', 'CAAGUAZÚ',
        'CAAZAPÁ', 'ITAPÚA', 'MISIONES', 'PARAGUARÍ', 'ALTO PARANÁ',
        'CENTRAL', 'ÑEEMBUCÚ', 'AMAMBAY', 'CANINDEYÚ', 'PRESIDENTE HAYES',
        'BOQUERÓN', 'ALTO PARAGUAY', 'CAPITAL'
    ],
    currentIndex: 0,
    isActive: true,
    timer: null,
    countdownTimer: null,
    countdownValue: 5,
    dataNinos: {},
    dataEmbarazadas: {},
    dataCe: {},
    dataAlertas: {},
    geoJsonLayer: null,
    depositoData: {},
    mapInstance: null,
    poblacionTotales: { latino: {}, indigena: {} },
    regionColors: {
        'PARAGUARÍ': '#e74c3c', 'MISIONES': '#3498db', 'ITAPÚA': '#2ecc71',
        'ALTO PARAGUAY': '#9b59b6', 'BOQUERÓN': '#f39c12', 'PRESIDENTE HAYES': '#1abc9c',
        'CANINDEYÚ': '#e67e22', 'AMAMBAY': '#34495e', 'ÑEEMBUCÚ': '#c0392b',
        'CAAZAPÁ': '#16a085', 'CENTRAL': '#8e44ad', 'CAAGUAZÚ': '#f1c40f',
        'GUAIRÁ': '#d35400', 'ALTO PARANÁ': '#27ae60', 'CORDILLERA': '#2980b9',
        'SAN PEDRO': '#e91e63', 'CONCEPCIÓN': '#00bcd4', 'CAPITAL': '#2c3e50'
    },
    totals: {
        asistidos: 0,
        seguimiento: 0,
        finalizados: 0
    }
};

let currentFilters = {
    tipo: 'ninos',
    año: 'TODOS',
    mes: 'TODOS',
    poblacion: 'GLOBAL'
};

const tipoOptions = {
    'ninos': { label: 'Niños/as' },
    'embarazadas': { label: 'Embarazadas' },
    'ce': { label: 'Casos Excepcionales' },
    'todos': { label: 'Total País' }
};

const poblacionLabels = {
    'GLOBAL': 'Global',
    'LATINO': 'Latino',
    'INDIGENA': 'Indígena'
};

async function initPresentation() {
    const savedTheme = localStorage.getItem('presentation-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    document.getElementById('stop-presentation').addEventListener('click', stopPresentation);
    
    const savedFilters = localStorage.getItem('presentation-filtros');
    if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        currentFilters.año = filters.año || 'TODOS';
        currentFilters.tipo = filters.tipo || 'ninos';
        currentFilters.mes = filters.mes || 'TODOS';
        currentFilters.poblacion = filters.poblacion || 'GLOBAL';
    }
    localStorage.removeItem('presentation-filtros');
    
    initMap();
    document.addEventListener('theme-changed', updateMapTiles);
    await loadAllData();
    calculateTotals();
    updateFilterIndicator();
    updatePoblacionVisibility();
    setupControls();
    startPresentationCycle();
    startCountdown();
}

// ========== FUNCIÓN PARA OCULTAR/MOSTRAR TARJETAS SEGÚN POBLACIÓN ==========
function updatePoblacionVisibility() {
    const statBoxLatino = document.getElementById('stat-box-latino');
    const statBoxIndigena = document.getElementById('stat-box-indigena');
    const poblacion = currentFilters.poblacion;
    
    if (poblacion === 'LATINO') {
        if (statBoxLatino) statBoxLatino.style.display = 'block';
        if (statBoxIndigena) statBoxIndigena.style.display = 'none';
    } else if (poblacion === 'INDIGENA') {
        if (statBoxLatino) statBoxLatino.style.display = 'none';
        if (statBoxIndigena) statBoxIndigena.style.display = 'block';
    } else {
        if (statBoxLatino) statBoxLatino.style.display = 'block';
        if (statBoxIndigena) statBoxIndigena.style.display = 'block';
    }
}

function initMap() {
    presentationState.mapInstance = L.map('presentation-map').setView([-23.5, -58.0], 6);
    updateMapTiles();
}

function updateMapTiles() {
    if (!presentationState.mapInstance) return;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    presentationState.mapInstance.eachLayer(layer => {
        if (layer instanceof L.TileLayer) presentationState.mapInstance.removeLayer(layer);
    });
    if (currentTheme === 'dark') {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20
        }).addTo(presentationState.mapInstance);
    } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(presentationState.mapInstance);
    }
}

async function loadAllData() {
    const { año, mes, poblacion } = currentFilters;
    try {
        const ninosResponse = await fetch(`/api/ninos/resumen?año=${año}&mes=${mes}&region=TODOS&poblacion=${poblacion}`);
        const ninosData = await ninosResponse.json();
        presentationState.dataNinos = {};
        ninosData.forEach(item => { presentationState.dataNinos[item.REGION] = item; });
        
        const embarazadasResponse = await fetch(`/api/embarazadas/resumen?año=${año}&mes=${mes}&region=TODOS&poblacion=${poblacion}`);
        const embarazadasData = await embarazadasResponse.json();
        presentationState.dataEmbarazadas = {};
        embarazadasData.forEach(item => { presentationState.dataEmbarazadas[item.REGION] = item; });
        
        const ceResponse = await fetch(`/api/ce/resumen?año=${año}&mes=${mes}&region=TODOS&poblacion=${poblacion}`);
        const ceData = await ceResponse.json();
        presentationState.dataCe = {};
        ceData.forEach(item => { presentationState.dataCe[item.REGION] = item; });
        
        const alertasResponse = await fetch(`/api/alertas?año=${año}&mes=${mes}&poblacion=${poblacion}`);
        presentationState.dataAlertas = await alertasResponse.json();
        
        const depositoRes = await fetch(`/api/deposito?region=TODOS`);
        presentationState.depositoData = await depositoRes.json();
        
        // Load Latino/Indigena totals for all regions
        const pobRes = await fetch(`/api/poblacion/totales?año=${año}&mes=${mes}&region=TODOS&tipo=todos`);
        presentationState.poblacionTotales = await pobRes.json();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function getActiveDatasets() {
    switch (currentFilters.tipo) {
        case 'ninos': return [presentationState.dataNinos];
        case 'embarazadas': return [presentationState.dataEmbarazadas];
        case 'ce': return [presentationState.dataCe];
        default: return [presentationState.dataNinos, presentationState.dataEmbarazadas, presentationState.dataCe];
    }
}

function calculateTotals() {
    let totalAsistidos = 0, totalSeguimiento = 0, totalFinalizados = 0;
    getActiveDatasets().forEach(dataset => {
        Object.values(dataset).forEach(item => {
            totalAsistidos += item.TOTAL_ASISTIDO || 0;
            totalSeguimiento += item.SEGUIMIENTO || 0;
            totalFinalizados += item.FINALIZADOS || 0;
        });
    });
    presentationState.totals = { asistidos: totalAsistidos, seguimiento: totalSeguimiento, finalizados: totalFinalizados };
}

async function showRegion(index) {
    presentationState.currentIndex = index % presentationState.regions.length;
    if (presentationState.currentIndex < 0) presentationState.currentIndex = 0;
    
    const regionName = presentationState.regions[presentationState.currentIndex];
    document.getElementById('region-name').textContent = regionName;
    document.getElementById('region-color').style.backgroundColor = presentationState.regionColors[regionName] || '#95a5a6';
    
    const progress = ((presentationState.currentIndex + 1) / presentationState.regions.length) * 100;
    document.getElementById('progress-fill').style.width = progress + '%';
    document.getElementById('progress-text').textContent = `Región ${presentationState.currentIndex + 1} de ${presentationState.regions.length}`;
    
    await updateMapRegion(regionName);
    await updateRegionStats(regionName);
    resetCountdown();
}

function normalizeRegionName(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

async function updateMapRegion(regionName) {
    try {
        const response = await fetch('/regiones_paraguay.geojson');
        const geojson = await response.json();
        if (presentationState.geoJsonLayer) presentationState.mapInstance.removeLayer(presentationState.geoJsonLayer);
        
        const normalizedTargetName = normalizeRegionName(regionName);
        
        presentationState.geoJsonLayer = L.geoJson(geojson, {
            style: function(feature) {
                const normalizedFeatureName = normalizeRegionName(feature.properties.dpto_desc);
                const isTarget = normalizedFeatureName === normalizedTargetName;
                return {
                    fillColor: isTarget ? presentationState.regionColors[regionName] || '#e94560' : '#95a5a6',
                    weight: isTarget ? 3 : 1, opacity: isTarget ? 1 : 0.3,
                    color: isTarget ? '#fff' : '#2c3e50', fillOpacity: isTarget ? 0.9 : 0.2
                };
            }
        }).addTo(presentationState.mapInstance);
        
        geojson.features.forEach(feature => {
            if (normalizeRegionName(feature.properties.dpto_desc) === normalizedTargetName) {
                const layer = L.geoJson(feature);
                presentationState.mapInstance.fitBounds(layer.getBounds(), { padding: [50, 50] });
            }
        });
    } catch (error) {
        console.error('Error updating map:', error);
    }
}

async function updateRegionStats(regionName) {
    document.getElementById('stat-total-asistidos').textContent = presentationState.totals.asistidos.toLocaleString();
    document.getElementById('stat-total-seguimiento').textContent = presentationState.totals.seguimiento.toLocaleString();
    
    const normalizedTargetName = normalizeRegionName(regionName);
    
    let regionDataNinos = null, regionDataEmbarazadas = null, regionDataCe = null;
    
    const findRegionData = (dataObj) => {
        let result = dataObj[regionName];
        if (!result) {
            for (const key of Object.keys(dataObj)) {
                if (normalizeRegionName(key) === normalizedTargetName) { result = dataObj[key]; break; }
            }
        }
        return result;
    };
    
    regionDataNinos = findRegionData(presentationState.dataNinos);
    regionDataEmbarazadas = findRegionData(presentationState.dataEmbarazadas);
    regionDataCe = findRegionData(presentationState.dataCe);
    
    const tipo = currentFilters.tipo;
    const includeNinos = (tipo === 'ninos' || tipo === 'todos');
    const includeEmbarazadas = (tipo === 'embarazadas' || tipo === 'todos');
    const includeCe = (tipo === 'ce' || tipo === 'todos');
    
    const asistidos = (includeNinos ? (regionDataNinos?.TOTAL_ASISTIDO || 0) : 0) + 
                      (includeEmbarazadas ? (regionDataEmbarazadas?.TOTAL_ASISTIDO || 0) : 0) + 
                      (includeCe ? (regionDataCe?.TOTAL_ASISTIDO || 0) : 0);
    const seguimiento = (includeNinos ? (regionDataNinos?.SEGUIMIENTO || 0) : 0) + 
                        (includeEmbarazadas ? (regionDataEmbarazadas?.SEGUIMIENTO || 0) : 0) + 
                        (includeCe ? (regionDataCe?.SEGUIMIENTO || 0) : 0);
    const finalizados = (includeNinos ? (regionDataNinos?.FINALIZADOS || 0) : 0) + 
                        (includeEmbarazadas ? (regionDataEmbarazadas?.FINALIZADOS || 0) : 0) + 
                        (includeCe ? (regionDataCe?.FINALIZADOS || 0) : 0);
    const atrasos = (includeNinos ? (regionDataNinos?.ATRASOS || 0) : 0) + 
                    (includeEmbarazadas ? (regionDataEmbarazadas?.ATRASOS || 0) : 0) + 
                    (includeCe ? (regionDataCe?.ATRASOS || 0) : 0);
    const deserciones = (includeNinos ? (regionDataNinos?.DESERCIONES || 0) : 0) + 
                        (includeEmbarazadas ? (regionDataEmbarazadas?.DESERCIONES || 0) : 0) + 
                        (includeCe ? (regionDataCe?.DESERCIONES || 0) : 0);
    const traslados = (includeNinos ? ((regionDataNinos?.T_SALIDA || 0) + (regionDataNinos?.T_ENTRADA || 0)) : 0) + 
                      (includeEmbarazadas ? ((regionDataEmbarazadas?.T_SALIDA || 0) + (regionDataEmbarazadas?.T_ENTRADA || 0)) : 0) + 
                      (includeCe ? ((regionDataCe?.T_SALIDA || 0) + (regionDataCe?.T_ENTRADA || 0)) : 0);
    const nuevos = (includeNinos ? (regionDataNinos?.NUEVO_INGRESO || 0) : 0) + 
                   (includeEmbarazadas ? (regionDataEmbarazadas?.NUEVO_INGRESO || 0) : 0) + 
                   (includeCe ? (regionDataCe?.NUEVO_INGRESO || 0) : 0);
    
    document.getElementById('stat-asistidos').textContent = asistidos.toLocaleString();
    document.getElementById('stat-seguimiento').textContent = seguimiento.toLocaleString();
    document.getElementById('stat-finalizados').textContent = finalizados.toLocaleString();
    document.getElementById('stat-atrasos').textContent = atrasos.toLocaleString();
    document.getElementById('stat-deserciones').textContent = deserciones.toLocaleString();
    document.getElementById('stat-traslados').textContent = traslados.toLocaleString();
    document.getElementById('stat-nuevos').textContent = nuevos.toLocaleString();
    
    // Kilos
    let kilos = 0;
    for (const key of Object.keys(presentationState.depositoData)) {
        if (normalizeRegionName(key).includes(normalizedTargetName)) {
            kilos = presentationState.depositoData[key];
            break;
        }
    }
    document.getElementById('stat-kilos').textContent = (kilos || 0).toLocaleString();
    
    // Latino / Indígena
    try {
        const pobResponse = await fetch(`/api/poblacion/totales?año=${currentFilters.año}&mes=${currentFilters.mes}&region=${regionName}&tipo=todos`);
        const pobData = await pobResponse.json();
        document.getElementById('stat-latino').textContent = (pobData.latino?.total_asistido || 0).toLocaleString();
        document.getElementById('stat-indigena').textContent = (pobData.indigena?.total_asistido || 0).toLocaleString();
    } catch (e) {
        document.getElementById('stat-latino').textContent = '0';
        document.getElementById('stat-indigena').textContent = '0';
    }
    
    // Metas
    const metaNinos = regionDataNinos?.META || 0;
    const nuevoIngresoNinos = regionDataNinos?.NUEVO_INGRESO || 0;
    const pctMetaNinos = metaNinos > 0 ? Math.min(100, ((nuevoIngresoNinos / metaNinos) * 100)) : 0;
    
    const metaBarNinos = document.getElementById('meta-ninos-bar');
    metaBarNinos.style.width = pctMetaNinos + '%';
    metaBarNinos.textContent = pctMetaNinos.toFixed(0) + '%';
    metaBarNinos.className = 'meta-bar-fill ' + (pctMetaNinos >= 80 ? 'green' : pctMetaNinos >= 60 ? 'yellow' : 'red');
    
    const metaEmbarazadas = regionDataEmbarazadas?.META || 0;
    const nuevoIngresoEmbarazadas = regionDataEmbarazadas?.NUEVO_INGRESO || 0;
    const pctMetaEmbarazadas = metaEmbarazadas > 0 ? Math.min(100, ((nuevoIngresoEmbarazadas / metaEmbarazadas) * 100)) : 0;
    
    const metaBarEmbarazadas = document.getElementById('meta-embarazadas-bar');
    metaBarEmbarazadas.style.width = pctMetaEmbarazadas + '%';
    metaBarEmbarazadas.textContent = pctMetaEmbarazadas.toFixed(0) + '%';
    metaBarEmbarazadas.className = 'meta-bar-fill ' + (pctMetaEmbarazadas >= 80 ? 'green' : pctMetaEmbarazadas >= 60 ? 'yellow' : 'red');
    
    // Nutritional indicators
    updateNutritionIndicatorsNinos(regionDataNinos);
    updateNutritionIndicatorsEmbarazadas(regionDataEmbarazadas);
    updateNutritionIndicatorsCe(regionDataCe);
    applyTipoVisibility();
}

function applyTipoVisibility() {
    const tipo = currentFilters.tipo;
    const includeNinos = (tipo === 'ninos' || tipo === 'todos');
    const includeEmbarazadas = (tipo === 'embarazadas' || tipo === 'todos');
    const includeCe = (tipo === 'ce' || tipo === 'todos');
    
    const groupNinos = document.getElementById('group-ninos');
    const groupEmbarazadas = document.getElementById('group-embarazadas');
    const groupCe = document.getElementById('group-ce');
    const metaItemNinos = document.getElementById('meta-item-ninos');
    const metaItemEmbarazadas = document.getElementById('meta-item-embarazadas');
    
    if (groupNinos) groupNinos.style.display = includeNinos ? 'block' : 'none';
    if (groupEmbarazadas) groupEmbarazadas.style.display = includeEmbarazadas ? 'block' : 'none';
    if (groupCe) groupCe.style.display = includeCe ? 'block' : 'none';
    if (metaItemNinos) metaItemNinos.style.display = includeNinos ? 'flex' : 'none';
    if (metaItemEmbarazadas) metaItemEmbarazadas.style.display = includeEmbarazadas ? 'flex' : 'none';
}

function updateNutritionIndicatorsNinos(regionData) {
    if (!regionData) {
        ['bar-desnutricion-ninos', 'bar-riesgo-ninos', 'bar-adecuado-ninos'].forEach(id => {
            document.getElementById(id).style.width = '0%';
        });
        ['val-desnutricion-ninos', 'val-riesgo-ninos', 'val-adecuado-ninos'].forEach(id => {
            document.getElementById(id).textContent = '0';
        });
        return;
    }
    const total = (regionData.DESNUTRICION || 0) + (regionData.RIESGO_DESNUTRICION || 0) + (regionData.ADECUADO || 0);
    document.getElementById('bar-desnutricion-ninos').style.width = total > 0 ? ((regionData.DESNUTRICION / total) * 100) + '%' : '0%';
    document.getElementById('val-desnutricion-ninos').textContent = (regionData.DESNUTRICION || 0).toLocaleString();
    document.getElementById('bar-riesgo-ninos').style.width = total > 0 ? ((regionData.RIESGO_DESNUTRICION / total) * 100) + '%' : '0%';
    document.getElementById('val-riesgo-ninos').textContent = (regionData.RIESGO_DESNUTRICION || 0).toLocaleString();
    document.getElementById('bar-adecuado-ninos').style.width = total > 0 ? ((regionData.ADECUADO / total) * 100) + '%' : '0%';
    document.getElementById('val-adecuado-ninos').textContent = (regionData.ADECUADO || 0).toLocaleString();
}

function updateNutritionIndicatorsEmbarazadas(regionData) {
    if (!regionData) {
        ['bar-bajo-peso-embarazadas', 'bar-adecuado-embarazadas', 'bar-sobrepeso-embarazadas'].forEach(id => {
            document.getElementById(id).style.width = '0%';
        });
        ['val-bajo-peso-embarazadas', 'val-adecuado-embarazadas', 'val-sobrepeso-embarazadas'].forEach(id => {
            document.getElementById(id).textContent = '0';
        });
        return;
    }
    const total = (regionData.BAJO_PESO || 0) + (regionData.ADECUADO || 0) + (regionData.SOBREPESO || 0) + (regionData.OBESIDAD || 0);
    document.getElementById('bar-bajo-peso-embarazadas').style.width = total > 0 ? ((regionData.BAJO_PESO / total) * 100) + '%' : '0%';
    document.getElementById('val-bajo-peso-embarazadas').textContent = (regionData.BAJO_PESO || 0).toLocaleString();
    document.getElementById('bar-adecuado-embarazadas').style.width = total > 0 ? ((regionData.ADECUADO / total) * 100) + '%' : '0%';
    document.getElementById('val-adecuado-embarazadas').textContent = (regionData.ADECUADO || 0).toLocaleString();
    document.getElementById('bar-sobrepeso-embarazadas').style.width = total > 0 ? ((regionData.SOBREPESO / total) * 100) + '%' : '0%';
    document.getElementById('val-sobrepeso-embarazadas').textContent = (regionData.SOBREPESO || 0).toLocaleString();
}

function updateNutritionIndicatorsCe(regionData) {
    if (!regionData) {
        ['bar-nuevo-ingreso-ce', 'bar-seguimiento-ce', 'bar-finalizados-ce'].forEach(id => {
            document.getElementById(id).style.width = '0%';
        });
        ['val-nuevo-ingreso-ce', 'val-seguimiento-ce', 'val-finalizados-ce'].forEach(id => {
            document.getElementById(id).textContent = '0';
        });
        return;
    }
    const total = (regionData.NUEVO_INGRESO || 0) + (regionData.SEGUIMIENTO || 0) + (regionData.FINALIZADOS || 0);
    document.getElementById('bar-nuevo-ingreso-ce').style.width = total > 0 ? ((regionData.NUEVO_INGRESO / total) * 100) + '%' : '0%';
    document.getElementById('val-nuevo-ingreso-ce').textContent = (regionData.NUEVO_INGRESO || 0).toLocaleString();
    document.getElementById('bar-seguimiento-ce').style.width = total > 0 ? ((regionData.SEGUIMIENTO / total) * 100) + '%' : '0%';
    document.getElementById('val-seguimiento-ce').textContent = (regionData.SEGUIMIENTO || 0).toLocaleString();
    document.getElementById('bar-finalizados-ce').style.width = total > 0 ? ((regionData.FINALIZADOS / total) * 100) + '%' : '0%';
    document.getElementById('val-finalizados-ce').textContent = (regionData.FINALIZADOS || 0).toLocaleString();
}

function updateFilterIndicator() {
    const tipo = tipoOptions[currentFilters.tipo];
    const pob = poblacionLabels[currentFilters.poblacion];
    document.getElementById('filter-indicator').textContent = 
        `Tipo: ${tipo.label} | Población: ${pob} | Año: ${currentFilters.año} | Mes: ${currentFilters.mes}`;
}

function setupControls() {
    document.getElementById('stop-presentation').addEventListener('click', stopPresentation);
    
    const pauseBtn = document.getElementById('pause-presentation');
    pauseBtn.addEventListener('click', () => {
        if (presentationState.isActive) {
            clearInterval(presentationState.timer);
            presentationState.isActive = false;
            pauseBtn.textContent = 'REANUDAR PRESENTACIÓN';
            pauseBtn.style.background = 'linear-gradient(90deg, #27ae60, #2ecc71)';
        } else {
            startPresentationCycle();
            presentationState.isActive = true;
            pauseBtn.textContent = 'PAUSAR PRESENTACIÓN';
            pauseBtn.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
        }
    });
}

function startPresentationCycle() {
    if (presentationState.timer) clearInterval(presentationState.timer);
    presentationState.timer = setInterval(() => {
        showRegion(presentationState.currentIndex + 1);
    }, 5000);
}

function startCountdown() {
    if (presentationState.countdownTimer) clearInterval(presentationState.countdownTimer);
    presentationState.countdownTimer = setInterval(() => {
        presentationState.countdownValue--;
        if (presentationState.countdownValue <= 0) presentationState.countdownValue = 5;
        document.getElementById('countdown').textContent = presentationState.countdownValue;
    }, 1000);
}

function resetCountdown() {
    presentationState.countdownValue = 5;
    document.getElementById('countdown').textContent = '5';
}

function stopPresentation() {
    if (presentationState.timer) clearInterval(presentationState.timer);
    if (presentationState.countdownTimer) clearInterval(presentationState.countdownTimer);
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', initPresentation);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') stopPresentation();
    if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        const pauseBtn = document.getElementById('pause-presentation');
        if (pauseBtn) pauseBtn.click();
    }
});