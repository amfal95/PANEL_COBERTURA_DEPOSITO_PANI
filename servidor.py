#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor API para el Panel de Cobertura de Paraguay
Serve data from basepani.db to HTML/JavaScript frontend
"""

from flask import Flask, jsonify, request, send_from_directory
import sqlite3
import json
import os

app = Flask(__name__, static_folder='.', static_url_path='')

# Database path
DB_PATH = 'basepani.db'

# Get absolute path for database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'basepani.db')

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def dict_from_row(row):
    """Convert sqlite3.Row to dictionary"""
    return dict(row)

@app.route('/')
def index():
    """Serve the main HTML page"""
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (GeoJSON, etc.)"""
    return send_from_directory(BASE_DIR, filename)

@app.route('/api/regiones', methods=['GET'])
def get_regiones():
    """Get all regions"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT REGION FROM NIÑOS ORDER BY REGION')
    regiones = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify(regiones)

@app.route('/api/años', methods=['GET'])
def get_años():
    """Get all years"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT AÑO FROM NIÑOS ORDER BY AÑO DESC')
    años = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify(años)

@app.route('/api/meses', methods=['GET'])
def get_meses():
    """Get all months"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT MES FROM NIÑOS ORDER BY MES')
    meses = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify(meses)

@app.route('/api/ninos', methods=['GET'])
def get_ninos():
    """Get children data with optional filters"""
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM NIÑOS WHERE 1=1'
    params = []
    
    if region and region != 'TODOS':
        query += ' AND REGION = ?'
        params.append(region)
    if año and año != 'TODOS':
        query += ' AND AÑO = ?'
        params.append(int(año))
    if mes and mes != 'TODOS':
        query += ' AND MES = ?'
        params.append(mes)
    
    query += ' ORDER BY REGION, AÑO, MES'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    data = [dict_from_row(row) for row in rows]
    conn.close()
    
    return jsonify(data)

@app.route('/api/ninos/resumen', methods=['GET'])
def get_ninos_resumen():
    """Get summary of children data by region"""
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
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
            SUM(NUEVO_INGRESO) as NUEVO_INGRESO,
            SUM(META) as META
        FROM NIÑOS WHERE 1=1
    '''
    params = []
    
    if region and region != 'TODOS':
        query += ' AND REGION = ?'
        params.append(region)
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

@app.route('/api/embarazadas', methods=['GET'])
def get_embarazadas():
    """Get pregnant women data with optional filters"""
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM EMBARAZADAS WHERE 1=1'
    params = []
    
    if region and region != 'TODOS':
        query += ' AND REGION = ?'
        params.append(region)
    if año and año != 'TODOS':
        query += ' AND AÑO = ?'
        params.append(int(año))
    if mes and mes != 'TODOS':
        query += ' AND MES = ?'
        params.append(mes)
    
    query += ' ORDER BY REGION, AÑO, MES'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    data = [dict_from_row(row) for row in rows]
    conn.close()
    
    return jsonify(data)

@app.route('/api/embarazadas/resumen', methods=['GET'])
def get_embarazadas_resumen():
    """Get summary of pregnant women data by region"""
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
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
            SUM(NUEVO_INGRESO) as NUEVO_INGRESO,
            SUM(META) as META
        FROM EMBARAZADAS WHERE 1=1
    '''
    params = []
    
    if region and region != 'TODOS':
        query += ' AND REGION = ?'
        params.append(region)
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

@app.route('/api/ce', methods=['GET'])
def get_ce():
    """Get CE (Consejería Electrónica) data with optional filters"""
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM CE WHERE 1=1'
    params = []
    
    if region and region != 'TODOS':
        query += ' AND REGION = ?'
        params.append(region)
    if año and año != 'TODOS':
        query += ' AND AÑO = ?'
        params.append(int(año))
    if mes and mes != 'TODOS':
        query += ' AND MES = ?'
        params.append(mes)
    
    query += ' ORDER BY REGION, AÑO, MES'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    data = [dict_from_row(row) for row in rows]
    conn.close()
    
    return jsonify(data)

@app.route('/api/ce/resumen', methods=['GET'])
def get_ce_resumen():
    """Get summary of CE data by region"""
    region = request.args.get('region')
    año = request.args.get('año')
    mes = request.args.get('mes')
    
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
    
    if region and region != 'TODOS':
        query += ' AND REGION = ?'
        params.append(region)
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
    """Get deposit/stock data by region"""
    region = request.args.get('region')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Si se especifica una región, devolver solo esa región
    if region and region != 'TODOS':
        cursor.execute('SELECT REGION, STOCK_ACTUAL FROM DEPOSITO WHERE REGION = ?', (region,))
        rows = cursor.fetchall()
        data = {}
        for row in rows:
            data[row[0]] = row[1]
    else:
        # Devolver todas las regiones
        cursor.execute('SELECT REGION, STOCK_ACTUAL FROM DEPOSITO')
        rows = cursor.fetchall()
        
        # Convertir a diccionario por región
        data = {}
        for row in rows:
            data[row[0]] = row[1]
    
    conn.close()
    return jsonify(data)

@app.route('/api/comparacion/regiones', methods=['GET'])
def get_comparacion_regiones():
    """Get comparison data between all regions with all data"""
    año = request.args.get('año')
    mes = request.args.get('mes')
    tipo = request.args.get('tipo', 'todos')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    data = {}
    
    if tipo in ['todos', 'ninos']:
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
                SUM(NUEVO_INGRESO) as NUEVO_INGRESO,
                'niños' as TIPO
            FROM NIÑOS WHERE 1=1
        '''
        params = []
        
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
                SUM(NUEVO_INGRESO) as NUEVO_INGRESO,
                'embarazadas' as TIPO
            FROM EMBARAZADAS WHERE 1=1
        '''
        params = []
        
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
                SUM(TOTAL_ASISTIDO) as TOTAL_ASISTIDO_CE,
                'ce' as TIPO
            FROM CE WHERE 1=1
        '''
        params = []
        
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
    return jsonify(data)

@app.route('/api/comparacion/años', methods=['GET'])
def get_comparacion_años():
    """Get comparison data between years"""
    region = request.args.get('region', 'TODOS')
    tipo = request.args.get('tipo', 'todos')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    data = {}
    
    # Get all years
    cursor.execute('SELECT DISTINCT AÑO FROM NIÑOS ORDER BY AÑO')
    años = [row[0] for row in cursor.fetchall()]
    
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
            
            if region and region != 'TODOS':
                query += ' AND REGION = ?'
                params.append(region)
            
            cursor.execute(query, params)
            row = cursor.fetchone()
            data[str(año)] = dict_from_row(row)
    
    conn.close()
    return jsonify(data)

@app.route('/api/alertas', methods=['GET'])
def get_alertas():
    """Get alert indicators for the traffic light map"""
    año = request.args.get('año')
    mes = request.args.get('mes')
    
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
    
    if año and año != 'TODOS':
        query += ' AND AÑO = ?'
        params.append(int(año))
    if mes and mes != 'TODOS':
        query += ' AND MES = ?'
        params.append(mes)
    
    query += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Calculate totals for percentage calculations
    total_desnutricion = sum(row[1] for row in rows if row[1])
    total_riesgo = sum(row[2] for row in rows if row[2])
    total_atrasos = sum(row[3] for row in rows if row[3])
    total_asistidos = sum(row[4] for row in rows if row[4])
    
    # Calculate averages for alert levels
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
        
        # Calculate alert levels (0=green, 1=yellow, 2=red)
        # Desnutrición: < avg = green, < 1.5*avg = yellow, >= 1.5*avg = red
        alert_desnutricion = 0 if desnutricion < avg_desnutricion else (1 if desnutricion < avg_desnutricion * 1.5 else 2)
        # Riesgo: < avg = green, < 1.5*avg = yellow, >= 1.5*avg = red
        alert_riesgo = 0 if riesgo < avg_riesgo else (1 if riesgo < avg_riesgo * 1.5 else 2)
        # Atrasos: < avg = green, < 1.5*avg = yellow, >= 1.5*avg = red
        alert_atrasos = 0 if atrasos < avg_atrasos else (1 if atrasos < avg_atrasos * 1.5 else 2)
        
        # Overall alert (highest level)
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

@app.route('/api/metas', methods=['GET'])
def get_metas():
    """Get meta compliance indicators for the traffic light map"""
    año = request.args.get('año')
    mes = request.args.get('mes')
    tipo = request.args.get('tipo', 'combinada')  # combinada, ninos, embarazadas
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Query for children (niños) data
    query_ninos = '''
        SELECT 
            REGION,
            SUM(NUEVO_INGRESO) as NUEVO_INGRESO,
            SUM(META) as META
        FROM NIÑOS WHERE 1=1
    '''
    params_ninos = []
    
    if año and año != 'TODOS':
        query_ninos += ' AND AÑO = ?'
        params_ninos.append(int(año))
    if mes and mes != 'TODOS':
        query_ninos += ' AND MES = ?'
        params_ninos.append(mes)
    
    query_ninos += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query_ninos, params_ninos)
    ninos_rows = cursor.fetchall()
    
    # Query for pregnant women (embarazadas) data
    query_embarazadas = '''
        SELECT 
            REGION,
            SUM(NUEVO_INGRESO) as NUEVO_INGRESO,
            SUM(META) as META
        FROM EMBARAZADAS WHERE 1=1
    '''
    params_embarazadas = []
    
    if año and año != 'TODOS':
        query_embarazadas += ' AND AÑO = ?'
        params_embarazadas.append(int(año))
    if mes and mes != 'TODOS':
        query_embarazadas += ' AND MES = ?'
        params_embarazadas.append(mes)
    
    query_embarazadas += ' GROUP BY REGION ORDER BY REGION'
    
    cursor.execute(query_embarazadas, params_embarazadas)
    embarazada_rows = cursor.fetchall()
    
    # Convert to dictionaries
    ninos_dict = {}
    for row in ninos_rows:
        region = row[0]
        nuevo_ingreso = row[1] if row[1] else 0
        meta = row[2] if row[2] else 0
        ninos_dict[region] = {
            'nuevo_ingreso': nuevo_ingreso,
            'meta': meta,
            'pct_cumplimiento': round((nuevo_ingreso / meta * 100) if meta > 0 else 0, 2)
        }
    
    embarazadas_dict = {}
    for row in embarazada_rows:
        region = row[0]
        nuevo_ingreso = row[1] if row[1] else 0
        meta = row[2] if row[2] else 0
        embarazadas_dict[region] = {
            'nuevo_ingreso': nuevo_ingreso,
            'meta': meta,
            'pct_cumplimiento': round((nuevo_ingreso / meta * 100) if meta > 0 else 0, 2)
        }
    
    # Combine regions from both datasets
    all_regions = set(ninos_dict.keys()) | set(embarazadas_dict.keys())
    
    data = []
    for region in sorted(all_regions):
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
        else:  # combinadas
            # Combined: sum of both totals and metas
            nuevo_ingreso = ninos_data['nuevo_ingreso'] + embarazada_data['nuevo_ingreso']
            meta = ninos_data['meta'] + embarazada_data['meta']
            pct_cumplimiento = round((nuevo_ingreso / meta * 100) if meta > 0 else 0, 2)
        
        # Calculate alert level based on percentage
        # 0-59%: Red (2), 60-79%: Yellow (1), 80%+: Green (0)
        if pct_cumplimiento >= 80:
            alert_level = 0  # Green
        elif pct_cumplimiento >= 60:
            alert_level = 1  # Yellow
        else:
            alert_level = 2  # Red
        
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

if __name__ == '__main__':
    print("=" * 60)
    print("  Panel de Cobertura - Paraguay")
    print("=" * 60)
    print("\nAbriendo servidor en: http://localhost:10000")
    print("\nPresiona Ctrl+C para detener el servidor\n")
    app.run(host="0.0.0.0", port=10000)
