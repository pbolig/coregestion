// backend/routes/portal.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
// Usamos el mismo middleware de autenticación, ya que solo valida el token.
const { authenticateToken } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   POST /api/portal/solicitudes
 * @desc    Permite a un prospecto logueado enviar una nueva solicitud de presupuesto.
 * @access  Private (Solo para prospectos autenticados)
 */
router.post('/solicitudes', authenticateToken, async (req, res) => {
    const { descripcion_necesidad } = req.body;
    // El ID del prospecto lo obtenemos del token, que fue decodificado por el middleware.
    const prospectoId = req.user?.prospectoId;

    if (!prospectoId) {
        return res.status(403).json({ message: 'Token inválido o no corresponde a un prospecto.' });
    }
    if (!descripcion_necesidad) {
        return res.status(400).json({ message: 'La descripción de la necesidad es obligatoria.' });
    }

    try {
        const fecha_solicitud = new Date().toISOString();
        const sql = `INSERT INTO solicitudes_presupuesto (prospecto_id, fecha_solicitud, descripcion_necesidad) VALUES (?, ?, ?)`;
        
        await db.run(sql, [prospectoId, fecha_solicitud, descripcion_necesidad]);

        res.status(201).json({ message: 'Su solicitud ha sido enviada con éxito. Nos pondremos en contacto a la brevedad.' });

    } catch (err) {
        res.status(500).json({ message: 'Error en el servidor al enviar la solicitud.', error: err.message });
    }
});

/**
 * @route   GET /api/portal/solicitudes
 * @desc    Permite a un prospecto logueado ver sus propias solicitudes.
 * @access  Private (Solo para prospectos autenticados)
 */
router.get('/solicitudes', authenticateToken, async (req, res) => {
    const prospectoId = req.user?.prospectoId;

    if (!prospectoId) {
        return res.status(403).json({ message: 'Token inválido.' });
    }
    
    try {
        const sql = `SELECT id, fecha_solicitud, descripcion_necesidad, estado FROM solicitudes_presupuesto WHERE prospecto_id = ? ORDER BY fecha_solicitud DESC`;
        const misSolicitudes = await db.all(sql, [prospectoId]);
        res.status(200).json(misSolicitudes);
    } catch(err) {
        res.status(500).json({ message: 'Error al obtener sus solicitudes.', error: err.message });
    }
});


module.exports = router;