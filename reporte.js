// =====================================================
// GENERADOR DE INFORMES PDF - VERSIÓN MEJORADA
// =====================================================

// Orden oficial de regiones sanitarias
const ORDEN_REGIONES = [
    'CONCEPCIÓN', 'SAN PEDRO', 'CORDILLERA', 'GUAIRÁ', 'CAAGUAZÚ',
    'CAAZAPÁ', 'ITAPÚA', 'MISIONES', 'PARAGUARÍ', 'ALTO PARANÁ',
    'CENTRAL', 'ÑEEMBUCÚ', 'AMAMBAY', 'CANINDEYÚ', 'PRESIDENTE HAYES',
    'BOQUERÓN', 'ALTO PARAGUAY', 'CAPITAL'
];

// Mapeo de nombres normalizados a nombres con tilde
const MAPEO_TILDES = {
    'CONCEPCION': 'CONCEPCIÓN', 'SAN PEDRO': 'SAN PEDRO', 'CORDILLERA': 'CORDILLERA',
    'GUAIRA': 'GUAIRÁ', 'CAAGUAZU': 'CAAGUAZÚ', 'CAAZAPA': 'CAAZAPÁ',
    'ITAPUA': 'ITAPÚA', 'MISIONES': 'MISIONES', 'PARAGUARI': 'PARAGUARÍ',
    'ALTO PARANA': 'ALTO PARANÁ', 'CENTRAL': 'CENTRAL', 'ÑEEMBUCU': 'ÑEEMBUCÚ',
    'NEEMBUCU': 'ÑEEMBUCÚ', 'AMAMBAY': 'AMAMBAY', 'CANINDEYU': 'CANINDEYÚ',
    'PRESIDENTE HAYES': 'PRESIDENTE HAYES', 'BOQUERON': 'BOQUERÓN',
    'ALTO PARAGUAY': 'ALTO PARAGUAY', 'CAPITAL': 'CAPITAL', 'ASUNCION': 'CAPITAL'
};

function normalizarNombreRegion(nombre) {
    if (!nombre) return '';
    return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function obtenerNombreConTilde(nombreNormalizado) {
    return MAPEO_TILDES[nombreNormalizado] || nombreNormalizado;
}

function ordenarRegiones(regiones) {
    return [...regiones].sort((a, b) => {
        const idxA = ORDEN_REGIONES.indexOf(obtenerNombreConTilde(normalizarNombreRegion(a)));
        const idxB = ORDEN_REGIONES.indexOf(obtenerNombreConTilde(normalizarNombreRegion(b)));
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
}

// ========== UTILIDADES DE FORMATO ==========
function formatearNumero(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('es-PY');
}

function formatearPorcentaje(num) {
    if (num === null || num === undefined) return '0.0%';
    return Number(num).toFixed(1) + '%';
}

// ========== MODAL DE CONFIGURACIÓN ==========
function abrirModalReporte() {
    const modal = document.getElementById('report-modal');
    const filtrosActuales = document.getElementById('report-current-filters');
    
    const tipo = document.getElementById('tipo-dato');
    const poblacion = document.getElementById('poblacion');
    const año = document.getElementById('año');
    const mes = document.getElementById('mes');
    const region = document.getElementById('region');
    
    const tipoTexto = tipo.options[tipo.selectedIndex]?.text || 'Todos';
    const poblacionTexto = poblacion.options[poblacion.selectedIndex]?.text || 'Global';
    const añoTexto = año.options[año.selectedIndex]?.text || 'Todos';
    const mesTexto = mes.options[mes.selectedIndex]?.text || 'Todos';
    const regionTexto = region.options[region.selectedIndex]?.text || 'Todas';
    
    filtrosActuales.textContent = `${tipoTexto} | ${poblacionTexto} | ${añoTexto} | ${mesTexto} | ${regionTexto}`;
    
    modal.classList.add('active');
}

function cerrarModalReporte() {
    document.getElementById('report-modal').classList.remove('active');
}

// ========== GENERACIÓN DEL PDF ==========
async function generarInformePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Obtener opciones seleccionadas
    const opciones = {
        resumen: document.getElementById('chk-resumen').checked,
        poblacion: document.getElementById('chk-poblacion').checked,
        nutricionalNinos: document.getElementById('chk-nutricional-ninos').checked,
        nutricionalEmbarazadas: document.getElementById('chk-nutricional-embarazadas').checked,
        metasNinos: document.getElementById('chk-metas-ninos').checked,
        metasEmbarazadas: document.getElementById('chk-metas-embarazadas').checked,
        alertas: document.getElementById('chk-alertas').checked,
        detalleRegiones: document.getElementById('chk-detalle-regiones').checked,
        totalesMensuales: document.getElementById('chk-totales-mensuales').checked
    };
    
    // Columnas del detalle por región
    const columnasDetalle = {
        totalAsist: document.getElementById('col-total-asist').checked,
        nuevos: document.getElementById('col-nuevos').checked,
        seguim: document.getElementById('col-seguim').checked,
        finaliz: document.getElementById('col-finaliz').checked,
        atrasos: document.getElementById('col-atrasos').checked,
        deserc: document.getElementById('col-deserc').checked,
        tSalida: document.getElementById('col-t-salida').checked,
        tEntrada: document.getElementById('col-t-entrada').checked
    };
    
    // Obtener filtros actuales
    const filtros = {
        tipo: document.getElementById('tipo-dato').value,
        poblacion: document.getElementById('poblacion').value,
        año: document.getElementById('año').value,
        mes: document.getElementById('mes').value,
        region: document.getElementById('region').value
    };
    
    // Textos de filtros para mostrar
    const tipoSelect = document.getElementById('tipo-dato');
    const pobSelect = document.getElementById('poblacion');
    const añoSelect = document.getElementById('año');
    const mesSelect = document.getElementById('mes');
    const regionSelect = document.getElementById('region');
    
    const filtrosTexto = {
        tipo: tipoSelect.options[tipoSelect.selectedIndex]?.text || 'Todos',
        poblacion: pobSelect.options[pobSelect.selectedIndex]?.text || 'Global',
        año: añoSelect.options[añoSelect.selectedIndex]?.text || 'Todos',
        mes: mesSelect.options[mesSelect.selectedIndex]?.text || 'Todos',
        region: regionSelect.options[regionSelect.selectedIndex]?.text || 'Todas'
    };
    
    let yPos = margin;
    
    // ===== ENCABEZADO PROFESIONAL (sin fondo azul, más compacto) =====
    doc.setTextColor(15, 52, 96);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PANEL DE COBERTURA Y DEPÓSITO', pageWidth / 2, yPos + 8, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Programa PANI - Paraguay', pageWidth / 2, yPos + 15, { align: 'center' });
    
    // Línea separadora delgada
    doc.setDrawColor(15, 52, 96);
    doc.setLineWidth(0.5);
    doc.line(margin + 40, yPos + 19, pageWidth - margin - 40, yPos + 19);
    
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Informe de Cobertura y Depósito', pageWidth / 2, yPos + 25, { align: 'center' });
    
    yPos += 35;
    
    // ===== FILTROS APLICADOS =====
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'F');
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'S');
    
    doc.setTextColor(15, 52, 96);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('FILTROS APLICADOS', margin + 5, yPos + 8);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    doc.text(`Tipo: ${filtrosTexto.tipo}`, margin + 5, yPos + 16);
    doc.text(`Población: ${filtrosTexto.poblacion}`, margin + 65, yPos + 16);
    doc.text(`Año: ${filtrosTexto.año}`, margin + 125, yPos + 16);
    doc.text(`Mes: ${filtrosTexto.mes}`, margin + 5, yPos + 23);
    doc.text(`Región: ${filtrosTexto.region}`, margin + 65, yPos + 23);
    
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-PY', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    })}`, margin + 125, yPos + 23);
    
    yPos += 35;
    
    // ===== RESUMEN GENERAL =====
    if (opciones.resumen) {
        if (yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
        yPos = agregarSeccionResumen(doc, margin, yPos, contentWidth, pageHeight);
    }
    
    // ===== POBLACIÓN INDÍGENA / LATINA =====
    if (opciones.poblacion) {
        yPos = await agregarSeccionPoblacion(doc, margin, yPos, contentWidth, pageHeight, filtros, filtrosTexto);
    }
    
    // ===== ESTADO NUTRICIONAL - NIÑOS =====
    if (opciones.nutricionalNinos) {
        yPos = await agregarSeccionNutricional(doc, margin, yPos, contentWidth, pageHeight, 
            'ninos', 'ESTADO NUTRICIONAL - NIÑOS/AS', '#9b59b6', filtros);
    }
    
    // ===== ESTADO NUTRICIONAL - EMBARAZADAS =====
    if (opciones.nutricionalEmbarazadas) {
        yPos = await agregarSeccionNutricional(doc, margin, yPos, contentWidth, pageHeight, 
            'embarazadas', 'ESTADO NUTRICIONAL - EMBARAZADAS', '#e67e22', filtros);
    }
    
    // ===== METAS - NIÑOS =====
    if (opciones.metasNinos) {
        yPos = await agregarSeccionMetas(doc, margin, yPos, contentWidth, pageHeight, 
            'ninos', 'METAS - NIÑOS/AS', '#9b59b6', filtros);
    }
    
    // ===== METAS - EMBARAZADAS =====
    if (opciones.metasEmbarazadas) {
        yPos = await agregarSeccionMetas(doc, margin, yPos, contentWidth, pageHeight, 
            'embarazadas', 'METAS - EMBARAZADAS', '#e67e22', filtros);
    }
    
    // ===== ALERTAS =====
    if (opciones.alertas) {
        yPos = await agregarSeccionAlertas(doc, margin, yPos, contentWidth, pageHeight, filtros);
    }
    
    // ===== DETALLE POR REGIÓN =====
    if (opciones.detalleRegiones) {
        yPos = await agregarDetalleRegiones(doc, margin, yPos, contentWidth, pageHeight, filtros, columnasDetalle);
    }
    
    // ===== TOTALES MENSUALES =====
    if (opciones.totalesMensuales) {
        yPos = await agregarTotalesMensuales(doc, margin, yPos, contentWidth, pageHeight, filtros);
    }
    
    // ===== PIE DE PÁGINA =====
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 249, 250);
        doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
        doc.setDrawColor(220, 220, 225);
        doc.setLineWidth(0.3);
        doc.line(0, pageHeight - 10, pageWidth, pageHeight - 10);
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`Panel de Cobertura - Programa PANI Paraguay`, margin, pageHeight - 4);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
    }
    
    // Guardar PDF
    doc.save(`Informe_PANI_${filtros.año}_${filtros.mes}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ========== SECCIÓN RESUMEN ==========
function agregarSeccionResumen(doc, margin, yPos, contentWidth, pageHeight) {
    // Título de sección
    doc.setFillColor(233, 69, 96);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN GENERAL', margin + 4, yPos + 5.5);
    yPos += 14;
    
    const totalAsistidos = document.getElementById('total-asistidos')?.textContent || '0';
    const totalSeguimiento = document.getElementById('total-seguimiento')?.textContent || '0';
    const totalFinalizados = document.getElementById('total-finalizados')?.textContent || '0';
    const totalAtrasos = document.getElementById('total-atrasos')?.textContent || '0';
    const totalDeserciones = document.getElementById('total-deserciones')?.textContent || '0';
    const tSalida = document.getElementById('t-salida')?.textContent || '0';
    const tEntrada = document.getElementById('t-entrada')?.textContent || '0';
    const ingresosNuevos = document.getElementById('ingresos-nuevos')?.textContent || '0';
    const kilos = document.getElementById('kilos-disponibles')?.textContent || '0';
    
    const resumenData = [
        ['Total Asistidos', totalAsistidos, 'Ingresos Nuevos', ingresosNuevos],
        ['Total Seguimiento', totalSeguimiento, 'Total Finalizados', totalFinalizados],
        ['Traslados Entrada', tEntrada, 'Traslados Salida', tSalida],
        ['Total Atrasos', totalAtrasos, 'Total Deserciones', totalDeserciones],
        ['Kilos Disponibles', kilos, '', '']
    ];
    
    const rowHeight = 8;
    
    resumenData.forEach((row, idx) => {
        const rowY = yPos + (idx * rowHeight);
        
        doc.setFillColor(idx % 2 === 0 ? 250 : 245, idx % 2 === 0 ? 250 : 245, idx % 2 === 0 ? 252 : 248);
        doc.rect(margin, rowY, contentWidth, rowHeight, 'F');
        
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(row[0], margin + 4, rowY + 5.5);
        
        doc.setTextColor(15, 52, 96);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(row[1], margin + 50, rowY + 5.5);
        
        if (row[2]) {
            doc.setTextColor(80, 80, 80);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.text(row[2], margin + 90, rowY + 5.5);
            
            doc.setTextColor(15, 52, 96);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(row[3], margin + 140, rowY + 5.5);
        }
        
        doc.setDrawColor(230, 230, 235);
        doc.setLineWidth(0.2);
        doc.line(margin, rowY + rowHeight, margin + contentWidth, rowY + rowHeight);
    });
    
    return yPos + (resumenData.length * rowHeight) + 10;
}

// ========== SECCIÓN POBLACIÓN ==========
async function agregarSeccionPoblacion(doc, margin, yPos, contentWidth, pageHeight, filtros, filtrosTexto) {
    if (yPos > pageHeight - 60) { doc.addPage(); yPos = margin; }
    
    // Título de sección
    doc.setFillColor(46, 204, 113);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('POBLACIÓN INDÍGENA / LATINA', margin + 4, yPos + 5.5);
    yPos += 14;
    
    // Verificar filtro de población
    const filtroPoblacion = filtros.poblacion;
    
    const totalLatino = document.getElementById('total-latino')?.textContent || '0';
    const latinoNuevos = document.getElementById('latino-nuevos')?.textContent || '0';
    const totalIndigena = document.getElementById('total-indigena')?.textContent || '0';
    const indigenaNuevos = document.getElementById('indigena-nuevos')?.textContent || '0';
    
    // Determinar qué filas mostrar según filtro
    let filas = [];
    
    if (filtroPoblacion === 'LATINO') {
        // Solo mostrar Latino
        filas = [
            ['Latino', totalLatino, latinoNuevos]
        ];
        
        // Nota informativa
        doc.setFillColor(255, 249, 230);
        doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'F');
        doc.setDrawColor(241, 196, 15);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'S');
        doc.setTextColor(180, 130, 0);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('⚠ Filtro de población activo: Mostrando únicamente datos de población LATINA', margin + 4, yPos + 6.5);
        yPos += 14;
        
    } else if (filtroPoblacion === 'INDIGENA') {
        // Solo mostrar Indígena
        filas = [
            ['Indígena', totalIndigena, indigenaNuevos]
        ];
        
        // Nota informativa
        doc.setFillColor(255, 249, 230);
        doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'F');
        doc.setDrawColor(241, 196, 15);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'S');
        doc.setTextColor(180, 130, 0);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('⚠ Filtro de población activo: Mostrando únicamente datos de población INDÍGENA', margin + 4, yPos + 6.5);
        yPos += 14;
        
    } else {
        // GLOBAL - mostrar ambas
        filas = [
            ['Latino', totalLatino, latinoNuevos],
            ['Indígena', totalIndigena, indigenaNuevos]
        ];
    }
    
    // Cabecera
    doc.setFillColor(240, 240, 245);
    doc.rect(margin, yPos, contentWidth, 8, 'F');
    doc.setTextColor(15, 52, 96);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Grupo Poblacional', margin + 4, yPos + 5.5);
    doc.text('Total Asistidos', margin + 70, yPos + 5.5);
    doc.text('Nuevos Ingresos', margin + 120, yPos + 5.5);
    yPos += 8;
    
    const rowHeight = 9;
    
    filas.forEach((row, idx) => {
        const rowY = yPos + (idx * rowHeight);
        doc.setFillColor(idx % 2 === 0 ? 250 : 245, idx % 2 === 0 ? 250 : 245, idx % 2 === 0 ? 252 : 248);
        doc.rect(margin, rowY, contentWidth, rowHeight, 'F');
        
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(row[0], margin + 4, rowY + 6);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 52, 96);
        doc.text(row[1], margin + 70, rowY + 6);
        doc.text(row[2], margin + 120, rowY + 6);
        
        doc.setDrawColor(230, 230, 235);
        doc.setLineWidth(0.2);
        doc.line(margin, rowY + rowHeight, margin + contentWidth, rowY + rowHeight);
    });
    
    // Fila de total si es GLOBAL
    if (filtroPoblacion === 'GLOBAL' && filas.length > 1) {
        const totalRowY = yPos + (filas.length * rowHeight);
        doc.setFillColor(46, 204, 113);
        doc.rect(margin, totalRowY, contentWidth, rowHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('TOTAL GLOBAL', margin + 4, totalRowY + 6);
        
        const totalAsist = (parseInt(totalLatino.replace(/[^\d]/g, '')) || 0) + 
                           (parseInt(totalIndigena.replace(/[^\d]/g, '')) || 0);
        const totalNuevos = (parseInt(latinoNuevos.replace(/[^\d]/g, '')) || 0) + 
                            (parseInt(indigenaNuevos.replace(/[^\d]/g, '')) || 0);
        
        doc.text(totalAsist.toLocaleString('es-PY'), margin + 70, totalRowY + 6);
        doc.text(totalNuevos.toLocaleString('es-PY'), margin + 120, totalRowY + 6);
        
        yPos += rowHeight;
    }
    
    return yPos + 20;
}

// ========== SECCIÓN NUTRICIONAL ==========
async function agregarSeccionNutricional(doc, margin, yPos, contentWidth, pageHeight, tipo, titulo, color, filtros) {
    if (yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
    
    // Título de sección
    doc.setFillColor(color);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, margin + 4, yPos + 5.5);
    yPos += 14;
    
    const endpoint = tipo === 'ninos' ? '/api/ninos/resumen' : '/api/embarazadas/resumen';
    const url = `${endpoint}?año=${filtros.año}&mes=${filtros.mes}&region=${filtros.region}&poblacion=${filtros.poblacion}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data || data.length === 0) {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text('No hay datos disponibles con los filtros seleccionados.', margin + 4, yPos + 4);
            return yPos + 15;
        }
        
        const regionesOrdenadas = ordenarRegiones(data.map(d => d.REGION));
        const dataOrdenada = regionesOrdenadas.map(r => 
            data.find(d => normalizarNombreRegion(d.REGION) === normalizarNombreRegion(r))
        ).filter(Boolean);
        
        let indicadores;
        if (tipo === 'ninos') {
            indicadores = [
                { key: 'DESNUTRICION', label: 'Desnutrición' },
                { key: 'RIESGO_DESNUTRICION', label: 'Riesgo Desnut.' },
                { key: 'ADECUADO', label: 'Adecuado' },
                { key: 'SOBREPESO', label: 'Sobrepeso' },
                { key: 'OBESIDAD', label: 'Obesidad' }
            ];
        } else {
            indicadores = [
                { key: 'BAJO_PESO', label: 'Bajo Peso' },
                { key: 'ADECUADO', label: 'Adecuado' },
                { key: 'SOBREPESO', label: 'Sobrepeso' },
                { key: 'OBESIDAD', label: 'Obesidad' }
            ];
        }
        
        const regionColWidth = 38;
        const indicadorColWidth = (contentWidth - regionColWidth) / indicadores.length;
        const rowHeight = 8;
        
        // Cabecera
        doc.setFillColor(240, 240, 245);
        doc.rect(margin, yPos, contentWidth, rowHeight + 2, 'F');
        doc.setTextColor(15, 52, 96);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Región', margin + 3, yPos + 6);
        
        indicadores.forEach((ind, idx) => {
            const xPos = margin + regionColWidth + (idx * indicadorColWidth);
            doc.text(ind.label, xPos + 2, yPos + 6);
        });
        yPos += rowHeight + 2;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        
        // Totales por indicador
        const totalesIndicadores = {};
        indicadores.forEach(ind => { totalesIndicadores[ind.key] = 0; });
        
        dataOrdenada.forEach((item, idx) => {
            if (yPos > pageHeight - 25) {
                doc.addPage();
                yPos = margin;
                doc.setFillColor(240, 240, 245);
                doc.rect(margin, yPos, contentWidth, rowHeight + 2, 'F');
                doc.setTextColor(15, 52, 96);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.text('Región', margin + 3, yPos + 6);
                indicadores.forEach((ind, i) => {
                    doc.text(ind.label, margin + regionColWidth + (i * indicadorColWidth) + 2, yPos + 6);
                });
                yPos += rowHeight + 2;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
            }
            
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 252);
                doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
            }
            
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text(obtenerNombreConTilde(normalizarNombreRegion(item.REGION)), margin + 3, yPos + 5.5);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            
            indicadores.forEach((ind, i) => {
                const valor = item[ind.key] || 0;
                totalesIndicadores[ind.key] += valor;
                const xPos = margin + regionColWidth + (i * indicadorColWidth) + 2;
                doc.text(formatearNumero(valor), xPos, yPos + 5.5);
            });
            
            doc.setDrawColor(230, 230, 235);
            doc.setLineWidth(0.2);
            doc.line(margin, yPos + rowHeight, margin + contentWidth, yPos + rowHeight);
            yPos += rowHeight;
        });
        
        // Fila de totales
        doc.setFillColor(color);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('TOTAL', margin + 3, yPos + 5.5);
        
        indicadores.forEach((ind, i) => {
            const xPos = margin + regionColWidth + (i * indicadorColWidth) + 2;
            doc.text(formatearNumero(totalesIndicadores[ind.key]), xPos, yPos + 5.5);
        });
        yPos += rowHeight + 8;
        
    } catch (error) {
        console.error('Error en sección nutricional:', error);
        doc.setTextColor(200, 50, 50);
        doc.setFontSize(9);
        doc.text('Error al cargar datos.', margin + 4, yPos + 4);
        yPos += 15;
    }
    
    return yPos + 10;
}

// ========== SECCIÓN METAS (sin columna Estado) ==========
async function agregarSeccionMetas(doc, margin, yPos, contentWidth, pageHeight, tipo, titulo, color, filtros) {
    if (yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
    
    doc.setFillColor(color);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, margin + 4, yPos + 5.5);
    yPos += 14;
    
    try {
        const url = `/api/metas?año=${filtros.año}&mes=${filtros.mes}&tipo=${tipo}&poblacion=${filtros.poblacion}&region=${filtros.region}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data || data.length === 0) {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text('No hay datos disponibles.', margin + 4, yPos + 4);
            return yPos + 15;
        }
        
        const regionesOrdenadas = ordenarRegiones(data.map(d => d.region));
        const dataOrdenada = regionesOrdenadas.map(r => 
            data.find(d => normalizarNombreRegion(d.region) === normalizarNombreRegion(r))
        ).filter(Boolean);
        
        // SIN columna de Estado
        const colWidths = [55, 35, 35, 40];
        const rowHeight = 8;
        
        doc.setFillColor(240, 240, 245);
        doc.rect(margin, yPos, contentWidth, rowHeight + 2, 'F');
        doc.setTextColor(15, 52, 96);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        
        let xPos = margin + 3;
        doc.text('Región', xPos, yPos + 6); xPos += colWidths[0];
        doc.text('Nuevo Ingreso', xPos, yPos + 6); xPos += colWidths[1];
        doc.text('Meta', xPos, yPos + 6); xPos += colWidths[2];
        doc.text('% Cumplimiento', xPos, yPos + 6);
        yPos += rowHeight + 2;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        
        // Totales
        let totalNuevo = 0, totalMeta = 0;
        
        dataOrdenada.forEach((item, idx) => {
            if (yPos > pageHeight - 25) {
                doc.addPage();
                yPos = margin;
                doc.setFillColor(240, 240, 245);
                doc.rect(margin, yPos, contentWidth, rowHeight + 2, 'F');
                doc.setTextColor(15, 52, 96);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                let hx = margin + 3;
                doc.text('Región', hx, yPos + 6); hx += colWidths[0];
                doc.text('Nuevo Ingreso', hx, yPos + 6); hx += colWidths[1];
                doc.text('Meta', hx, yPos + 6); hx += colWidths[2];
                doc.text('% Cumplimiento', hx, yPos + 6);
                yPos += rowHeight + 2;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
            }
            
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 252);
                doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
            }
            
            const pct = item.pct_cumplimiento || 0;
            totalNuevo += item.nuevo_ingreso || 0;
            totalMeta += item.meta || 0;
            
            let cx = margin + 3;
            
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text(obtenerNombreConTilde(normalizarNombreRegion(item.region)), cx, yPos + 5.5); cx += colWidths[0];
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(formatearNumero(item.nuevo_ingreso), cx, yPos + 5.5); cx += colWidths[1];
            doc.text(formatearNumero(item.meta), cx, yPos + 5.5); cx += colWidths[2];
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 52, 96);
            doc.text(formatearPorcentaje(pct), cx, yPos + 5.5);
            
            doc.setDrawColor(230, 230, 235);
            doc.setLineWidth(0.2);
            doc.line(margin, yPos + rowHeight, margin + contentWidth, yPos + rowHeight);
            yPos += rowHeight;
        });
        
        // Fila de totales
        doc.setFillColor(color);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        
        let tx = margin + 3;
        doc.text('TOTAL', tx, yPos + 5.5); tx += colWidths[0];
        doc.text(formatearNumero(totalNuevo), tx, yPos + 5.5); tx += colWidths[1];
        doc.text(formatearNumero(totalMeta), tx, yPos + 5.5); tx += colWidths[2];
        const pctTotal = totalMeta > 0 ? (totalNuevo / totalMeta * 100) : 0;
        doc.text(formatearPorcentaje(pctTotal), tx, yPos + 5.5);
        
        yPos += rowHeight + 8;
        
    } catch (error) {
        console.error('Error en sección metas:', error);
        doc.setTextColor(200, 50, 50);
        doc.setFontSize(9);
        doc.text('Error al cargar datos.', margin + 4, yPos + 4);
        yPos += 15;
    }
    
    return yPos + 10;
}

// ========== SECCIÓN ALERTAS ==========
async function agregarSeccionAlertas(doc, margin, yPos, contentWidth, pageHeight, filtros) {
    if (yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
    
    doc.setFillColor(231, 76, 60);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INDICADORES DE ALERTA', margin + 4, yPos + 5.5);
    yPos += 14;
    
    try {
        const url = `/api/alertas?año=${filtros.año}&mes=${filtros.mes}&poblacion=${filtros.poblacion}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data || data.length === 0) {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text('No hay datos disponibles.', margin + 4, yPos + 4);
            return yPos + 15;
        }
        
        data.sort((a, b) => b.overall_alert - a.overall_alert);
        
        const cardWidth = (contentWidth - 6) / 2;
        const cardHeight = 36;
        let col = 0;
        
        data.forEach((item, idx) => {
            if (yPos > pageHeight - cardHeight - 15) {
                doc.addPage();
                yPos = margin;
                col = 0;
            }
            
            const xPos = margin + (col * (cardWidth + 6));
            const cardY = yPos;
            
            const alertColor = item.overall_alert === 2 ? [231, 76, 60] : 
                              (item.overall_alert === 1 ? [241, 196, 15] : [39, 174, 96]);
            
            doc.setFillColor(250, 250, 252);
            doc.roundedRect(xPos, cardY, cardWidth, cardHeight, 2, 2, 'F');
            doc.setDrawColor(230, 230, 235);
            doc.setLineWidth(0.2);
            doc.roundedRect(xPos, cardY, cardWidth, cardHeight, 2, 2, 'S');
            
            doc.setFillColor(...alertColor);
            doc.roundedRect(xPos, cardY, 3, cardHeight, 1, 1, 'F');
            
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.text(obtenerNombreConTilde(normalizarNombreRegion(item.region)), xPos + 5, cardY + 7);
            
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            
            const indicadores = [
                { label: 'Desnutrición', value: item.desnutricion, pct: item.pct_desnutricion },
                { label: 'Riesgo', value: item.riesgo, pct: item.pct_riesgo },
                { label: 'Atrasos', value: item.atrasos, pct: item.pct_atrasos }
            ];
            
            indicadores.forEach((ind, i) => {
                const iy = cardY + 14 + (i * 7);
                doc.setTextColor(100, 100, 100);
                doc.text(`${ind.label}:`, xPos + 5, iy);
                
                doc.setTextColor(40, 40, 40);
                doc.setFont('helvetica', 'bold');
                doc.text(`${formatearNumero(ind.value)} (${formatearPorcentaje(ind.pct)})`, xPos + 40, iy);
                doc.setFont('helvetica', 'normal');
            });
            
            col++;
            if (col >= 2) {
                col = 0;
                yPos += cardHeight + 5;
            }
        });
        
        if (col === 1) yPos += cardHeight + 5;
        yPos += 8;
        
    } catch (error) {
        console.error('Error en sección alertas:', error);
        doc.setTextColor(200, 50, 50);
        doc.setFontSize(9);
        doc.text('Error al cargar datos.', margin + 4, yPos + 4);
        yPos += 15;
    }
    
    return yPos + 10;
}

// ========== DETALLE POR REGIÓN (con columnas dinámicas y totales) ==========
async function agregarDetalleRegiones(doc, margin, yPos, contentWidth, pageHeight, filtros, columnasDetalle) {
    if (yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
    
    doc.setFillColor(52, 73, 94);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE POR REGIÓN', margin + 4, yPos + 5.5);
    yPos += 14;
    
    try {
        const todasColumnas = [
            { id: 'totalAsist', key: 'TOTAL_ASISTIDO', label: 'Total Asist.' },
            { id: 'nuevos', key: 'NUEVO_INGRESO', label: 'Nuevos' },
            { id: 'seguim', key: 'SEGUIMIENTO', label: 'Seguim.' },
            { id: 'finaliz', key: 'FINALIZADOS', label: 'Finaliz.' },
            { id: 'atrasos', key: 'ATRASOS', label: 'Atrasos' },
            { id: 'deserc', key: 'DESERCIONES', label: 'Deserc.' },
            { id: 'tSalida', key: 'T_SALIDA', label: 'T. Salida' },
            { id: 'tEntrada', key: 'T_ENTRADA', label: 'T. Entrada' }
        ];
        
        const columnasActivas = todasColumnas.filter(col => columnasDetalle[col.id]);
        
        let data = [];
        
        if (filtros.tipo === 'todos') {
            const [ninosData, embarazadasData, ceData] = await Promise.all([
                fetch(`/api/ninos/resumen?año=${filtros.año}&mes=${filtros.mes}&region=${filtros.region}&poblacion=${filtros.poblacion}`).then(r => r.json()),
                fetch(`/api/embarazadas/resumen?año=${filtros.año}&mes=${filtros.mes}&region=${filtros.region}&poblacion=${filtros.poblacion}`).then(r => r.json()),
                fetch(`/api/ce/resumen?año=${filtros.año}&mes=${filtros.mes}&region=${filtros.region}&poblacion=${filtros.poblacion}`).then(r => r.json())
            ]);
            
            const combined = {};
            const agregarDatos = (items) => {
                items.forEach(item => {
                    const regionKey = normalizarNombreRegion(item.REGION);
                    if (!combined[regionKey]) {
                        combined[regionKey] = { REGION: item.REGION };
                        columnasActivas.forEach(col => {
                            combined[regionKey][col.key] = 0;
                        });
                    }
                    columnasActivas.forEach(col => {
                        combined[regionKey][col.key] += (item[col.key] || 0);
                    });
                });
            };
            
            agregarDatos(ninosData);
            agregarDatos(embarazadasData);
            agregarDatos(ceData);
            
            data = Object.values(combined);
        } else {
            let endpoint;
            if (filtros.tipo === 'ninos') endpoint = '/api/ninos/resumen';
            else if (filtros.tipo === 'embarazadas') endpoint = '/api/embarazadas/resumen';
            else if (filtros.tipo === 'ce') endpoint = '/api/ce/resumen';
            
            const url = `${endpoint}?año=${filtros.año}&mes=${filtros.mes}&region=${filtros.region}&poblacion=${filtros.poblacion}`;
            const response = await fetch(url);
            data = await response.json();
        }
        
        if (!data || data.length === 0) {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text('No hay datos disponibles.', margin + 4, yPos + 4);
            return yPos + 15;
        }
        
        if (columnasActivas.length === 0) {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text('No se seleccionaron columnas para mostrar.', margin + 4, yPos + 4);
            return yPos + 15;
        }
        
        const regionesOrdenadas = ordenarRegiones(data.map(d => d.REGION));
        const dataOrdenada = regionesOrdenadas.map(r => 
            data.find(d => normalizarNombreRegion(d.REGION) === normalizarNombreRegion(r))
        ).filter(Boolean);
        
        const regionColWidth = 32;
        const colWidth = (contentWidth - regionColWidth) / columnasActivas.length;
        const rowHeight = 7.5;
        
        // Cabecera
        doc.setFillColor(240, 240, 245);
        doc.rect(margin, yPos, contentWidth, rowHeight + 2, 'F');
        doc.setTextColor(15, 52, 96);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Región', margin + 2, yPos + 6);
        
        columnasActivas.forEach((col, idx) => {
            const xPos = margin + regionColWidth + (idx * colWidth);
            doc.text(col.label, xPos + 1, yPos + 6);
        });
        yPos += rowHeight + 2;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        
        // Totales por columna
        const totales = {};
        columnasActivas.forEach(col => { totales[col.key] = 0; });
        
        dataOrdenada.forEach((item, idx) => {
            if (yPos > pageHeight - 20) {
                doc.addPage();
                yPos = margin;
                doc.setFillColor(240, 240, 245);
                doc.rect(margin, yPos, contentWidth, rowHeight + 2, 'F');
                doc.setTextColor(15, 52, 96);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.text('Región', margin + 2, yPos + 6);
                columnasActivas.forEach((col, i) => {
                    doc.text(col.label, margin + regionColWidth + (i * colWidth) + 1, yPos + 6);
                });
                yPos += rowHeight + 2;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
            }
            
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 252);
                doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
            }
            
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text(obtenerNombreConTilde(normalizarNombreRegion(item.REGION)), margin + 2, yPos + 5);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            
            columnasActivas.forEach((col, i) => {
                const valor = item[col.key] || 0;
                totales[col.key] += valor;
                const xPos = margin + regionColWidth + (i * colWidth) + 1;
                doc.text(formatearNumero(valor), xPos, yPos + 5);
            });
            
            doc.setDrawColor(230, 230, 235);
            doc.setLineWidth(0.2);
            doc.line(margin, yPos + rowHeight, margin + contentWidth, yPos + rowHeight);
            yPos += rowHeight;
        });
        
        // Fila de totales
        doc.setFillColor(52, 73, 94);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('TOTAL', margin + 2, yPos + 5);
        
        columnasActivas.forEach((col, i) => {
            const xPos = margin + regionColWidth + (i * colWidth) + 1;
            doc.text(formatearNumero(totales[col.key]), xPos, yPos + 5);
        });
        yPos += rowHeight + 8;
        
    } catch (error) {
        console.error('Error en detalle por región:', error);
        doc.setTextColor(200, 50, 50);
        doc.setFontSize(9);
        doc.text('Error al cargar datos.', margin + 4, yPos + 4);
        yPos += 15;
    }
    
    return yPos + 10;
}

// ========== TOTALES MENSUALES ==========
async function agregarTotalesMensuales(doc, margin, yPos, contentWidth, pageHeight, filtros) {
    if (yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
    
    doc.setFillColor(41, 128, 185);
    doc.roundedRect(margin, yPos, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTALES MENSUALES DE ASISTIDOS', margin + 4, yPos + 5.5);
    yPos += 14;
    
    try {
        const url = `/api/totales-mensuales?año=${filtros.año}&mes=${filtros.mes}&poblacion=${filtros.poblacion}&region=${filtros.region}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data || !data.datos || data.datos.length === 0) {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text('No hay datos disponibles.', margin + 4, yPos + 4);
            return yPos + 15;
        }
        
        const meses = data.datos;
        const totales = data.totales;
        
        const colWidths = [22, 40, 42, 38, 38];
        const rowHeight = 6.5;
        const headerHeight = rowHeight + 2;
        
        const headers = ['Mes', 'Niños/as', 'Embarazadas', 'Casos Exc.', 'Total'];
        
        doc.setFillColor(240, 240, 245);
        doc.rect(margin, yPos, contentWidth, headerHeight, 'F');
        doc.setTextColor(15, 52, 96);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        
        let xPos = margin + 2;
        headers.forEach((h, i) => {
            doc.text(h, xPos, yPos + 6);
            xPos += colWidths[i];
        });
        yPos += headerHeight;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        
        const totalesColumna = [0, 0, 0, 0];
        
        meses.forEach((item, idx) => {
            if (yPos > pageHeight - 20) {
                doc.addPage();
                yPos = margin;
                doc.setFillColor(240, 240, 245);
                doc.rect(margin, yPos, contentWidth, headerHeight, 'F');
                doc.setTextColor(15, 52, 96);
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'bold');
                xPos = margin + 2;
                headers.forEach((h, i) => {
                    doc.text(h, xPos, yPos + 6);
                    xPos += colWidths[i];
                });
                yPos += headerHeight;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
            }
            
            if (idx % 2 === 0) {
                doc.setFillColor(250, 250, 252);
                doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
            }
            
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text(item.mes, margin + 2, yPos + 5);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            
            const valores = [item.ninos, item.embarazadas, item.ce, item.total];
            xPos = margin + colWidths[0] + 2;
            valores.forEach((val, i) => {
                totalesColumna[i] += val;
                doc.text(formatearNumero(val), xPos, yPos + 5);
                xPos += colWidths[i + 1];
            });
            
            doc.setDrawColor(230, 230, 235);
            doc.setLineWidth(0.2);
            doc.line(margin, yPos + rowHeight, margin + contentWidth, yPos + rowHeight);
            yPos += rowHeight;
        });
        
        doc.setFillColor(52, 73, 94);
        doc.rect(margin, yPos, contentWidth, rowHeight + 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        
        xPos = margin + 2;
        doc.text('TOTAL', xPos, yPos + 5); xPos += colWidths[0];
        doc.text(formatearNumero(totales.ninos), xPos, yPos + 5); xPos += colWidths[1];
        doc.text(formatearNumero(totales.embarazadas), xPos, yPos + 5); xPos += colWidths[2];
        doc.text(formatearNumero(totales.ce), xPos, yPos + 5); xPos += colWidths[3];
        doc.text(formatearNumero(totales.total), xPos, yPos + 5);
        yPos += rowHeight + 8;
        
    } catch (error) {
        console.error('Error en totales mensuales:', error);
        doc.setTextColor(200, 50, 50);
        doc.setFontSize(9);
        doc.text('Error al cargar datos.', margin + 4, yPos + 4);
        yPos += 15;
    }
    
    return yPos + 10;
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    const btnGenerate = document.getElementById('generate-report');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', abrirModalReporte);
    }
    
    const btnClose = document.getElementById('report-modal-close');
    if (btnClose) {
        btnClose.addEventListener('click', cerrarModalReporte);
    }
    
    const btnCancel = document.getElementById('btn-cancel-report');
    if (btnCancel) {
        btnCancel.addEventListener('click', cerrarModalReporte);
    }
    
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) cerrarModalReporte();
        });
    }
    
    // Mostrar/ocultar sub-opciones de columnas
    const chkDetalle = document.getElementById('chk-detalle-regiones');
    const columnasOptions = document.getElementById('detalle-columnas-options');
    if (chkDetalle && columnasOptions) {
        chkDetalle.addEventListener('change', function() {
            columnasOptions.style.display = this.checked ? 'block' : 'none';
        });
    }
    
    const btnGeneratePdf = document.getElementById('btn-generate-report');
    if (btnGeneratePdf) {
        btnGeneratePdf.addEventListener('click', async function() {
            this.disabled = true;
            this.innerHTML = '<span class="btn-icon">⏳</span> Generando...';
            
            try {
                await generarInformePDF();
                cerrarModalReporte();
            } catch (error) {
                console.error('Error al generar PDF:', error);
                alert('Error al generar el informe. Por favor, intente nuevamente.');
            } finally {
                this.disabled = false;
                this.innerHTML = '<span class="btn-icon">📥</span> Generar PDF';
            }
        });
    }
});