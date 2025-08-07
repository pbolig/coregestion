// backend/routes/solicitudes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/solicitudes
 * @desc    Listar todas las solicitudes de presupuesto de los prospectos.
 * @access  Private (admin, ventas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    try {
        const sql = `
            SELECT 
                s.id, s.fecha_solicitud, s.descripcion_necesidad, s.estado,
                p.nombre as prospecto_nombre, p.email as prospecto_email, p.empresa as prospecto_empresa
            FROM solicitudes_presupuesto s
            JOIN prospectos p ON s.prospecto_id = p.id
            ORDER BY s.fecha_solicitud DESC
        `;
        const stmt = db.prepare(sql);
        const solicitudes = stmt.all();
        res.status(200).json(solicitudes);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener las solicitudes.', error: err.message });
    }
});

/**
 * @route   POST /api/solicitudes/:id/crear-presupuesto
 * @desc    Convierte una solicitud en un presupuesto nuevo.
 * @access  Private (admin, ventas)
 */
router.post('/:id/crear-presupuesto', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { id } = req.params;

    try {
        const createBudgetFromRequest = db.transaction((solicitudId) => {
            const solicitud = db.prepare('SELECT * FROM solicitudes_presupuesto WHERE id = ?').get(solicitudId);
            if (!solicitud) throw new Error('La solicitud no existe.');
            if (solicitud.estado !== 'Recibida') throw new Error(`Esta solicitud ya fue procesada (Estado: ${solicitud.estado}).`);

            const prospecto = db.prepare('SELECT email FROM prospectos WHERE id = ?').get(solicitud.prospecto_id);
            const cliente = db.prepare('SELECT id FROM clientes WHERE email = ?').get(prospecto.email);
            if (!cliente) throw new Error('El prospecto debe ser aprobado como cliente antes de crear un presupuesto.');

            const fechaActual = new Date().toISOString();
            const presResult = db.prepare('INSERT INTO presupuestos (cliente_id, fecha, total, estado) VALUES (?, ?, ?, ?)').run(cliente.id, fechaActual, 0, 'En Espera de Cotización');
            const nuevoPresupuestoId = presResult.lastInsertRowid;

            db.prepare("UPDATE solicitudes_presupuesto SET estado = 'Presupuestado', presupuesto_asociado_id = ? WHERE id = ?").run(nuevoPresupuestoId, solicitudId);
            
            return nuevoPresupuestoId;
        });

        const nuevoPresupuestoId = createBudgetFromRequest(id);
        res.status(201).json({ 
            message: `Presupuesto #${nuevoPresupuestoId} creado exitosamente.`,
            nuevoPresupuestoId: nuevoPresupuestoId
        });

    } catch (err) {
        console.error(`Error al convertir solicitud #${id} a presupuesto:`, err);
        res.status(500).json({ message: 'Error al crear el presupuesto desde la solicitud.', error: err.message });
    }
});


/**
 * @route   PUT /api/solicitudes/:id/estado
 * @desc    Actualiza el estado de una solicitud (ej: para desestimarla).
 * @access  Private (admin, ventas)
 */
router.put('/:id/estado', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { id } = req.params;
    const { nuevo_estado } = req.body;
    if (!nuevo_estado) return res.status(400).json({ message: 'Se requiere un nuevo estado.' });

    try {
        const stmt = db.prepare("UPDATE solicitudes_presupuesto SET estado = ? WHERE id = ?");
        const result = stmt.run(nuevo_estado, id);
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