
// backend/routes/insumos.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// Middleware de validación para insumos
const validateInsumoData = (req, res, next) => {
    const { nombre, stock, precio_unitario } = req.body;
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ message: 'El campo "nombre" es obligatorio.' });
    }
    if (stock === null || isNaN(stock) || stock < 0) {
        return res.status(400).json({ message: 'El campo "stock" debe ser un número no negativo.' });
    }
    if (precio_unitario === null || isNaN(precio_unitario) || precio_unitario < 0) {
        return res.status(400).json({ message: 'El campo "precio_unitario" debe ser un número no negativo.' });
    }
    next();
};

/**
 * @route   GET /api/insumos
 * @desc    Obtener todos los insumos
 * @access  Private (admin, ventas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    try {
        const insumos = await db.all('SELECT * FROM insumos ORDER BY nombre');
        res.status(200).json(insumos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los insumos.', error: err.message });
    }
});

/**
 * @route   POST /api/insumos
 * @desc    Crear un nuevo insumo
 * @access  Private (admin)
 */
router.post('/', authenticateToken, authorizeRoles(['admin']), validateInsumoData, async (req, res) => {
    const { nombre, stock, unidad, estado, precio_unitario } = req.body;
    const sql = `INSERT INTO insumos (nombre, stock, unidad, estado, precio_unitario) 
                 VALUES (?, ?, ?, ?, ?)`;
    try {
        const result = await db.run(sql, [nombre, stock, unidad, estado || 'Disponible', precio_unitario]);
        res.status(201).json({ id: result.lastID, message: 'Insumo creado exitosamente.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al crear el insumo.', error: err.message });
    }
});

/**
 * @route   PUT /api/insumos/:id
 * @desc    Actualizar un insumo
 * @access  Private (admin)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin']), validateInsumoData, async (req, res) => {
    const { nombre, stock, unidad, estado, precio_unitario, cantidad_pendiente } = req.body;
    const sql = `UPDATE insumos SET 
                    nombre = ?, stock = ?, unidad = ?, estado = ?, 
                    precio_unitario = ?, cantidad_pendiente = ?
                 WHERE id = ?`;
    try {
        const result = await db.run(sql, [nombre, stock, unidad, estado, precio_unitario, cantidad_pendiente, req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Insumo actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Insumo no encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el insumo.', error: err.message });
    }
});

/**
 * @route   DELETE /api/insumos/:id
 * @desc    Eliminar un insumo
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const result = await db.run('DELETE FROM insumos WHERE id = ?', [req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Insumo eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Insumo no encontrado.' });
        }
    } catch (err) {
        if (err.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(409).json({ message: 'No se puede eliminar el insumo porque está siendo utilizado en presupuestos o compras.' });
        }
        res.status(500).json({ message: 'Error al eliminar el insumo.', error: err.message });
    }
});

module.exports = router;