// backend/routes/presupuestos.js

const express = require('express');
const router = express.Router();
const db = require('../db'); // Asegurate de que la ruta a db.js sea correcta
const { authenticateToken, authorizeRoles } = require('../middleware/auth'); // Asegurate de que la ruta sea correcta

// Ejemplo: Obtener todos los presupuestos (solo para roles admin y ventas)
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    db.all(`SELECT * FROM presupuestos`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// Ejemplo: Crear un nuevo presupuesto (solo para rol admin y ventas)
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { cliente_id, fecha, total, estado } = req.body;
    db.run(`INSERT INTO presupuestos (cliente_id, fecha, total, estado) VALUES (?, ?, ?, ?)`,
        [cliente_id, fecha, total, estado],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.status(201).json({ id: this.lastID, message: 'Presupuesto creado exitosamente.' });
        }
    );
});

// Puedes añadir mas rutas aqui:
// router.get('/:id', ...); // Obtener un presupuesto por ID
// router.put('/:id', ...); // Actualizar un presupuesto
// router.delete('/:id', ...); // Eliminar un presupuesto

module.exports = router;