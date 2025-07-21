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
 * @route   POST /api/solicitudes/:id/crear-presupuesto
 * @desc    RUTA: Convierte una solicitud en un presupuesto nuevo.
 * @access  Private (admin, ventas)
 */
router.post('/:id/crear-presupuesto', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { id } = req.params;

    try {
        await db.run('BEGIN TRANSACTION');

        // 1. Validar la solicitud
        const solicitud = await db.get('SELECT * FROM solicitudes_presupuesto WHERE id = ?', [id]);
        if (!solicitud) throw new Error('La solicitud no existe.');
        if (solicitud.estado !== 'Recibida') throw new Error(`Esta solicitud ya fue procesada (Estado: ${solicitud.estado}).`);

        // 2. Encontrar al cliente correspondiente
        const prospecto = await db.get('SELECT email FROM prospectos WHERE id = ?', [solicitud.prospecto_id]);
        const cliente = await db.get('SELECT id FROM clientes WHERE email = ?', [prospecto.email]);
        if (!cliente) throw new Error('El prospecto debe ser aprobado como cliente antes de crear un presupuesto.');

        // 3. Crear el nuevo presupuesto
        const fechaActual = new Date().toISOString();
        const presResult = await db.run(
            'INSERT INTO presupuestos (cliente_id, fecha, total, estado) VALUES (?, ?, ?, ?)',
            [cliente.id, fechaActual, 0, 'En Espera de Cotización']
        );
        const nuevoPresupuestoId = presResult.lastID;

        // 4. Actualizar la solicitud original
        await db.run(
            "UPDATE solicitudes_presupuesto SET estado = 'Presupuestado', presupuesto_asociado_id = ? WHERE id = ?",
            [nuevoPresupuestoId, id]
        );

        await db.run('COMMIT');
        
        // 5. Devolver el ID del nuevo presupuesto para que el frontend pueda redirigir
        res.status(201).json({ 
            message: `Presupuesto #${nuevoPresupuestoId} creado exitosamente.`,
            nuevoPresupuestoId: nuevoPresupuestoId
        });

    } catch (err) {
        await db.run('ROLLBACK');
        console.error(`Error al convertir solicitud #${id} a presupuesto:`, err);
        res.status(500).json({ message: 'Error al crear el presupuesto desde la solicitud.', error: err.message });
    }
});


/**
 * @route   PUT /api/solicitudes/:id/estado
 * @desc    Actualiza el estado de una solicitud (ej: para desestimarla).
 * @access  Private (admin, ventas)
 */
router.put('/:id/estado', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { id } = req.params;
    const { nuevo_estado } = req.body;
    if (!nuevo_estado) return res.status(400).json({ message: 'Se requiere un nuevo estado.' });

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