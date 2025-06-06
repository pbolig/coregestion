// backend/routes/clientes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Asegúrate de que la ruta a db.js sea correcta
const { authenticateToken, authorizeRoles } = require('../middleware/auth'); // Asegúrate de que la ruta sea correcta

// Obtener todos los clientes (solo admin y ventas)
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
    db.all(`SELECT * FROM clientes`, [], (err, rows) => {
        if (err) {
            console.error('ERROR BACKEND: Error al obtener clientes de la DB:', err.message); // DEBUG EN BACKEND
            return res.status(500).json({ message: 'Error interno del servidor al obtener clientes.' });
        }
        console.log('DEBUG BACKEND: Clientes obtenidos de la DB:', rows); // DEBUG EN BACKEND
        res.json(rows); // <--- ¡Asegúrate de que esta línea esté y sea la última!
    });
});

// Crear un nuevo cliente (solo admin y ventas)
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { nombre, cuit, direccion, telefono, email } = req.body;
    db.run(`INSERT INTO clientes (nombre, cuit, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)`,
        [nombre, cuit, direccion, telefono, email],
        function(err) {
            if (err) {
                console.error('Error al insertar cliente en la DB:', err.message); // DEBUG EN BACKEND
                return res.status(500).json({ message: err.message });
            }
            res.status(201).json({ id: this.lastID, message: 'Cliente creado exitosamente.' });
        }
    );
});

module.exports = router;