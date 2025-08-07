// backend/routes/clientes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // <-- AHORA IMPORTA LA DB DIRECTAMENTE
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Ya no necesitamos la lógica de dbPromise.then(...)

/**
 * @route   GET /api/clientes
 * @desc    Obtener todos los clientes
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM clientes ORDER BY nombre');
        const clientes = stmt.all();
        res.status(200).json(clientes);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los clientes.', error: err.message });
    }
});

/**
 * @route   GET /api/clientes/:id
 * @desc    Obtener un cliente por su ID
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM clientes WHERE id = ?');
        const cliente = stmt.get(req.params.id);
        if (cliente) {
            res.status(200).json(cliente);
        } else {
            res.status(404).json({ message: 'Cliente no encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el cliente.', error: err.message });
    }
});

/**
 * @route   POST /api/clientes
 * @desc    Crear un nuevo cliente
 * @access  Private (admin, ventas)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { nombre, cuit, direccion, telefono, email } = req.body;
    if (!nombre) return res.status(400).json({ message: 'El nombre es requerido.' });

    try {
        const stmt = db.prepare('INSERT INTO clientes (nombre, cuit, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)');
        const result = stmt.run(nombre, cuit, direccion, telefono, email);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Cliente creado exitosamente.' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'Error: El CUIT o Email ya pertenecen a otro cliente.' });
        }
        res.status(500).json({ message: 'Error al crear el cliente.', error: err.message });
    }
});

/**
 * @route   PUT /api/clientes/:id
 * @desc    Actualizar un cliente existente
 * @access  Private (admin, ventas)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { nombre, cuit, direccion, telefono, email } = req.body;
    const { id } = req.params;

    try {
        const stmt = db.prepare('UPDATE clientes SET nombre = ?, cuit = ?, direccion = ?, telefono = ?, email = ? WHERE id = ?');
        const result = stmt.run(nombre, cuit, direccion, telefono, email, id);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Cliente actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Cliente no encontrado.' });
        }
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'Error: El CUIT o Email ya pertenecen a otro cliente.' });
        }
        res.status(500).json({ message: 'Error al actualizar el cliente.', error: err.message });
    }
});

/**
 * @route   DELETE /api/clientes/:id
 * @desc    Eliminar un cliente
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM clientes WHERE id = ?');
        const result = stmt.run(id);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Cliente eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Cliente no encontrado.' });
        }
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return res.status(409).json({ message: 'No se puede eliminar el cliente porque tiene presupuestos o facturas asociadas.' });
        }
        res.status(500).json({ message: 'Error al eliminar el cliente.', error: err.message });
    }
});

module.exports = router;
