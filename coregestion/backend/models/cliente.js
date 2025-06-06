// backend/routes/clientes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Obtener todos los clientes (solo admin y ventas)
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
	db.all(`SELECT * FROM clientes`, [], (err, rows) => {
		if (err) {
			return res.status(500).json({ message: err.message });
		}
		res.json(rows);
	});
});

// Crear un nuevo cliente (solo admin y ventas)
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
	const { nombre, cuit, direccion, telefono, email } = req.body;
	db.run(`INSERT INTO clientes (nombre, cuit, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)`,
		[nombre, cuit, direccion, telefono, email],
		function(err) {
			if (err) {
				return res.status(500).json({ message: err.message });
			}
			res.status(201).json({ id: this.lastID, message: 'Cliente creado exitosamente.' });
		}
	);
});

// Más rutas: GET /clientes/:id, PUT /clientes/:id, DELETE /clientes/:id
// ...

module.exports = router;