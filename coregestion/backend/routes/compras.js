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
    const { proveedor_id, fecha_comprobante, porcentaje_descuento, insumos_adquiridos } = req.body;
    
    console.log('[COMPRAS-DEBUG] Petición POST recibida en /api/compras');
    console.log('[COMPRAS-DEBUG] Datos recibidos:', JSON.stringify(req.body, null, 2));

    if (!proveedor_id || !fecha_comprobante || !Array.isArray(insumos_adquiridos) || insumos_adquiridos.length === 0) {
        return res.status(400).json({ message: 'Datos de compra incompletos.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');
        console.log('[COMPRAS-DEBUG] Transacción iniciada.');

        let totalCalculado = insumos_adquiridos.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario_compra), 0);
        const descuento = totalCalculado * (porcentaje_descuento / 100);
        const totalFinal = totalCalculado - descuento;

        const result = await db.run(
            'INSERT INTO compras_insumos (fecha_comprobante, proveedor_id, porcentaje_descuento, total_compra) VALUES (?, ?, ?, ?)',
            [fecha_comprobante, proveedor_id, porcentaje_descuento, totalFinal]
        );
        const compraId = result.lastID;
        console.log(`[COMPRAS-DEBUG] Registro de compra creado con ID: ${compraId}`);

        const stmtDetalle = await db.prepare('INSERT INTO detalle_compras_insumos (compra_id, insumo_id, cantidad, precio_unitario_compra) VALUES (?, ?, ?, ?)');
        
        for (const item of insumos_adquiridos) {
            console.log(`[COMPRAS-DEBUG] Procesando ítem: Insumo ID ${item.insumo_id}, Cantidad a sumar: ${item.cantidad}`);
            
            // --- DEPURACIÓN AVANZADA DE STOCK ---
            const stockActual = await db.get('SELECT stock FROM insumos WHERE id = ?', [item.insumo_id]);
            console.log(`[COMPRAS-DEBUG] Stock ANTES de la actualización para Insumo ID ${item.insumo_id}: ${stockActual.stock}`);
            
            await db.run('UPDATE insumos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            
            const stockNuevo = await db.get('SELECT stock FROM insumos WHERE id = ?', [item.insumo_id]);
            console.log(`[COMPRAS-DEBUG] Stock DESPUÉS de la actualización para Insumo ID ${item.insumo_id}: ${stockNuevo.stock}`);
            
            await stmtDetalle.run(compraId, item.insumo_id, item.cantidad, item.precio_unitario_compra);
        }
        
        await stmtDetalle.finalize();

        await db.run('COMMIT');
        console.log('[COMPRAS-DEBUG] Transacción confirmada.');
        res.status(201).json({ id: compraId, message: 'Compra registrada con éxito y stock actualizado.' });

    } catch (err) {
        await db.run('ROLLBACK');
        console.error('[COMPRAS-ERROR] Falló la transacción de compra:', err);
        res.status(500).json({ message: 'Error al registrar la compra.', error: err.message });
    }
});


module.exports = router;