// backend/routes/proveedores.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Middleware de validación para datos de proveedores
const validateProveedorData = (req, res, next) => {
    const { nombre } = req.body;
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ message: 'El campo "nombre" del proveedor es obligatorio.' });
    }
    next();
};

/**
 * @route   GET /api/proveedores
 * @desc    Obtener todos los proveedores
 * @access  Private (admin, almacen, compras)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM proveedores ORDER BY nombre');
        const proveedores = stmt.all();
        res.status(200).json(proveedores);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los proveedores.', error: err.message });
    }
});

/**
 * @route   GET /api/proveedores/:id
 * @desc    Obtener un proveedor por su ID
 * @access  Private (admin, almacen, compras)
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM proveedores WHERE id = ?');
        const proveedor = stmt.get(req.params.id);
        if (proveedor) {
            res.status(200).json(proveedor);
        } else {
            res.status(404).json({ message: 'Proveedor no encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el proveedor.', error: err.message });
    }
});

/**
 * @route   POST /api/proveedores
 * @desc    Crear un nuevo proveedor
 * @access  Private (admin, almacen, compras)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), validateProveedorData, (req, res) => {
    const { nombre, cuit, telefono, email, direccion } = req.body;
    const sql = 'INSERT INTO proveedores (nombre, cuit, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)';
    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(nombre, cuit, telefono, email, direccion);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Proveedor creado exitosamente.' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'Error: El CUIT ingresado ya pertenece a otro proveedor.' });
        }
        res.status(500).json({ message: 'Error al crear el proveedor.', error: err.message });
    }
});

/**
 * @route   PUT /api/proveedores/:id
 * @desc    Actualizar un proveedor existente
 * @access  Private (admin, almacen, compras)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), validateProveedorData, (req, res) => {
    const { nombre, cuit, telefono, email, direccion } = req.body;
    const sql = `UPDATE proveedores SET nombre = ?, cuit = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?`;
    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(nombre, cuit, telefono, email, direccion, req.params.id);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Proveedor actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Proveedor no encontrado.' });
        }
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'Error: El CUIT ingresado ya pertenece a otro proveedor.' });
        }
        res.status(500).json({ message: 'Error al actualizar el proveedor.', error: err.message });
    }
});

/**
 * @route   DELETE /api/proveedores/:id
 * @desc    Eliminar un proveedor
 * @access  Private (admin, almacen)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'almacen']), (req, res) => {
    try {
        const stmt = db.prepare('DELETE FROM proveedores WHERE id = ?');
        const result = stmt.run(req.params.id);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Proveedor eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Proveedor no encontrado.' });
        }
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return res.status(409).json({ message: 'No se puede eliminar el proveedor porque tiene compras registradas.' });
        }
        res.status(500).json({ message: 'Error al eliminar el proveedor.', error: err.message });
    }
});

module.exports = router;