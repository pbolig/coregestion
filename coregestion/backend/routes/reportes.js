// backend/routes/reportes.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    const { name, desde, hasta, estado } = req.query;
    if (!name) return res.status(400).json({ message: 'Se requiere el nombre del reporte.' });

    try {
        let data;
        switch (name) {
            case 'ventas_por_cliente':
                data = await generarReporteVentasPorCliente(desde, hasta);
                break;
            case 'cuentas_por_cobrar':
                data = await generarReporteCuentasPorCobrar();
                break;
            case 'estado_presupuestos':
                data = await generarReporteEstadoPresupuestos(desde, hasta, estado);
                break;
            default:
                return res.status(400).json({ message: `El reporte '${name}' no es válido.` });
        }
        res.status(200).json(data);
    } catch (err) {
        console.error(`Error al generar el reporte '${name}':`, err);
        res.status(500).json({ message: 'Error interno del servidor al generar el reporte.', error: err.message });
    }
});

/**
 * Función MEJORADA para generar el reporte de ventas por cliente,
 * discriminando entre facturación interna y fiscal.
 */
async function generarReporteVentasPorCliente(desde, hasta) {
    const fechaDesde = desde || '1970-01-01';
    const fechaHasta = hasta ? `${hasta}T23:59:59.999Z` : new Date().toISOString();
    
    // --- LÓGICA SQL MEJORADA ---
    // Usamos SUM(CASE...) para crear subtotales condicionales.
    const sql = `
        SELECT
            c.nombre as cliente,
            COUNT(fv.id) as cantidad_comprobantes,
            
            -- Suma solo las facturas que NO tienen número fiscal (son internas)
            SUM(CASE WHEN fv.numero_comprobante_fiscal IS NULL THEN fv.total_factura ELSE 0 END) as total_remitos,
            
            -- Suma solo las facturas que SÍ tienen número fiscal
            SUM(CASE WHEN fv.numero_comprobante_fiscal IS NOT NULL THEN fv.total_factura ELSE 0 END) as total_fiscal,
            
            -- El total general no cambia
            SUM(fv.total_factura) as total_general,
            
            MAX(fv.fecha_emision) as fecha_ultima_venta
        FROM facturas_venta fv
        JOIN clientes c ON fv.cliente_id = c.id
        WHERE fv.fecha_emision BETWEEN ? AND ?
        GROUP BY c.id, c.nombre
        ORDER BY total_general DESC;
    `;
    return await db.all(sql, [fechaDesde, fechaHasta]);
}

async function generarReporteCuentasPorCobrar() {
    const sql = `
        SELECT c.nombre as cliente, SUM(fv.saldo_pendiente) as deuda_total, MIN(fv.fecha_emision) as fecha_factura_mas_antigua
        FROM facturas_venta fv
        JOIN clientes c ON fv.cliente_id = c.id
        WHERE fv.saldo_pendiente > 0.01
        GROUP BY c.id, c.nombre
        ORDER BY deuda_total DESC;
    `;
    return await db.all(sql);
}

async function generarReporteEstadoPresupuestos(desde, hasta, estado) {
    const fechaDesde = desde || '1970-01-01';
    const fechaHasta = hasta ? `${hasta}T23:59:59.999Z` : new Date().toISOString();
    let sql = `
        SELECT p.id, p.fecha, p.estado, p.total, c.nombre as cliente_nombre
        FROM presupuestos p
        JOIN clientes c ON p.cliente_id = c.id
        WHERE p.fecha BETWEEN ? AND ?
    `;
    const params = [fechaDesde, fechaHasta];
    if (estado && estado !== 'Todos') {
        sql += ' AND p.estado = ?';
        params.push(estado);
    }
    sql += ' ORDER BY p.fecha DESC';
    return await db.all(sql, params);
}

module.exports = router;