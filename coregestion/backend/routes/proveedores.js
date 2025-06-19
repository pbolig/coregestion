// backend/routes/proveedores.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => {
    db = database;
}).catch(err => {
    console.error("Error al inicializar la base de datos para las rutas de proveedores:", err);
});

// Middleware de validación para datos de proveedores
const validateProveedorData = (req, res, next) => {
    const { nombre } = req.body;
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ message: 'El campo "nombre" del proveedor es obligatorio.' });
    }
    next();
};

// --- RUTAS DEL CRUD PARA PROVEEDORES ---

/**
 * @route   GET /api/proveedores
 * @desc    Obtener todos los proveedores
 * @access  Private (admin, almacen, compras)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), async (req, res) => {
    try {
        const proveedores = await db.all('SELECT * FROM proveedores ORDER BY nombre');
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
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), async (req, res) => {
    try {
        const proveedor = await db.get('SELECT * FROM proveedores WHERE id = ?', [req.params.id]);
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
router.post('/', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), validateProveedorData, async (req, res) => {
    const { nombre, cuit, telefono, email, direccion } = req.body;
    const sql = 'INSERT INTO proveedores (nombre, cuit, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)';
    try {
        const result = await db.run(sql, [nombre, cuit, telefono, email, direccion]);
        res.status(201).json({ id: result.lastID, message: 'Proveedor creado exitosamente.' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed: proveedores.cuit')) {
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
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), validateProveedorData, async (req, res) => {
    const { nombre, cuit, telefono, email, direccion } = req.body;
    const sql = `UPDATE proveedores SET 
                    nombre = ?, cuit = ?, telefono = ?, email = ?, direccion = ? 
                 WHERE id = ?`;
    try {
        const result = await db.run(sql, [nombre, cuit, telefono, email, direccion, req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Proveedor actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Proveedor no encontrado.' });
        }
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed: proveedores.cuit')) {
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
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'almacen']), async (req, res) => {
    try {
        const result = await db.run('DELETE FROM proveedores WHERE id = ?', [req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Proveedor eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Proveedor no encontrado.' });
        }
    } catch (err) {
        // Esta es una protección CRÍTICA gracias al `PRAGMA foreign_keys = ON;` de db.js
        if (err.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(409).json({ message: 'No se puede eliminar el proveedor porque tiene compras registradas.' });
        }
        res.status(500).json({ message: 'Error al eliminar el proveedor.', error: err.message });
    }
});

module.exports = router;