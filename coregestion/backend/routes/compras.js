// backend/routes/compras.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   GET /api/compras
 * @desc    Obtener un listado de todas las compras realizadas.
 * @access  Private (admin, compras, almacen)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'compras', 'almacen']), async (req, res) => {
    try {
        const sql = `
            SELECT c.id, c.fecha_comprobante, c.total_compra, p.nombre as proveedor_nombre
            FROM compras_insumos c
            JOIN proveedores p ON c.proveedor_id = p.id
            ORDER BY c.fecha_comprobante DESC, c.id DESC
        `;
        const compras = await db.all(sql);
        res.status(200).json(compras);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el listado de compras.', error: err.message });
    }
});

/**
 * @route   GET /api/compras/:id
 * @desc    Ver el detalle de una compra específica (cabecera y líneas de insumos).
 * @access  Private (admin, compras, almacen)
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'compras', 'almacen']), async (req, res) => {
    const { id } = req.params;
    try {
        const compra = await db.get(`
            SELECT c.*, p.nombre as proveedor_nombre
            FROM compras_insumos c
            JOIN proveedores p ON c.proveedor_id = p.id
            WHERE c.id = ?
        `, [id]);

        if (!compra) {
            return res.status(404).json({ message: 'Compra no encontrada.' });
        }

        const detalles = await db.all(`
            SELECT d.*, i.nombre as insumo_nombre, i.unidad
            FROM detalle_compras_insumos d
            JOIN insumos i ON d.insumo_id = i.id
            WHERE d.compra_id = ?
        `, [id]);

        res.status(200).json({ ...compra, detalles });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el detalle de la compra.', error: err.message });
    }
});


/**
 * @route   POST /api/compras
 * @desc    Registrar una nueva compra, afectando stock y resolviendo pendientes.
 * @access  Private (admin, compras, almacen)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'compras', 'almacen']), async (req, res) => {
    const { fecha_comprobante, proveedor_id, porcentaje_descuento = 0, insumos_adquiridos } = req.body;

    if (!fecha_comprobante || !proveedor_id || !Array.isArray(insumos_adquiridos) || insumos_adquiridos.length === 0) {
        return res.status(400).json({ message: 'Datos incompletos. Se requiere fecha, proveedor y al menos un insumo.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        let totalCompra = insumos_adquiridos.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario_compra), 0);
        if (porcentaje_descuento > 0) {
            totalCompra *= (1 - porcentaje_descuento / 100);
        }

        const compraResult = await db.run(
            'INSERT INTO compras_insumos (fecha_comprobante, proveedor_id, porcentaje_descuento, total_compra) VALUES (?, ?, ?, ?)',
            [fecha_comprobante, proveedor_id, porcentaje_descuento, totalCompra]
        );
        const compraId = compraResult.lastID;

        for (const item of insumos_adquiridos) {
            await db.run('INSERT INTO detalle_compras_insumos (compra_id, insumo_id, cantidad, precio_unitario_compra) VALUES (?, ?, ?, ?)',
                [compraId, item.insumo_id, item.cantidad, item.precio_unitario_compra]
            );
            
            await db.run('UPDATE insumos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            
            const pendientes = await db.all(
                "SELECT id, cantidad_necesaria FROM presupuesto_pendientes WHERE insumo_id = ? AND estado = 'Pendiente' ORDER BY id", 
                [item.insumo_id]
            );

            if (pendientes.length > 0) {
                let stockActual = (await db.get('SELECT stock FROM insumos WHERE id = ?', [item.insumo_id])).stock;
                for (const pendiente of pendientes) {
                    if (stockActual >= pendiente.cantidad_necesaria) {
                        await db.run("UPDATE presupuesto_pendientes SET estado = 'Surtido' WHERE id = ?", [pendiente.id]);
                        await db.run("UPDATE insumos SET cantidad_pendiente = MAX(0, cantidad_pendiente - ?) WHERE id = ?", [pendiente.cantidad_necesaria, item.insumo_id]);
                    }
                }
            }
        }

        await db.run('COMMIT');
        res.status(201).json({ id: compraId, message: 'Compra registrada, stock actualizado y pendientes resueltos.' });

    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al registrar la compra de insumos.', error: err.message });
    }
});


module.exports = router;