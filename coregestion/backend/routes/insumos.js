// backend/routes/insumos.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// Middleware de validación (sin cambios)
const validateInsumoData = (req, res, next) => {
    const { nombre, precio_unitario } = req.body;
    if (!nombre || nombre.trim() === '') return res.status(400).json({ message: 'El campo "nombre" es obligatorio.' });
    if (precio_unitario === null || isNaN(precio_unitario) || precio_unitario < 0) return res.status(400).json({ message: 'El "precio_unitario" debe ser un número no negativo.' });
    next();
};

/**
 * @route   GET /api/insumos
 * @desc    Obtener todos los insumos (datos maestros y stock)
 * @access  Private (admin, almacen, ventas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'almacen', 'ventas']), async (req, res) => {
    try {
        const insumos = await db.all('SELECT * FROM insumos ORDER BY nombre');
        res.status(200).json(insumos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los insumos.', error: err.message });
    }
});

/**
 * @route   GET /api/insumos/:id/pendientes
 * @desc    NUEVA RUTA: Obtener el detalle de los presupuestos que tienen pendiente un insumo específico.
 * @access  Private (admin, almacen, compras)
 */
router.get('/:id/pendientes', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), async (req, res) => {
    const { id } = req.params;
    try {
        const sql = `
            SELECT
                pp.cantidad_necesaria,
                p.id as presupuesto_id,
                p.fecha,
                c.nombre as cliente_nombre
            FROM presupuesto_pendientes pp
            JOIN presupuestos p ON pp.presupuesto_id = p.id
            JOIN clientes c ON p.cliente_id = c.id
            WHERE pp.insumo_id = ? AND pp.estado = 'Pendiente'
            ORDER BY p.fecha;
        `;
        const detallesPendientes = await db.all(sql, [id]);
        res.status(200).json(detallesPendientes);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el detalle de pendientes.', error: err.message });
    }
});


/**
 * @route   POST /api/insumos
 * @desc    Crear un nuevo insumo maestro (stock inicial 0)
 * @access  Private (admin, almacen)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'almacen']), validateInsumoData, async (req, res) => {
    const { nombre, unidad, precio_unitario } = req.body;
    const sql = `INSERT INTO insumos (nombre, stock, unidad, estado, precio_unitario, cantidad_pendiente) VALUES (?, 0, ?, 'Disponible', ?, 0)`;
    try {
        const result = await db.run(sql, [nombre, unidad, precio_unitario]);
        res.status(201).json({ id: result.lastID, message: 'Insumo maestro creado exitosamente.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al crear el insumo.', error: err.message });
    }
});

/**
 * @route   PUT /api/insumos/:id
 * @desc    Actualizar datos maestros de un insumo (nombre, unidad, precio)
 * @access  Private (admin, almacen)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'almacen']), validateInsumoData, async (req, res) => {
    const { nombre, unidad, precio_unitario } = req.body;
    const sql = `UPDATE insumos SET nombre = ?, unidad = ?, precio_unitario = ? WHERE id = ?`;
    try {
        const result = await db.run(sql, [nombre, unidad, precio_unitario, req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Datos maestros del insumo actualizados.' });
        } else {
            res.status(404).json({ message: 'Insumo no encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el insumo.', error: err.message });
    }
});

/**
 * @route   DELETE /api/insumos/:id
 * @desc    Eliminar un insumo maestro
 * @access  Private (admin, almacen)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'almacen']), async (req, res) => {
    try {
        const result = await db.run('DELETE FROM insumos WHERE id = ?', [req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Insumo eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Insumo no encontrado.' });
        }
    } catch (err) {
        if (err.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(409).json({ message: 'Conflicto: No se puede eliminar. El insumo está siendo utilizado en presupuestos o compras.' });
        }
        res.status(500).json({ message: 'Error al eliminar el insumo.', error: err.message });
    }
});


module.exports = router;