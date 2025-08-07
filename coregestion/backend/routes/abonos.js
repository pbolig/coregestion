// backend/routes/abonos.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/abonos
 * @desc    Obtener una lista de todos los abonos/suscripciones.
 * @access  Private (admin, cobranzas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'cobranzas']), (req, res) => {
    try {
        const sql = `
            SELECT 
                a.id,
                a.monto_recurrente,
                a.frecuencia,
                a.proxima_fecha_facturacion,
                a.estado,
                c.nombre as cliente_nombre,
                i.nombre as insumo_nombre
            FROM abonos a
            JOIN clientes c ON a.cliente_id = c.id
            JOIN insumos i ON a.insumo_id = i.id
            ORDER BY a.proxima_fecha_facturacion DESC;
        `;
        const stmt = db.prepare(sql);
        const abonos = stmt.all();
        res.status(200).json(abonos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los abonos.', error: err.message });
    }
});

/**
 * @route   PUT /api/abonos/:id
 * @desc    Actualizar un abono (ej: cambiar monto, frecuencia o cancelarlo).
 * @access  Private (admin, cobranzas)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'cobranzas']), (req, res) => {
    const { id } = req.params;
    const { monto_recurrente, frecuencia, proxima_fecha_facturacion, estado } = req.body;

    if (!monto_recurrente || !frecuencia || !proxima_fecha_facturacion || !estado) {
        return res.status(400).json({ message: 'Todos los campos son requeridos para la actualización.' });
    }

    try {
        const sql = `
            UPDATE abonos SET
                monto_recurrente = ?,
                frecuencia = ?,
                proxima_fecha_facturacion = ?,
                estado = ?
            WHERE id = ?
        `;
        const stmt = db.prepare(sql);
        const result = stmt.run(monto_recurrente, frecuencia, proxima_fecha_facturacion, estado, id);

        if (result.changes === 0) {
            return res.status(404).json({ message: 'Abono no encontrado.' });
        }
        res.status(200).json({ message: 'Abono actualizado exitosamente.' });

    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el abono.', error: err.message });
    }
});

module.exports = router;