// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/dashboard/summary
 * @desc    Obtiene los datos agregados para el panel de control principal.
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/summary', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
    try {
        // 1. Total de Cuentas por Cobrar
        const cuentasPorCobrarStmt = db.prepare("SELECT SUM(saldo_pendiente) as total FROM facturas_venta WHERE saldo_pendiente > 0.01");
        const cuentasPorCobrar = cuentasPorCobrarStmt.get();

        // 2. Nuevos Prospectos Pendientes
        const nuevosProspectosStmt = db.prepare("SELECT COUNT(id) as count FROM prospectos WHERE estado = 'Pendiente'");
        const nuevosProspectos = nuevosProspectosStmt.get();

        // 3. Presupuestos listos para facturar
        const presupuestosAFacturarStmt = db.prepare("SELECT COUNT(id) as count FROM presupuestos WHERE estado = 'En Ejecución'");
        const presupuestosAFacturar = presupuestosAFacturarStmt.get();

        // 4. Datos para el gráfico de ventas de los últimos 30 días
        const treintaDiasAtras = new Date();
        treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
        
        const ventasSql = `
            SELECT 
                strftime('%Y-%m-%d', fecha_emision) as dia,
                SUM(total_factura) as total
            FROM facturas_venta
            WHERE fecha_emision >= ?
            GROUP BY dia
            ORDER BY dia ASC;
        `;
        const ventasStmt = db.prepare(ventasSql);
        const ventasUltimos30Dias = ventasStmt.all(treintaDiasAtras.toISOString());

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