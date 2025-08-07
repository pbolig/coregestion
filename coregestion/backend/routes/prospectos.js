// backend/routes/prospectos.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/prospectos
 * @desc    Listar todos los prospectos, con opción de filtrar por estado.
 * @access  Private (admin, ventas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    try {
        let sql = 'SELECT id, nombre, empresa, email, telefono, estado FROM prospectos';
        const params = [];

        if (req.query.estado) {
            sql += ' WHERE estado = ?';
            params.push(req.query.estado);
        }

        sql += ' ORDER BY id DESC';

        const stmt = db.prepare(sql);
        const prospectos = stmt.all(params);
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
router.post('/:id/aprobar', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { id } = req.params;
    try {
        const approveTransaction = db.transaction((prospectoId) => {
            const prospecto = db.prepare('SELECT * FROM prospectos WHERE id = ?').get(prospectoId);
            if (!prospecto) throw new Error('Prospecto no encontrado.');
            if (prospecto.estado !== 'Pendiente') throw new Error(`El prospecto ya se encuentra en estado '${prospecto.estado}'.`);

            // Verificamos si ya existe un cliente con ese email antes de insertar
            const existingClient = db.prepare('SELECT id FROM clientes WHERE email = ?').get(prospecto.email);
            if (existingClient) {
                // Lanzamos un error con un código específico para manejarlo en el catch
                const err = new Error('Ya existe un cliente con este email.');
                err.code = 'SQLITE_CONSTRAINT_UNIQUE';
                throw err;
            }

            const clienteData = { nombre: prospecto.nombre, cuit: null, direccion: null, telefono: prospecto.telefono, email: prospecto.email };
            db.prepare('INSERT INTO clientes (nombre, cuit, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)').run(clienteData.nombre, clienteData.cuit, clienteData.direccion, clienteData.telefono, clienteData.email);
            
            db.prepare("UPDATE prospectos SET estado = 'Aprobado' WHERE id = ?").run(prospectoId);
        });

        approveTransaction(id);
        res.status(200).json({ message: 'Prospecto aprobado y convertido en cliente exitosamente.' });

    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
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
router.post('/:id/rechazar', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare("UPDATE prospectos SET estado = 'Rechazado' WHERE id = ? AND estado = 'Pendiente'");
        const result = stmt.run(id);
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