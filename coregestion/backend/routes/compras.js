// backend/routes/compras.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/compras
 * @desc    Obtener un listado de todas las compras realizadas.
 * @access  Private (admin, compras, almacen)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'compras', 'almacen']), (req, res) => {
    try {
        const sql = `
            SELECT c.id, c.fecha_comprobante, c.total_compra, p.nombre as proveedor_nombre
            FROM compras_insumos c
            JOIN proveedores p ON c.proveedor_id = p.id
            ORDER BY c.fecha_comprobante DESC, c.id DESC
        `;
        const stmt = db.prepare(sql);
        const compras = stmt.all();
        res.status(200).json(compras);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el listado de compras.', error: err.message });
    }
});

/**
 * @route   GET /api/compras/:id
 * @desc    Ver el detalle de una compra específica.
 * @access  Private (admin, compras, almacen)
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'compras', 'almacen']), (req, res) => {
    const { id } = req.params;
    try {
        const compraSql = `
            SELECT c.*, p.nombre as proveedor_nombre
            FROM compras_insumos c
            JOIN proveedores p ON c.proveedor_id = p.id
            WHERE c.id = ?
        `;
        const compraStmt = db.prepare(compraSql);
        const compra = compraStmt.get(id);

        if (!compra) {
            return res.status(404).json({ message: 'Compra no encontrada.' });
        }

        const detallesSql = `
            SELECT d.*, i.nombre as insumo_nombre, i.unidad
            FROM detalle_compras_insumos d
            JOIN insumos i ON d.insumo_id = i.id
            WHERE d.compra_id = ?
        `;
        const detallesStmt = db.prepare(detallesSql);
        const detalles = detallesStmt.all(id);

        res.status(200).json({ ...compra, detalles });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el detalle de la compra.', error: err.message });
    }
});


/**
 * @route   POST /api/compras
 * @desc    Registrar una nueva compra, afectando stock.
 * @access  Private (admin, compras, almacen)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'compras', 'almacen']), (req, res) => {
    const { proveedor_id, fecha_comprobante, porcentaje_descuento, insumos_adquiridos } = req.body;

    if (!proveedor_id || !fecha_comprobante || !Array.isArray(insumos_adquiridos) || insumos_adquiridos.length === 0) {
        return res.status(400).json({ message: 'Datos de compra incompletos.' });
    }

    try {
        const createPurchase = db.transaction((data) => {
            let totalCalculado = data.insumos_adquiridos.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario_compra), 0);
            const descuento = totalCalculado * ((data.porcentaje_descuento || 0) / 100);
            const totalFinal = totalCalculado - descuento;

            const insertCompraStmt = db.prepare('INSERT INTO compras_insumos (fecha_comprobante, proveedor_id, porcentaje_descuento, total_compra) VALUES (?, ?, ?, ?)');
            const result = insertCompraStmt.run(data.fecha_comprobante, data.proveedor_id, data.porcentaje_descuento, totalFinal);
            const compraId = result.lastInsertRowid;

            const insertDetalleStmt = db.prepare('INSERT INTO detalle_compras_insumos (compra_id, insumo_id, cantidad, precio_unitario_compra) VALUES (?, ?, ?, ?)');
            const updateStockStmt = db.prepare('UPDATE insumos SET stock = stock + ? WHERE id = ?');

            for (const item of data.insumos_adquiridos) {
                insertDetalleStmt.run(compraId, item.insumo_id, item.cantidad, item.precio_unitario_compra);
                updateStockStmt.run(item.cantidad, item.insumo_id);
            }
            
            return compraId;
        });

        const newCompraId = createPurchase({ proveedor_id, fecha_comprobante, porcentaje_descuento, insumos_adquiridos });
        res.status(201).json({ id: newCompraId, message: 'Compra registrada con éxito y stock actualizado.' });

    } catch (err) {
        console.error('[COMPRAS-ERROR] Falló la transacción de compra:', err);
        res.status(500).json({ message: 'Error al registrar la compra.', error: err.message });
    }
});


module.exports = router;