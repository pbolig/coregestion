// backend/routes/clientes.js
const express = require('express');
const router = express.Router();
// Importamos la PROMESA de la base de datos, no la conexión directa.
// Esto asegura que la DB esté inicializada antes de usarla.
const dbPromise = require('../db'); 
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
// Esperamos a que la promesa de la base de datos se resuelva
dbPromise.then(database => {
    db = database;
}).catch(err => {
    console.error("Error al inicializar la base de datos para las rutas de clientes:", err);
});

// --- VALIDACIÓN DE DATOS (Middleware opcional pero recomendado) ---
const validateClienteData = (req, res, next) => {
    const { nombre } = req.body;
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ message: 'El campo "nombre" es obligatorio.' });
    }
    next();
};

// --- RUTAS DEL CRUD PARA CLIENTES ---

/**
 * @route   GET /api/clientes
 * @desc    Obtener todos los clientes
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    try {
        const clientes = await db.all('SELECT * FROM clientes ORDER BY nombre');
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
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    try {
        const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
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
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), validateClienteData, async (req, res) => {
    const { nombre, cuit, direccion, telefono, email } = req.body;
    const sql = 'INSERT INTO clientes (nombre, cuit, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)';
    
    try {
        const result = await db.run(sql, [nombre, cuit, direccion, telefono, email]);
        res.status(201).json({ 
            id: result.lastID, 
            message: 'Cliente creado exitosamente.' 
        });
    } catch (err) {
        // Manejo específico para CUIT duplicado
        if (err.message.includes('UNIQUE constraint failed: clientes.cuit')) {
            return res.status(409).json({ message: 'Error: El CUIT ingresado ya existe para otro cliente.' });
        }
        res.status(500).json({ message: 'Error al crear el cliente.', error: err.message });
    }
});

/**
 * @route   PUT /api/clientes/:id
 * @desc    Actualizar un cliente existente
 * @access  Private (admin, ventas)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'ventas']), validateClienteData, async (req, res) => {
    const { nombre, cuit, direccion, telefono, email } = req.body;
    const sql = `UPDATE clientes SET 
                    nombre = ?, 
                    cuit = ?, 
                    direccion = ?, 
                    telefono = ?, 
                    email = ? 
                 WHERE id = ?`;
                 
    try {
        const result = await db.run(sql, [nombre, cuit, direccion, telefono, email, req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Cliente actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Cliente no encontrado.' });
        }
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed: clientes.cuit')) {
            return res.status(409).json({ message: 'Error: El CUIT ingresado ya existe para otro cliente.' });
        }
        res.status(500).json({ message: 'Error al actualizar el cliente.', error: err.message });
    }
});

/**
 * @route   DELETE /api/clientes/:id
 * @desc    Eliminar un cliente
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const result = await db.run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Cliente eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Cliente no encontrado.' });
        }
    } catch (err) {
        // Manejo de error de clave foránea
        if (err.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(409).json({ message: 'No se puede eliminar el cliente porque tiene presupuestos o movimientos asociados.' });
        }
        res.status(500).json({ message: 'Error al eliminar el cliente.', error: err.message });
    }
});

module.exports = router;