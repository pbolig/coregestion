// backend/routes/prospectos.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   GET /api/prospectos
 * @desc    Listar todos los prospectos, con opción de filtrar por estado.
 * @access  Private (admin, ventas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    try {
        let sql = 'SELECT id, nombre, empresa, email, telefono, estado FROM prospectos';
        const params = [];

        if (req.query.estado) {
            sql += ' WHERE estado = ?';
            params.push(req.query.estado);
        }

        sql += ' ORDER BY id DESC';

        const prospectos = await db.all(sql, params);
        res.status(200).json(prospectos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los prospectos.', error: err.message });
    }
});

/**
 * @route   POST /api/prospectos/:id/aprobar
 * @desc    Aprueba un prospecto, convirtiéndolo en un cliente formal.
 * @access  Private (admin, ventas)
 */
router.post('/:id/aprobar', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('BEGIN TRANSACTION');
        
        const prospecto = await db.get('SELECT * FROM prospectos WHERE id = ?', [id]);
        if (!prospecto) throw new Error('Prospecto no encontrado.');
        if (prospecto.estado !== 'Pendiente') throw new Error(`El prospecto ya se encuentra en estado '${prospecto.estado}'.`);

        const clienteData = { nombre: prospecto.nombre, cuit: null, direccion: null, telefono: prospecto.telefono, email: prospecto.email };
        await db.run(
            'INSERT INTO clientes (nombre, cuit, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)',
            [clienteData.nombre, clienteData.cuit, clienteData.direccion, clienteData.telefono, clienteData.email]
        );
        
        await db.run("UPDATE prospectos SET estado = 'Aprobado' WHERE id = ?", [id]);

        await db.run('COMMIT');
        res.status(200).json({ message: 'Prospecto aprobado y convertido en cliente exitosamente.' });

    } catch (err) {
        await db.run('ROLLBACK');
        if(err.message.includes('UNIQUE constraint failed: clientes.email')) {
             return res.status(409).json({ message: 'Error: Ya existe un cliente con este email.' });
        }
        res.status(500).json({ message: 'Error al aprobar el prospecto.', error: err.message });
    }
});


/**
 * @route   POST /api/prospectos/:id/rechazar
 * @desc    Rechaza un prospecto.
 * @access  Private (admin, ventas)
 */
router.post('/:id/rechazar', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.run("UPDATE prospectos SET estado = 'Rechazado' WHERE id = ? AND estado = 'Pendiente'", [id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Prospecto rechazado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Prospecto no encontrado o ya procesado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al rechazar el prospecto.', error: err.message });
    }
});

module.exports = router;