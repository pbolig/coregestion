// backend/routes/conceptos_cc.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/conceptos-cc
 * @desc    Obtener una lista de todos los conceptos de cuenta corriente.
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM conceptos_cc ORDER BY nombre');
        const conceptos = stmt.all();
        res.status(200).json(conceptos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los conceptos de cuenta corriente.', error: err.message });
    }
});

/**
 * @route   POST /api/conceptos-cc
 * @desc    Crear un nuevo concepto de cuenta corriente.
 * @access  Private (admin)
 */
router.post('/', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    const { nombre, tipo, requiere_aplicacion } = req.body;

    if (!nombre || !tipo) {
        return res.status(400).json({ message: 'El nombre y el tipo son obligatorios para crear un concepto.' });
    }
    if (!['DEBE', 'HABER'].includes(tipo.toUpperCase())) {
        return res.status(400).json({ message: "El tipo debe ser 'DEBE' o 'HABER'." });
    }

    try {
        const sql = `INSERT INTO conceptos_cc (nombre, tipo, requiere_aplicacion) VALUES (?, ?, ?)`;
        const stmt = db.prepare(sql);
        const result = stmt.run(nombre, tipo.toUpperCase(), requiere_aplicacion ? 1 : 0);
        res.status(201).json({ id: result.lastInsertRowid, message: 'Concepto creado exitosamente.' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'Ya existe un concepto con ese nombre.' });
        }
        res.status(500).json({ message: 'Error al crear el concepto.', error: err.message });
    }
});

module.exports = router;