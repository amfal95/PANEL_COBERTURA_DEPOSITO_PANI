#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor API para el Panel de Cobertura de Paraguay
Serve data from basepani.db to HTML/JavaScript frontend
"""

from flask import Flask, jsonify, request, send_from_directory, Response
import sqlite3
import json
from collections import OrderedDict
import os

app = Flask(__name__, static_folder='.', static_url_path='')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'basepani.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def dict_from_row(row):
    return dict(row)

def normalizar_region(region):
    if not region:
        return region
    normalizada = region.upper()
    replacements = {'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U'}
    for accented, plain in replacements.items():
        normalizada = normalizada.replace(accented, plain)
    return normalizada

def agregar_filtro_region(query, params, region):
    if region and region != 'TODOS':
        region_norm = normalizar_region(region)
        query += ' AND (UPPER(REGION) = UPPER(?) OR UPPER(REGION) = UPPER(?) OR UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REGION, "Á", "A"), "É", "E"), "Í", "I"), "Ó", "O"), "Ú", "U"), "Ñ", "N")) = UPPER(?))'
        params.append(region)
        params.append(region_norm)
        params.append(region_norm)
    return query, params

def agregar_filtro_poblacion(query, params, poblacion):
    """Add population filter to query. GLOBAL = no filter (suma todo)"""
    if poblacion and poblacion != 'GLOBAL':
        query += ' AND UPPER(POBLACION) = UPPER(?)'
        params.append(poblacion)
    return query, params

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(BASE_DIR, filename)

@app.route('/api/regiones', methods=['GET'])
def get_regiones():
    orden_regiones = [
        'CONCEPCION', 'SAN PEDRO', 'CORDILLERA', 'GUAIRA', 'CAAGUAZU',
        'CAAZAPA', 'ITAPUA', 'MISIONES', 'PARAGUARI', 'ALTO PARANA',
        'CENTRAL', 'ÑEEMBUCU', 'AMAMBAY', 'CANINDEYU', 'PRESIDENTE HAYES',
        'BOQUERON', 'ALTO PARAGUAY', 'CAPITAL'
    ]
    normalizar = {'�EEMBUCU': 'ÑEEMBUCU', 'NEEMBUCU': 'ÑEEMBUCU'}
    mostrar_tildes = {
        'CONCEPCION': 'CONCEPCIÓN', 'GUAIRA': 'GUAIRÁ', 'CAAGUAZU': 'CAAGUAZÚ',
        'CAAZAPA': 'CAAZAPÁ', 'ITAPUA': 'ITAPÚA', 'PARAGUARI': 'PARAGUARÍ',
        'ALTO PARANA': 'ALTO PARANÁ', 'ÑEEMBUCU': 'ÑEEMBUCÚ', 'CANINDEYU': 'CANINDEYÚ',
        'BOQUERON': 'BOQUERÓN', 'CAPITAL': 'CAPITAL', 'ASUNCION': 'CAPITAL'
    }
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT REGION FROM NIÑOS')
    regiones_db = [row[0] for row in cursor.fetchall()]
    conn.close()
    regiones_normalizadas = []
    for r in regiones_db:
        r_normalizada = normalizar.get(r, r)
        r_mostrar = mostrar_tildes.get(r_normalizada, r_normalizada)
        regiones_normalizadas.append((r, r_normalizada, r_mostrar))
    regiones_ordenadas = sorted(regiones_normalizadas, key=lambda x: orden_regiones.index(x[1]) if x[1] in orden_regiones else 999)
    regiones = [x[2] for x in regiones_ordenadas]
    return Response(json.dumps(regiones, ensure_ascii=False), mimetype='application/json')

@app.route('/api/años', methods=['GET'])
def get_años():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT AÑO FROM NIÑOS ORDER BY AÑO DESC')
    años = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify(años)

@app.route('/api/meses', methods=['GET'])
def get_meses():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT MES FROM NIÑOS ORDER BY MES')
    meses = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify(meses)

@app.route('/api/ninos/resumen', methods=['GET'])
def get_ninos_resumen():
    """Get summary of children data by region.
    
    IMPORTANTE:
    - Los datos de NIÑOS se filtran por año, mes y población (GLOBAL suma LATINO + INDIGENA)
    - La META se obtiene de META_NIÑOS aplicando los MISMOS filtros de año y mes
    - Si no se filtra por mes, se suman las metas de todos los meses (comportamiento acumulado)
    """
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # ===== 1. Datos de NIÑOS (filtrados por población, año, mes) =====
    query = '''
        SELECT 
            REGION,
            SUM(DESNUTRICION) as DESNUTRICION,
            SUM("RIESGO DESNUTRICION") as RIESGO_DESNUTRICION,
            SUM(ADECUADO) as ADECUADO,
            SUM(SOBREPESO) as SOBREPESO,
            SUM(OBESIDAD) as OBESIDAD,
            SUM(SEGUIMIENTO) as SEGUIMIENTO,
            SUM(FINALIZADOS) as FINALIZADOS,
            SUM(ATRASOS) as ATRASOS,
            SUM(DESERCIONES) as DESERCIONES,
            SUM(T_SALIDA) as T_SALIDA,
            SUM(T_ENTRADA) as T_ENTRADA,
            SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO,
            SUM(NUEVO_INGRESO) as NUEVO_INGRESO
        FROM NIÑOS WHERE 1=1
    '''
    params = []
    
    query, params = agregar_filtro_region(query, params, region)
    query, params = agregar_filtro_poblacion(query, params, poblacion)
    if año and año != 'TODOS':
        query += ' AND AÑO = ?'
        params.append(int(año))
    if mes and mes != 'TODOS':
        query += ' AND MES = ?'
        params.append(mes)
    
    query += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    data = [dict_from_row(row) for row in rows]
    
    # ===== 2. Metas desde META_NIÑOS (con MISMOS filtros de año y mes) =====
    # IMPORTANTE: Aquí NO se aplica filtro de población porque la meta es global
    meta_query = '''
        SELECT REGION, SUM(META_NIÑOS) as META
        FROM META_NIÑOS WHERE 1=1
    '''
    meta_params = []
    
    # Aplicar filtro de región
    if region and region != 'TODOS':
        region_norm = normalizar_region(region)
        meta_query += ' AND (UPPER(REGION) = UPPER(?) OR UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REGION, "Á", "A"), "É", "E"), "Í", "I"), "Ó", "O"), "Ú", "U"), "Ñ", "N")) = UPPER(?))'
        meta_params.append(region)
        meta_params.append(region_norm)
    
    # CRÍTICO: Aplicar filtro de año y mes para que la meta sea la correspondiente
    if año and año != 'TODOS':
        meta_query += ' AND AÑO = ?'
        meta_params.append(int(año))
    if mes and mes != 'TODOS':
        meta_query += ' AND MES = ?'
        meta_params.append(mes)
    
    meta_query += ' GROUP BY REGION'
    
    cursor.execute(meta_query, meta_params)
    meta_rows = cursor.fetchall()
    metas_dict = {}
    for row in meta_rows:
        region_key = normalizar_region(row[0])
        metas_dict[region_key] = row[1] if row[1] else 0
    
    # Asignar metas a los datos
    for item in data:
        region_key = normalizar_region(item['REGION'])
        item['META'] = metas_dict.get(region_key, 0)
    
    conn.close()
    return jsonify(data)

@app.route('/api/embarazadas/resumen', methods=['GET'])
def get_embarazadas_resumen():
    """Get summary of pregnant women data by region.
    
    IMPORTANTE:
    - Los datos de EMBARAZADAS se filtran por año, mes y población
    - La META se obtiene de META_EMBARAZADAS aplicando los MISMOS filtros de año y mes
    """
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # ===== 1. Datos de EMBARAZADAS =====
    query = '''
        SELECT 
            REGION,
            SUM("BAJO PESO") as BAJO_PESO,
            SUM(ADECUADO) as ADECUADO,
            SUM(SOBREPESO) as SOBREPESO,
            SUM(OBESIDAD) as OBESIDAD,
            SUM(SEGUIMIENTO) as SEGUIMIENTO,
            SUM(FINALIZADOS) as FINALIZADOS,
            SUM(ATRASOS) as ATRASOS,
            SUM(DESERCIONES) as DESERCIONES,
            SUM(T_SALIDA) as T_SALIDA,
            SUM(T_ENTRADA) as T_ENTRADA,
            SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO,
            SUM(NUEVO_INGRESO) as NUEVO_INGRESO
        FROM EMBARAZADAS WHERE 1=1
    '''
    params = []
    
    query, params = agregar_filtro_region(query, params, region)
    query, params = agregar_filtro_poblacion(query, params, poblacion)
    if año and año != 'TODOS':
        query += ' AND AÑO = ?'
        params.append(int(año))
    if mes and mes != 'TODOS':
        query += ' AND MES = ?'
        params.append(mes)
    
    query += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    data = [dict_from_row(row) for row in rows]
    
    # ===== 2. Metas desde META_EMBARAZADAS (con MISMOS filtros de año y mes) =====
    meta_query = '''
        SELECT REGION, SUM(META_EMBARAZADAS) as META
        FROM META_EMBARAZADAS WHERE 1=1
    '''
    meta_params = []
    
    if region and region != 'TODOS':
        region_norm = normalizar_region(region)
        meta_query += ' AND (UPPER(REGION) = UPPER(?) OR UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REGION, "Á", "A"), "É", "E"), "Í", "I"), "Ó", "O"), "Ú", "U"), "Ñ", "N")) = UPPER(?))'
        meta_params.append(region)
        meta_params.append(region_norm)
    
    if año and año != 'TODOS':
        meta_query += ' AND AÑO = ?'
        meta_params.append(int(año))
    if mes and mes != 'TODOS':
        meta_query += ' AND MES = ?'
        meta_params.append(mes)
    
    meta_query += ' GROUP BY REGION'
    
    cursor.execute(meta_query, meta_params)
    meta_rows = cursor.fetchall()
    metas_dict = {}
    for row in meta_rows:
        region_key = normalizar_region(row[0])
        metas_dict[region_key] = row[1] if row[1] else 0
    
    for item in data:
        region_key = normalizar_region(item['REGION'])
        item['META'] = metas_dict.get(region_key, 0)
    
    conn.close()
    return jsonify(data)

@app.route('/api/ce/resumen', methods=['GET'])
def get_ce_resumen():
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT 
            REGION,
            SUM(NUEVO_INGRESO) as NUEVO_INGRESO,
            SUM(SEGUIMIENTO) as SEGUIMIENTO,
            SUM(FINALIZADOS) as FINALIZADOS,
            SUM(ATRASOS) as ATRASOS,
            SUM(DESERCIONES) as DESERCIONES,
            SUM(T_SALIDA) as T_SALIDA,
            SUM(T_ENTRADA) as T_ENTRADA,
            SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO
        FROM CE WHERE 1=1
    '''
    params = []
    
    query, params = agregar_filtro_region(query, params, region)
    query, params = agregar_filtro_poblacion(query, params, poblacion)
    if año and año != 'TODOS':
        query += ' AND AÑO = ?'
        params.append(int(año))
    if mes and mes != 'TODOS':
        query += ' AND MES = ?'
        params.append(mes)
    
    query += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    data = [dict_from_row(row) for row in rows]
    conn.close()
    
    return jsonify(data)

@app.route('/api/deposito', methods=['GET'])
def get_deposito():
    region = request.args.get('region')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if region and region != 'TODOS':
        region_norm = normalizar_region(region)
        cursor.execute('''
            SELECT REGION, STOCK_ACTUAL FROM DEPOSITO 
            WHERE UPPER(REGION) = UPPER(?) 
               OR UPPER(REGION) = UPPER(?) 
               OR UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REGION, 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U'), 'Ñ', 'N')) = UPPER(?)
        ''', (region, region_norm, region_norm))
        rows = cursor.fetchall()
        data = {}
        for row in rows:
            data[row[0]] = row[1]
    else:
        cursor.execute('SELECT REGION, STOCK_ACTUAL FROM DEPOSITO')
        rows = cursor.fetchall()
        data = {}
        for row in rows:
            data[row[0]] = row[1]
    
    conn.close()
    return jsonify(data)

@app.route('/api/comparacion/regiones', methods=['GET'])
def get_comparacion_regiones():
    año = request.args.get('año')
    mes = request.args.get('mes')
    tipo = request.args.get('tipo', 'todos')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    data = {}
    
    if tipo in ['todos', 'ninos']:
        if tipo == 'todos':
            query = '''
                SELECT 
                    REGION,
                    SUM(DESNUTRICION) as DESNUTRICION_NINOS,
                    SUM("RIESGO DESNUTRICION") as RIESGO_DESNUTRICION_NINOS,
                    SUM(ADECUADO) as ADECUADO_NINOS,
                    SUM(SOBREPESO) as SOBREPESO_NINOS,
                    SUM(OBESIDAD) as OBESIDAD_NINOS,
                    SUM(SEGUIMIENTO) as SEGUIMIENTO_NINOS,
                    SUM(FINALIZADOS) as FINALIZADOS_NINOS,
                    SUM(ATRASOS) as ATRASOS_NINOS,
                    SUM(DESERCIONES) as DESERCIONES_NINOS,
                    SUM(T_SALIDA) as T_SALIDA_NINOS,
                    SUM(T_ENTRADA) as T_ENTRADA_NINOS,
                    SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO_NINOS,
                    SUM(NUEVO_INGRESO) as NUEVO_INGRESO_NINOS
                FROM NIÑOS WHERE 1=1
            '''
        else:
            query = '''
                SELECT 
                    REGION,
                    SUM(DESNUTRICION) as DESNUTRICION,
                    SUM("RIESGO DESNUTRICION") as RIESGO_DESNUTRICION,
                    SUM(ADECUADO) as ADECUADO,
                    SUM(SOBREPESO) as SOBREPESO,
                    SUM(OBESIDAD) as OBESIDAD,
                    SUM(SEGUIMIENTO) as SEGUIMIENTO,
                    SUM(FINALIZADOS) as FINALIZADOS,
                    SUM(ATRASOS) as ATRASOS,
                    SUM(DESERCIONES) as DESERCIONES,
                    SUM(T_SALIDA) as T_SALIDA,
                    SUM(T_ENTRADA) as T_ENTRADA,
                    SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO,
                    SUM(NUEVO_INGRESO) as NUEVO_INGRESO
                FROM NIÑOS WHERE 1=1
            '''
        params = []
        query, params = agregar_filtro_poblacion(query, params, poblacion)
        if año and año != 'TODOS':
            query += ' AND AÑO = ?'
            params.append(int(año))
        if mes and mes != 'TODOS':
            query += ' AND MES = ?'
            params.append(mes)
        query += ' GROUP BY REGION'
        
        cursor.execute(query, params)
        for row in cursor.fetchall():
            data[row[0]] = dict_from_row(row)
    
    if tipo in ['todos', 'embarazadas']:
        if tipo == 'todos':
            query = '''
                SELECT 
                    REGION,
                    SUM("BAJO PESO") as BAJO_PESO_EMB,
                    SUM(ADECUADO) as ADECUADO_EMB,
                    SUM(SOBREPESO) as SOBREPESO_EMB,
                    SUM(OBESIDAD) as OBESIDAD_EMB,
                    SUM(SEGUIMIENTO) as SEGUIMIENTO_EMB,
                    SUM(FINALIZADOS) as FINALIZADOS_EMB,
                    SUM(ATRASOS) as ATRASOS_EMB,
                    SUM(DESERCIONES) as DESERCIONES_EMB,
                    SUM(T_SALIDA) as T_SALIDA_EMB,
                    SUM(T_ENTRADA) as T_ENTRADA_EMB,
                    SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO_EMB,
                    SUM(NUEVO_INGRESO) as NUEVO_INGRESO_EMB
                FROM EMBARAZADAS WHERE 1=1
            '''
        else:
            query = '''
                SELECT 
                    REGION,
                    SUM("BAJO PESO") as BAJO_PESO,
                    SUM(ADECUADO) as ADECUADO,
                    SUM(SOBREPESO) as SOBREPESO,
                    SUM(OBESIDAD) as OBESIDAD,
                    SUM(SEGUIMIENTO) as SEGUIMIENTO,
                    SUM(FINALIZADOS) as FINALIZADOS,
                    SUM(ATRASOS) as ATRASOS,
                    SUM(DESERCIONES) as DESERCIONES,
                    SUM(T_SALIDA) as T_SALIDA,
                    SUM(T_ENTRADA) as T_ENTRADA,
                    SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO,
                    SUM(NUEVO_INGRESO) as NUEVO_INGRESO
                FROM EMBARAZADAS WHERE 1=1
            '''
        params = []
        query, params = agregar_filtro_poblacion(query, params, poblacion)
        if año and año != 'TODOS':
            query += ' AND AÑO = ?'
            params.append(int(año))
        if mes and mes != 'TODOS':
            query += ' AND MES = ?'
            params.append(mes)
        query += ' GROUP BY REGION'
        
        cursor.execute(query, params)
        for row in cursor.fetchall():
            if row[0] in data:
                data[row[0]].update(dict_from_row(row))
            else:
                data[row[0]] = dict_from_row(row)
    
    if tipo in ['todos', 'ce']:
        query = '''
            SELECT 
                REGION,
                SUM(NUEVO_INGRESO) as NUEVO_INGRESO_CE,
                SUM(SEGUIMIENTO) as SEGUIMIENTO_CE,
                SUM(FINALIZADOS) as FINALIZADOS_CE,
                SUM(ATRASOS) as ATRASOS_CE,
                SUM(DESERCIONES) as DESERCIONES_CE,
                SUM(T_SALIDA) as T_SALIDA_CE,
                SUM(T_ENTRADA) as T_ENTRADA_CE,
                SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO_CE
            FROM CE WHERE 1=1
        '''
        params = []
        query, params = agregar_filtro_poblacion(query, params, poblacion)
        if año and año != 'TODOS':
            query += ' AND AÑO = ?'
            params.append(int(año))
        if mes and mes != 'TODOS':
            query += ' AND MES = ?'
            params.append(mes)
        query += ' GROUP BY REGION'
        
        cursor.execute(query, params)
        for row in cursor.fetchall():
            if row[0] in data:
                data[row[0]].update(dict_from_row(row))
            else:
                data[row[0]] = dict_from_row(row)
    
    conn.close()
    
    orden_regiones = [
        'CONCEPCIÓN', 'SAN PEDRO', 'CORDILLERA', 'GUAIRÁ', 'CAAGUAZÚ',
        'CAAZAPÁ', 'ITAPÚA', 'MISIONES', 'PARAGUARÍ', 'ALTO PARANÁ',
        'CENTRAL', 'ÑEEMBUCÚ', 'AMAMBAY', 'CANINDEYÚ', 'PRESIDENTE HAYES',
        'BOQUERÓN', 'ALTO PARAGUAY', 'CAPITAL'
    ]
    normalizar = {'�EEMBUCU': 'ÑEEMBUCU', 'NEEMBUCU': 'ÑEEMBUCU'}
    mostrar_tildes = {
        'CONCEPCION': 'CONCEPCIÓN', 'GUAIRA': 'GUAIRÁ', 'CAAGUAZU': 'CAAGUAZÚ',
        'CAAZAPA': 'CAAZAPÁ', 'ITAPUA': 'ITAPÚA', 'PARAGUARI': 'PARAGUARÍ',
        'ALTO PARANA': 'ALTO PARANÁ', 'ÑEEMBUCU': 'ÑEEMBUCÚ', 'CANINDEYU': 'CANINDEYÚ',
        'BOQUERON': 'BOQUERÓN', 'CAPITAL': 'CAPITAL', 'ASUNCION': 'CAPITAL'
    }
    data_normalizado = {}
    for k, v in data.items():
        k_normalizado = normalizar.get(k, k)
        k_mostrar = mostrar_tildes.get(k_normalizado, k_normalizado)
        data_normalizado[k_mostrar] = v
    
    data_ordenado = OrderedDict()
    for region in orden_regiones:
        if region in data_normalizado:
            data_ordenado[region] = data_normalizado[region]
    for k, v in data_normalizado.items():
        if k not in data_ordenado:
            data_ordenado[k] = v
    
    return Response(json.dumps(data_ordenado, ensure_ascii=False), mimetype='application/json')

def normalizar_texto(texto):
    if not texto:
        return texto
    replacements = {
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Ñ': 'N', 'ñ': 'n', '�': 'N',
    }
    for accented, plain in replacements.items():
        texto = texto.replace(accented, plain)
    return texto.upper()

@app.route('/api/comparacion/años', methods=['GET'])
def get_comparacion_años():
    region = request.args.get('region', 'TODOS')
    tipo = request.args.get('tipo', 'todos')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    data = {}
    cursor.execute('SELECT DISTINCT AÑO FROM NIÑOS ORDER BY AÑO')
    años = [row[0] for row in cursor.fetchall()]
    
    region_normalizada = normalizar_texto(region) if region and region != 'TODOS' else 'TODOS'
    cursor.execute('SELECT DISTINCT REGION FROM NIÑOS')
    regiones_db = [row[0] for row in cursor.fetchall()]
    
    region_encontrada = None
    if region_normalizada != 'TODOS':
        for r in regiones_db:
            if normalizar_texto(r) == region_normalizada:
                region_encontrada = r
                break
    
    for año in años:
        if tipo in ['todos', 'ninos']:
            query = '''
                SELECT 
                    SUM(DESNUTRICION) as DESNUTRICION,
                    SUM("RIESGO DESNUTRICION") as RIESGO_DESNUTRICION,
                    SUM(ADECUADO) as ADECUADO,
                    SUM(SOBREPESO) as SOBREPESO,
                    SUM(OBESIDAD) as OBESIDAD,
                    SUM(SEGUIMIENTO) as SEGUIMIENTO,
                    SUM(FINALIZADOS) as FINALIZADOS,
                    SUM(ATRASOS) as ATRASOS,
                    SUM(DESERCIONES) as DESERCIONES,
                    SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO,
                    SUM(NUEVO_INGRESO) as NUEVO_INGRESO
                FROM NIÑOS WHERE AÑO = ?
            '''
            params = [int(año)]
            if region_encontrada and region_encontrada != 'TODOS':
                query += ' AND REGION = ?'
                params.append(region_encontrada)
            query, params = agregar_filtro_poblacion(query, params, poblacion)
            
            cursor.execute(query, params)
            row = cursor.fetchone()
            data[str(año)] = dict_from_row(row)
    
    conn.close()
    return jsonify(data)

@app.route('/api/alertas', methods=['GET'])
def get_alertas():
    año = request.args.get('año')
    mes = request.args.get('mes')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT 
            REGION,
            SUM(DESNUTRICION) as DESNUTRICION,
            SUM("RIESGO DESNUTRICION") as RIESGO_DESNUTRICION,
            SUM(ATRASOS) as ATRASOS,
            SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO
        FROM NIÑOS WHERE 1=1
    '''
    params = []
    query, params = agregar_filtro_poblacion(query, params, poblacion)
    if año and año != 'TODOS':
        query += ' AND AÑO = ?'
        params.append(int(año))
    if mes and mes != 'TODOS':
        query += ' AND MES = ?'
        params.append(mes)
    query += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    total_desnutricion = sum(row[1] for row in rows if row[1])
    total_riesgo = sum(row[2] for row in rows if row[2])
    total_atrasos = sum(row[3] for row in rows if row[3])
    
    avg_desnutricion = total_desnutricion / len(rows) if rows else 0
    avg_riesgo = total_riesgo / len(rows) if rows else 0
    avg_atrasos = total_atrasos / len(rows) if rows else 0
    
    data = []
    for row in rows:
        region = row[0]
        desnutricion = row[1] if row[1] else 0
        riesgo = row[2] if row[2] else 0
        atrasos = row[3] if row[3] else 0
        asistidos = row[4] if row[4] else 0
        
        alert_desnutricion = 0 if desnutricion < avg_desnutricion else (1 if desnutricion < avg_desnutricion * 1.5 else 2)
        alert_riesgo = 0 if riesgo < avg_riesgo else (1 if riesgo < avg_riesgo * 1.5 else 2)
        alert_atrasos = 0 if atrasos < avg_atrasos else (1 if atrasos < avg_atrasos * 1.5 else 2)
        overall_alert = max(alert_desnutricion, alert_riesgo, alert_atrasos)
        
        data.append({
            'region': region,
            'desnutricion': desnutricion,
            'riesgo': riesgo,
            'atrasos': atrasos,
            'total_asistido': asistidos,
            'pct_desnutricion': round((desnutricion / asistidos * 100) if asistidos > 0 else 0, 2),
            'pct_riesgo': round((riesgo / asistidos * 100) if asistidos > 0 else 0, 2),
            'pct_atrasos': round((atrasos / asistidos * 100) if asistidos > 0 else 0, 2),
            'alert_desnutricion': alert_desnutricion,
            'alert_riesgo': alert_riesgo,
            'alert_atrasos': alert_atrasos,
            'overall_alert': overall_alert
        })
    
    conn.close()
    return jsonify(data)

@app.route('/api/nutricional/distribucion', methods=['GET'])
def get_nutricional_distribucion():
    tipo = request.args.get('tipo', 'ambos')
    año = request.args.get('año', 'TODOS')
    region = request.args.get('region', 'TODOS')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    result = {
        'desnutricion': 0, 'riesgo_desnutricion': 0, 'bajo_peso': 0,
        'adecuado': 0, 'sobrepeso': 0, 'obesidad': 0, 'total': 0
    }
    
    if tipo in ['ambos', 'ninos']:
        query = '''
            SELECT 
                SUM(DESNUTRICION) as DESNUTRICION,
                SUM("RIESGO DESNUTRICION") as RIESGO_DESNUTRICION,
                SUM(ADECUADO) as ADECUADO,
                SUM(SOBREPESO) as SOBREPESO,
                SUM(OBESIDAD) as OBESIDAD,
                SUM(TOTAL_ASISTIDO) as TOTAL
            FROM NIÑOS WHERE 1=1
        '''
        params = []
        query, params = agregar_filtro_poblacion(query, params, poblacion)
        if año and año != 'TODOS':
            query += ' AND AÑO = ?'
            params.append(int(año))
        if region and region != 'TODOS':
            region_normalizada = region.replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U')
            query += ' AND (REGION = ? OR REGION = ?)'
            params.append(region)
            params.append(region_normalizada)
        
        cursor.execute(query, params)
        row = cursor.fetchone()
        if row:
            result['desnutricion'] = row[0] if row[0] else 0
            result['riesgo_desnutricion'] = row[1] if row[1] else 0
            result['adecuado'] = row[2] if row[2] else 0
            result['sobrepeso'] = row[3] if row[3] else 0
            result['obesidad'] = row[4] if row[4] else 0
            result['total'] += row[5] if row[5] else 0
    
    if tipo in ['ambos', 'embarazadas']:
        query = '''
            SELECT 
                SUM("BAJO PESO") as BAJO_PESO,
                SUM(ADECUADO) as ADECUADO,
                SUM(SOBREPESO) as SOBREPESO,
                SUM(OBESIDAD) as OBESIDAD,
                SUM(TOTAL_ASISTIDO) as TOTAL
            FROM EMBARAZADAS WHERE 1=1
        '''
        params = []
        query, params = agregar_filtro_poblacion(query, params, poblacion)
        if año and año != 'TODOS':
            query += ' AND AÑO = ?'
            params.append(int(año))
        if region and region != 'TODOS':
            region_normalizada = region.replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U')
            query += ' AND (REGION = ? OR REGION = ?)'
            params.append(region)
            params.append(region_normalizada)
        
        cursor.execute(query, params)
        row = cursor.fetchone()
        if row:
            result['bajo_peso'] = row[0] if row[0] else 0
            result['adecuado'] += row[1] if row[1] else 0
            result['sobrepeso'] += row[2] if row[2] else 0
            result['obesidad'] += row[3] if row[3] else 0
            result['total'] += row[4] if row[4] else 0
    
    conn.close()
    return jsonify(result)

@app.route('/api/nutricional/top5', methods=['GET'])
def get_nutricional_top5():
    tipo = request.args.get('tipo', 'ambos')
    año = request.args.get('año', 'TODOS')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    data = []
    
    if tipo in ['ambos', 'ninos']:
        query = '''
            SELECT REGION, SUM(DESNUTRICION) as DESNUTRICION,
                   SUM("RIESGO DESNUTRICION") as RIESGO,
                   SUM(TOTAL_ASISTIDO) as TOTAL
            FROM NIÑOS WHERE 1=1
        '''
        params = []
        query, params = agregar_filtro_poblacion(query, params, poblacion)
        if año and año != 'TODOS':
            query += ' AND AÑO = ?'
            params.append(int(año))
        query += ' GROUP BY REGION'
        
        cursor.execute(query, params)
        for row in cursor.fetchall():
            casos_desnutricion = row[1] if row[1] else 0
            total = row[3] if row[3] else 0
            porcentaje_desnutricion = round((casos_desnutricion / total * 100), 2) if total > 0 else 0
            data.append({
                'region': row[0], 'indicador': 'Desnutrición',
                'casos': casos_desnutricion, 'porcentaje': porcentaje_desnutricion,
                'tipo_grafico': 'desnutricion'
            })
            casos_riesgo = row[2] if row[2] else 0
            porcentaje_riesgo = round((casos_riesgo / total * 100), 2) if total > 0 else 0
            data.append({
                'region': row[0], 'indicador': 'Riesgo Desnutrición',
                'casos': casos_riesgo, 'porcentaje': porcentaje_riesgo,
                'tipo_grafico': 'riesgo'
            })
    
    if tipo in ['ambos', 'embarazadas']:
        query = '''
            SELECT REGION, SUM("BAJO PESO") as CASOS, SUM(TOTAL_ASISTIDO) as TOTAL
            FROM EMBARAZADAS WHERE 1=1
        '''
        params = []
        query, params = agregar_filtro_poblacion(query, params, poblacion)
        if año and año != 'TODOS':
            query += ' AND AÑO = ?'
            params.append(int(año))
        query += ' GROUP BY REGION'
        
        cursor.execute(query, params)
        for row in cursor.fetchall():
            casos = row[1] if row[1] else 0
            total = row[2] if row[2] else 0
            porcentaje = round((casos / total * 100), 2) if total > 0 else 0
            data.append({
                'region': row[0], 'indicador': 'Bajo Peso',
                'casos': casos, 'porcentaje': porcentaje,
                'tipo_grafico': 'bajo_peso'
            })
    
    if tipo == 'ninos':
        top5 = data
    else:
        data.sort(key=lambda x: x['porcentaje'], reverse=True)
        top5 = data[:5]
    
    conn.close()
    return jsonify(top5)

@app.route('/api/nutricional/evolucion', methods=['GET'])
def get_nutricional_evolucion():
    tipo = request.args.get('tipo', 'ambos')
    region = request.args.get('region', 'TODOS')
    modo = request.args.get('modo', 'anual')
    año = request.args.get('año', None)
    poblacion = request.args.get('poblacion', 'GLOBAL')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    data = {}
    cursor.execute('SELECT DISTINCT AÑO FROM NIÑOS ORDER BY AÑO')
    años = [row[0] for row in cursor.fetchall()]
    
    meses_nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    meses_db = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    
    if modo == 'mensual' and año:
        data = []
        for i in range(1, 13):
            mes_data = {
                'mes': meses_nombres[i-1],
                'desnutricion': {'valor': 0, 'porcentaje': 0},
                'riesgo_desnutricion': {'valor': 0, 'porcentaje': 0},
                'adecuado': {'valor': 0, 'porcentaje': 0},
                'sobrepeso': {'valor': 0, 'porcentaje': 0},
                'obesidad': {'valor': 0, 'porcentaje': 0},
                'bajo_peso': {'valor': 0, 'porcentaje': 0}
            }
            
            if tipo in ['ambos', 'ninos']:
                query = '''
                    SELECT SUM(DESNUTRICION), SUM("RIESGO DESNUTRICION"), SUM(ADECUADO),
                           SUM(SOBREPESO), SUM(OBESIDAD), SUM(TOTAL_ASISTIDO)
                    FROM NIÑOS WHERE AÑO = ? AND MES = ?
                '''
                params = [int(año), meses_db[i-1]]
                query, params = agregar_filtro_poblacion(query, params, poblacion)
                if region and region != 'TODOS':
                    region_normalizada = region.replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U')
                    query += ' AND (REGION = ? OR REGION = ?)'
                    params.append(region)
                    params.append(region_normalizada)
                cursor.execute(query, params)
                row = cursor.fetchone()
                if row and row[0] is not None:
                    total = row[5] if row[5] else 1
                    mes_data['desnutricion'] = {'valor': row[0] or 0, 'porcentaje': round((row[0] / total * 100), 2) if total > 0 else 0}
                    mes_data['riesgo_desnutricion'] = {'valor': row[1] or 0, 'porcentaje': round((row[1] / total * 100), 2) if total > 0 else 0}
                    mes_data['adecuado'] = {'valor': row[2] or 0, 'porcentaje': round((row[2] / total * 100), 2) if total > 0 else 0}
                    mes_data['sobrepeso'] = {'valor': row[3] or 0, 'porcentaje': round((row[3] / total * 100), 2) if total > 0 else 0}
                    mes_data['obesidad'] = {'valor': row[4] or 0, 'porcentaje': round((row[4] / total * 100), 2) if total > 0 else 0}
            
            if tipo in ['ambos', 'embarazadas']:
                query = '''
                    SELECT SUM("BAJO PESO"), SUM(ADECUADO), SUM(SOBREPESO),
                           SUM(OBESIDAD), SUM(TOTAL_ASISTIDO)
                    FROM EMBARAZADAS WHERE AÑO = ? AND MES = ?
                '''
                params = [int(año), meses_db[i-1]]
                query, params = agregar_filtro_poblacion(query, params, poblacion)
                if region and region != 'TODOS':
                    region_normalizada = region.replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U')
                    query += ' AND (REGION = ? OR REGION = ?)'
                    params.append(region)
                    params.append(region_normalizada)
                cursor.execute(query, params)
                row = cursor.fetchone()
                if row and row[0] is not None:
                    total = row[4] if row[4] else 1
                    mes_data['bajo_peso'] = {'valor': row[0] or 0, 'porcentaje': round((row[0] / total * 100), 2) if total > 0 else 0}
                    if tipo == 'embarazadas':
                        mes_data['adecuado'] = {'valor': row[1] or 0, 'porcentaje': round((row[1] / total * 100), 2) if total > 0 else 0}
                        mes_data['sobrepeso'] = {'valor': row[2] or 0, 'porcentaje': round((row[2] / total * 100), 2) if total > 0 else 0}
                        mes_data['obesidad'] = {'valor': row[3] or 0, 'porcentaje': round((row[3] / total * 100), 2) if total > 0 else 0}
            
            data.append(mes_data)
    else:
        for año_iter in años:
            data[str(año_iter)] = {}
            
            if tipo in ['ambos', 'ninos']:
                query = '''
                    SELECT SUM(DESNUTRICION), SUM("RIESGO DESNUTRICION"), SUM(ADECUADO),
                           SUM(SOBREPESO), SUM(OBESIDAD), SUM(TOTAL_ASISTIDO)
                    FROM NIÑOS WHERE AÑO = ?
                '''
                params = [int(año_iter)]
                query, params = agregar_filtro_poblacion(query, params, poblacion)
                if region and region != 'TODOS':
                    region_normalizada = region.replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U')
                    query += ' AND (REGION = ? OR REGION = ?)'
                    params.append(region)
                    params.append(region_normalizada)
                cursor.execute(query, params)
                row = cursor.fetchone()
                if row:
                    total = row[5] if row[5] else 1
                    data[str(año_iter)]['desnutricion'] = {'valor': row[0] or 0, 'porcentaje': round((row[0] / total * 100), 2) if total > 0 else 0}
                    data[str(año_iter)]['riesgo_desnutricion'] = {'valor': row[1] or 0, 'porcentaje': round((row[1] / total * 100), 2) if total > 0 else 0}
                    data[str(año_iter)]['adecuado'] = {'valor': row[2] or 0, 'porcentaje': round((row[2] / total * 100), 2) if total > 0 else 0}
                    data[str(año_iter)]['sobrepeso'] = {'valor': row[3] or 0, 'porcentaje': round((row[3] / total * 100), 2) if total > 0 else 0}
                    data[str(año_iter)]['obesidad'] = {'valor': row[4] or 0, 'porcentaje': round((row[4] / total * 100), 2) if total > 0 else 0}
            
            if tipo in ['ambos', 'embarazadas']:
                query = '''
                    SELECT SUM("BAJO PESO"), SUM(ADECUADO), SUM(SOBREPESO),
                           SUM(OBESIDAD), SUM(TOTAL_ASISTIDO)
                    FROM EMBARAZADAS WHERE AÑO = ?
                '''
                params = [int(año_iter)]
                query, params = agregar_filtro_poblacion(query, params, poblacion)
                if region and region != 'TODOS':
                    region_normalizada = region.replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U')
                    query += ' AND (REGION = ? OR REGION = ?)'
                    params.append(region)
                    params.append(region_normalizada)
                cursor.execute(query, params)
                row = cursor.fetchone()
                if row:
                    total = row[4] if row[4] else 1
                    data[str(año_iter)]['bajo_peso'] = {'valor': row[0] or 0, 'porcentaje': round((row[0] / total * 100), 2) if total > 0 else 0}
                    if tipo == 'embarazadas':
                        data[str(año_iter)]['adecuado'] = {'valor': row[1] or 0, 'porcentaje': round((row[1] / total * 100), 2) if total > 0 else 0}
                        data[str(año_iter)]['sobrepeso'] = {'valor': row[2] or 0, 'porcentaje': round((row[2] / total * 100), 2) if total > 0 else 0}
                        data[str(año_iter)]['obesidad'] = {'valor': row[3] or 0, 'porcentaje': round((row[3] / total * 100), 2) if total > 0 else 0}
    
    conn.close()
    return jsonify(data)

@app.route('/api/metas', methods=['GET'])
def get_metas():
    """Get meta compliance indicators.
    
    IMPORTANTE:
    - Nuevo Ingreso: de NIÑOS/EMBARAZADAS, filtrado por población (GLOBAL suma todo)
    - Meta: de META_NIÑOS/META_EMBARAZADAS, filtrada por año y mes (NO por población)
    - Cuando no se filtra por mes, se suman todas las metas del año
    """
    año = request.args.get('año')
    mes = request.args.get('mes')
    tipo = request.args.get('tipo', 'combinada')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    region = request.args.get('region')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # ===== Datos reales de NIÑOS =====
    query_ninos = '''
        SELECT REGION, SUM(NUEVO_INGRESO) as NUEVO_INGRESO
        FROM NIÑOS WHERE 1=1
    '''
    params_ninos = []
    query_ninos, params_ninos = agregar_filtro_poblacion(query_ninos, params_ninos, poblacion)
    query_ninos, params_ninos = agregar_filtro_region(query_ninos, params_ninos, region)
    if año and año != 'TODOS':
        query_ninos += ' AND AÑO = ?'
        params_ninos.append(int(año))
    if mes and mes != 'TODOS':
        query_ninos += ' AND MES = ?'
        params_ninos.append(mes)
    query_ninos += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query_ninos, params_ninos)
    ninos_rows = cursor.fetchall()
    
    # ===== Metas de META_NIÑOS (con filtros de año y mes) =====
    query_meta_ninos = '''
        SELECT REGION, SUM(META_NIÑOS) as META
        FROM META_NIÑOS WHERE 1=1
    '''
    params_meta_ninos = []
    query_meta_ninos, params_meta_ninos = agregar_filtro_region(query_meta_ninos, params_meta_ninos, region)
    if año and año != 'TODOS':
        query_meta_ninos += ' AND AÑO = ?'
        params_meta_ninos.append(int(año))
    if mes and mes != 'TODOS':
        query_meta_ninos += ' AND MES = ?'
        params_meta_ninos.append(mes)
    query_meta_ninos += ' GROUP BY REGION'
    
    cursor.execute(query_meta_ninos, params_meta_ninos)
    meta_ninos_dict = {}
    for row in cursor.fetchall():
        meta_ninos_dict[normalizar_region(row[0])] = row[1] if row[1] else 0
    
    # ===== Datos reales de EMBARAZADAS =====
    query_embarazadas = '''
        SELECT REGION, SUM(NUEVO_INGRESO) as NUEVO_INGRESO
        FROM EMBARAZADAS WHERE 1=1
    '''
    params_embarazadas = []
    query_embarazadas, params_embarazadas = agregar_filtro_poblacion(query_embarazadas, params_embarazadas, poblacion)
    query_embarazadas, params_embarazadas = agregar_filtro_region(query_embarazadas, params_embarazadas, region)
    if año and año != 'TODOS':
        query_embarazadas += ' AND AÑO = ?'
        params_embarazadas.append(int(año))
    if mes and mes != 'TODOS':
        query_embarazadas += ' AND MES = ?'
        params_embarazadas.append(mes)
    query_embarazadas += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query_embarazadas, params_embarazadas)
    embarazada_rows = cursor.fetchall()
    
    # ===== Metas de META_EMBARAZADAS (con filtros de año y mes) =====
    query_meta_embarazadas = '''
        SELECT REGION, SUM(META_EMBARAZADAS) as META
        FROM META_EMBARAZADAS WHERE 1=1
    '''
    params_meta_embarazadas = []
    query_meta_embarazadas, params_meta_embarazadas = agregar_filtro_region(query_meta_embarazadas, params_meta_embarazadas, region)
    if año and año != 'TODOS':
        query_meta_embarazadas += ' AND AÑO = ?'
        params_meta_embarazadas.append(int(año))
    if mes and mes != 'TODOS':
        query_meta_embarazadas += ' AND MES = ?'
        params_meta_embarazadas.append(mes)
    query_meta_embarazadas += ' GROUP BY REGION'
    
    cursor.execute(query_meta_embarazadas, params_meta_embarazadas)
    meta_embarazadas_dict = {}
    for row in cursor.fetchall():
        meta_embarazadas_dict[normalizar_region(row[0])] = row[1] if row[1] else 0
    
    # Build dictionaries
    ninos_dict = {}
    for row in ninos_rows:
        region_key = normalizar_region(row[0])
        nuevo_ingreso = row[1] if row[1] else 0
        meta = meta_ninos_dict.get(region_key, 0)
        ninos_dict[row[0]] = {
            'nuevo_ingreso': nuevo_ingreso,
            'meta': meta,
            'pct_cumplimiento': round((nuevo_ingreso / meta * 100) if meta > 0 else 0, 2)
        }
    
    embarazadas_dict = {}
    for row in embarazada_rows:
        region_key = normalizar_region(row[0])
        nuevo_ingreso = row[1] if row[1] else 0
        meta = meta_embarazadas_dict.get(region_key, 0)
        embarazadas_dict[row[0]] = {
            'nuevo_ingreso': nuevo_ingreso,
            'meta': meta,
            'pct_cumplimiento': round((nuevo_ingreso / meta * 100) if meta > 0 else 0, 2)
        }
    
    if region and region != 'TODOS':
        region_norm = normalizar_region(region)
        def filtrar_region(dic):
            return {k: v for k, v in dic.items() if normalizar_region(k) == region_norm}
        ninos_dict = filtrar_region(ninos_dict)
        embarazadas_dict = filtrar_region(embarazadas_dict)
    
    all_regions = sorted(set(ninos_dict.keys()) | set(embarazadas_dict.keys()))
    
    data = []
    for region in all_regions:
        ninos_data = ninos_dict.get(region, {'nuevo_ingreso': 0, 'meta': 0, 'pct_cumplimiento': 0})
        embarazada_data = embarazadas_dict.get(region, {'nuevo_ingreso': 0, 'meta': 0, 'pct_cumplimiento': 0})
        
        if tipo == 'ninos':
            pct_cumplimiento = ninos_data['pct_cumplimiento']
            nuevo_ingreso = ninos_data['nuevo_ingreso']
            meta = ninos_data['meta']
        elif tipo == 'embarazadas':
            pct_cumplimiento = embarazada_data['pct_cumplimiento']
            nuevo_ingreso = embarazada_data['nuevo_ingreso']
            meta = embarazada_data['meta']
        else:
            nuevo_ingreso = ninos_data['nuevo_ingreso'] + embarazada_data['nuevo_ingreso']
            meta = ninos_data['meta'] + embarazada_data['meta']
            pct_cumplimiento = round((nuevo_ingreso / meta * 100) if meta > 0 else 0, 2)
        
        if pct_cumplimiento >= 80:
            alert_level = 0
        elif pct_cumplimiento >= 60:
            alert_level = 1
        else:
            alert_level = 2
        
        data.append({
            'region': region,
            'nuevo_ingreso': nuevo_ingreso,
            'meta': meta,
            'pct_cumplimiento': pct_cumplimiento,
            'pct_ninos': ninos_data['pct_cumplimiento'],
            'pct_embarazadas': embarazada_data['pct_cumplimiento'],
            'alert_level': alert_level
        })
    
    conn.close()
    return jsonify(data)

@app.route('/api/poblacion/totales', methods=['GET'])
def get_poblacion_totales():
    region = request.args.get('region', 'TODOS')
    año = request.args.get('año')
    mes = request.args.get('mes')
    tipo = request.args.get('tipo', 'todos')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    result = {
        'latino': {'total_asistido': 0, 'nuevo_ingreso': 0, 'seguimiento': 0, 'finalizados': 0},
        'indigena': {'total_asistido': 0, 'nuevo_ingreso': 0, 'seguimiento': 0, 'finalizados': 0}
    }
    
    tablas = []
    if tipo == 'todos':
        tablas = ['NIÑOS', 'EMBARAZADAS', 'CE']
    elif tipo == 'ninos':
        tablas = ['NIÑOS']
    elif tipo == 'embarazadas':
        tablas = ['EMBARAZADAS']
    elif tipo == 'ce':
        tablas = ['CE']
    
    for tabla in tablas:
        for pob in ['LATINO', 'INDIGENA']:
            query = f'''
                SELECT 
                    SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO,
                    SUM(NUEVO_INGRESO) as NUEVO_INGRESO,
                    SUM(SEGUIMIENTO) as SEGUIMIENTO,
                    SUM(FINALIZADOS) as FINALIZADOS
                FROM {tabla} WHERE UPPER(POBLACION) = ?
            '''
            params = [pob]
            
            if region and region != 'TODOS':
                region_norm = normalizar_region(region)
                query += ' AND (UPPER(REGION) = UPPER(?) OR UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REGION, "Á", "A"), "É", "E"), "Í", "I"), "Ó", "O"), "Ú", "U"), "Ñ", "N")) = UPPER(?))'
                params.append(region)
                params.append(region_norm)
            if año and año != 'TODOS':
                query += ' AND AÑO = ?'
                params.append(int(año))
            if mes and mes != 'TODOS':
                query += ' AND MES = ?'
                params.append(mes)
            
            cursor.execute(query, params)
            row = cursor.fetchone()
            
            key = 'latino' if pob == 'LATINO' else 'indigena'
            if row:
                result[key]['total_asistido'] += row[0] if row[0] else 0
                result[key]['nuevo_ingreso'] += row[1] if row[1] else 0
                result[key]['seguimiento'] += row[2] if row[2] else 0
                result[key]['finalizados'] += row[3] if row[3] else 0
    
    conn.close()
    return jsonify(result)

MESES_ORDEN = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
               'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

@app.route('/api/totales-mensuales', methods=['GET'])
def get_totales_mensuales():
    año = request.args.get('año')
    mes = request.args.get('mes')
    poblacion = request.args.get('poblacion', 'GLOBAL')
    region = request.args.get('region')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    def obtener_totales(tabla):
        query = f'SELECT MES, SUM(TOTAL_ASISTIDO) as TOTAL FROM {tabla} WHERE 1=1'
        params = []
        query, params = agregar_filtro_poblacion(query, params, poblacion)
        query, params = agregar_filtro_region(query, params, region)
        if año and año != 'TODOS':
            query += ' AND AÑO = ?'
            params.append(int(año))
        if mes and mes != 'TODOS':
            query += ' AND MES = ?'
            params.append(mes)
        query += ' GROUP BY MES'
        
        cursor.execute(query, params)
        return {row[0]: row[1] if row[1] else 0 for row in cursor.fetchall()}
    
    ninos_por_mes = obtener_totales('NIÑOS')
    embarazadas_por_mes = obtener_totales('EMBARAZADAS')
    ce_por_mes = obtener_totales('CE')
    
    resultado = []
    total_general_ninos = 0
    total_general_emb = 0
    total_general_ce = 0
    
    for mes_nombre in MESES_ORDEN:
        ninos = ninos_por_mes.get(mes_nombre, 0)
        emb = embarazadas_por_mes.get(mes_nombre, 0)
        ce = ce_por_mes.get(mes_nombre, 0)
        total = ninos + emb + ce
        
        total_general_ninos += ninos
        total_general_emb += emb
        total_general_ce += ce
        
        resultado.append({
            'mes': mes_nombre[:3].capitalize(),
            'ninos': ninos,
            'embarazadas': emb,
            'ce': ce,
            'total': total
        })
    
    total_general = total_general_ninos + total_general_emb + total_general_ce
    
    conn.close()
    return jsonify({
        'datos': resultado,
        'totales': {
            'ninos': total_general_ninos,
            'embarazadas': total_general_emb,
            'ce': total_general_ce,
            'total': total_general
        }
    })

if __name__ == '__main__':
    print("=" * 60)
    print("  Panel de Cobertura - Paraguay")
    print("=" * 60)
    print("\nAbriendo servidor en: http://localhost:10000")
    print("\nPresiona Ctrl+C para detener el servidor\n")
    app.run(host="0.0.0.0", port=10000)