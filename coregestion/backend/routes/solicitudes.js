// backend/routes/solicitudes.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   GET /api/solicitudes
 * @desc    Listar todas las solicitudes de presupuesto de los prospectos.
 * @access  Private (admin, ventas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    try {
        const sql = `
            SELECT 
                s.id, s.fecha_solicitud, s.descripcion_necesidad, s.estado,
                p.nombre as prospecto_nombre, p.email as prospecto_email, p.empresa as prospecto_empresa
            FROM solicitudes_presupuesto s
            JOIN prospectos p ON s.prospecto_id = p.id
            ORDER BY s.fecha_solicitud DESC
        `;
        const solicitudes = await db.all(sql);
        res.status(200).json(solicitudes);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener las solicitudes.', error: err.message });
    }
});


/**
 * @route   PUT /api/solicitudes/:id/estado
 * @desc    Actualiza el estado de una solicitud.
 * @access  Private (admin, ventas)
 */
router.put('/:id/estado', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { id } = req.params;
    const { nuevo_estado } = req.body;

    if (!nuevo_estado) {
        return res.status(400).json({ message: 'Se requiere un nuevo estado para la solicitud.' });
    }

    try {
        const result = await db.run("UPDATE solicitudes_presupuesto SET estado = ? WHERE id = ?", [nuevo_estado, id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Estado de la solicitud actualizado.' });
        } else {
            res.status(404).json({ message: 'Solicitud no encontrada.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar la solicitud.', error: err.message });
    }
});

module.exports = router;