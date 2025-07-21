// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   GET /api/dashboard/summary
 * @desc    Obtiene los datos agregados para el panel de control principal.
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/summary', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    try {
        // 1. Total de Cuentas por Cobrar
        const cuentasPorCobrar = await db.get("SELECT SUM(saldo_pendiente) as total FROM facturas_venta WHERE saldo_pendiente > 0.01");

        // 2. Nuevos Prospectos Pendientes
        const nuevosProspectos = await db.get("SELECT COUNT(id) as count FROM prospectos WHERE estado = 'Pendiente'");

        // 3. Presupuestos listos para facturar
        const presupuestosAFacturar = await db.get("SELECT COUNT(id) as count FROM presupuestos WHERE estado = 'En Ejecución'");

        // 4. Datos para el gráfico de ventas de los últimos 30 días
        const treintaDiasAtras = new Date();
        treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
        
        const ventasUltimos30Dias = await db.all(`
            SELECT 
                strftime('%Y-%m-%d', fecha_emision) as dia,
                SUM(total_factura) as total
            FROM facturas_venta
            WHERE fecha_emision >= ?
            GROUP BY dia
            ORDER BY dia ASC;
        `, [treintaDiasAtras.toISOString()]);

        res.status(200).json({
            cuentasPorCobrar: cuentasPorCobrar?.total || 0,
            nuevosProspectos: nuevosProspectos?.count || 0,
            presupuestosAFacturar: presupuestosAFacturar?.count || 0,
            ventasUltimos30Dias: ventasUltimos30Dias
        });

    } catch (err) {
        console.error("Error al generar el resumen del dashboard:", err);
        res.status(500).json({ message: 'Error al obtener los datos del dashboard.', error: err.message });
    }
});

module.exports = router;