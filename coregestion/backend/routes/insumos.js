// backend/routes/insumos.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/insumos
 * @desc    Obtener todos los insumos.
 * @access  Private (varios roles)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'almacen', 'ventas']), (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM insumos ORDER BY nombre');
        const insumos = stmt.all();
        res.status(200).json(insumos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los insumos.', error: err.message });
    }
});

/**
 * @route   POST /api/insumos
 * @desc    Crear un nuevo insumo/servicio.
 * @access  Private (admin, almacen)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'almacen']), (req, res) => {
    const { nombre, unidad, stock, precio_unitario, es_recurrente } = req.body;
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ message: 'El nombre es requerido.' });
    }

    try {
        const sql = `
            INSERT INTO insumos (nombre, unidad, stock, precio_unitario, es_recurrente, estado, cantidad_pendiente) 
            VALUES (?, ?, ?, ?, ?, 'Disponible', 0)
        `;
        const stmt = db.prepare(sql);
        const result = stmt.run(
            nombre,
            unidad || 'unidad',
            parseInt(stock, 10) || 0,
            parseFloat(precio_unitario) || 0,
            es_recurrente ? 1 : 0
        );
        
        res.status(201).json({ id: result.lastInsertRowid, message: 'Insumo creado exitosamente.' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'Ya existe un insumo con ese nombre.' });
        }
        res.status(500).json({ message: 'Error al crear el insumo.', error: err.message });
    }
});

/**
 * @route   PUT /api/insumos/:id
 * @desc    Actualizar un insumo.
 * @access  Private (admin, almacen)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'almacen']), (req, res) => {
    const { id } = req.params;
    const { nombre, unidad, stock, precio_unitario, es_recurrente } = req.body;
    if (!nombre) return res.status(400).json({ message: 'El nombre es requerido.' });

    try {
        const sql = `
            UPDATE insumos 
            SET nombre = ?, unidad = ?, stock = ?, precio_unitario = ?, es_recurrente = ?
            WHERE id = ?
        `;
        const stmt = db.prepare(sql);
        const result = stmt.run(
            nombre,
            unidad,
            parseInt(stock, 10),
            parseFloat(precio_unitario),
            es_recurrente ? 1 : 0,
            id
        );

        if (result.changes > 0) {
            res.status(200).json({ message: 'Insumo actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Insumo no encontrado.' });
        }
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'El nombre del insumo ya está en uso.' });
        }
        res.status(500).json({ message: 'Error al actualizar el insumo.', error: err.message });
    }
});

/**
 * @route   DELETE /api/insumos/:id
 * @desc    Eliminar un insumo.
 * @access  Private (admin, almacen)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'almacen']), (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM insumos WHERE id = ?');
        const result = stmt.run(id);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Insumo eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Insumo no encontrado.' });
        }
    } catch (err) {
        // Error de restricción si el insumo está en uso en un presupuesto o compra
        if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return res.status(409).json({ message: 'No se puede eliminar el insumo porque está siendo utilizado en presupuestos o compras.' });
        }
        res.status(500).json({ message: 'Error al eliminar el insumo.', error: err.message });
    }
});

module.exports = router;