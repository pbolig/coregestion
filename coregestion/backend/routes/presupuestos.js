// backend/routes/presupuestos.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// --- Máquina de Estados: Define las transiciones válidas ---
const validTransitions = {
    'En Espera de Cotización': ['Aprobado por Cliente', 'Rechazado'],
    'Pendiente de Insumos': ['En Espera de Cotización', 'Aprobado por Cliente', 'Rechazado'],
    'Aprobado por Cliente': ['En Ejecución', 'Cancelado'],
    'En Ejecución': ['Facturado', 'Cancelado'],
    'Facturado': ['Fac. Fiscal', 'Cancelado']
};

/**
 * @route   GET /api/presupuestos
 * @desc    Obtener todos los presupuestos con el nombre del cliente.
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const sql = `
        SELECT p.id, p.fecha, p.total, p.estado, c.nombre as cliente_nombre 
        FROM presupuestos p 
        LEFT JOIN clientes c ON p.cliente_id = c.id 
        ORDER BY p.id DESC`;
    try {
        const stmt = db.prepare(sql);
        const presupuestos = stmt.all();
        res.status(200).json(presupuestos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los presupuestos.', error: err.message });
    }
});

/**
 * @route   GET /api/presupuestos/:id
 * @desc    Obtener un presupuesto detallado.
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    try {
        const presupuestoStmt = db.prepare(`SELECT p.*, c.nombre as cliente_nombre FROM presupuestos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?`);
        const presupuesto = presupuestoStmt.get(req.params.id);
        if (!presupuesto) return res.status(404).json({ message: 'Presupuesto no encontrado.' });
        
        const insumosStmt = db.prepare(`SELECT pi.cantidad, i.nombre, i.precio_unitario, i.id as insumo_id FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?`);
        const insumos = insumosStmt.all(req.params.id);
        
        res.status(200).json({ ...presupuesto, insumos });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el detalle del presupuesto.', error: err.message });
    }
});

/**
 * @route   POST /api/presupuestos
 * @desc    Crear un nuevo presupuesto.
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { cliente_id, fecha, insumos, estado, solicitud_origen_id } = req.body;
    if (!cliente_id || !fecha || !Array.isArray(insumos) || insumos.length === 0) {
        return res.status(400).json({ message: 'Datos incompletos.' });
    }

    try {
        const createTransaction = db.transaction((data) => {
            let totalCalculado = 0;
            for (const item of data.insumos) {
                const insumoDB = db.prepare('SELECT precio_unitario FROM insumos WHERE id = ?').get(item.insumo_id);
                totalCalculado += item.cantidad * insumoDB.precio_unitario;
            }

            const presResult = db.prepare('INSERT INTO presupuestos (cliente_id, fecha, total, estado) VALUES (?, ?, ?, ?)').run(data.cliente_id, data.fecha, totalCalculado, data.estado);
            const presupuestoId = presResult.lastInsertRowid;

            const stmtItems = db.prepare('INSERT INTO presupuesto_insumos (presupuesto_id, insumo_id, cantidad) VALUES (?, ?, ?)');
            for (const item of data.insumos) {
                stmtItems.run(presupuestoId, item.insumo_id, item.cantidad);
            }
            
            if (data.solicitud_origen_id) {
                db.prepare("UPDATE solicitudes_presupuesto SET estado = 'Presupuestado', presupuesto_asociado_id = ? WHERE id = ?").run(presupuestoId, data.solicitud_origen_id);
            }
            return presupuestoId;
        });

        const nuevoPresupuestoId = createTransaction({ cliente_id, fecha, insumos, estado, solicitud_origen_id });
        res.status(201).json({ id: nuevoPresupuestoId, message: 'Presupuesto creado exitosamente.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al crear el presupuesto.', error: err.message });
    }
});

/**
 * @route   PUT /api/presupuestos/:id/estado
 * @desc    Actualizar el estado de un presupuesto.
 */
router.put('/:id/estado', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { nuevo_estado } = req.body;
    const { id } = req.params;
    if (!nuevo_estado) return res.status(400).json({ message: 'Se requiere un nuevo estado.' });

    try {
        const updateStateTransaction = db.transaction((presupuestoId, nuevoEstado) => {
            const presupuesto = db.prepare('SELECT estado FROM presupuestos WHERE id = ?').get(presupuestoId);
            if (!presupuesto) throw new Error('Presupuesto no encontrado.');

            const estadoActual = presupuesto.estado;
            if (!validTransitions[estadoActual] || !validTransitions[estadoActual].includes(nuevoEstado)) {
                throw new Error(`Acción no permitida: No se puede cambiar de "${estadoActual}" a "${nuevoEstado}".`);
            }

            if (nuevoEstado === 'Aprobado por Cliente') {
                const insumos = db.prepare('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?').all(presupuestoId);
                for (const item of insumos) {
                    const insumoDB = db.prepare('SELECT nombre, stock FROM insumos WHERE id = ?').get(item.insumo_id);
                    if (insumoDB.stock < item.cantidad) {
                        throw new Error(`Stock insuficiente para: ${insumoDB.nombre}`);
                    }
                }
                for (const item of insumos) {
                    db.prepare('UPDATE insumos SET stock = stock - ? WHERE id = ?').run(item.cantidad, item.insumo_id);
                }
            } else if (nuevoEstado === 'Cancelado' && ['Aprobado por Cliente', 'En Ejecución'].includes(estadoActual)) {
                const insumos = db.prepare('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?').all(presupuestoId);
                for (const item of insumos) {
                    db.prepare('UPDATE insumos SET stock = stock + ? WHERE id = ?').run(item.cantidad, item.insumo_id);
                }
            }
            
            db.prepare('UPDATE presupuestos SET estado = ? WHERE id = ?').run(nuevoEstado, presupuestoId);
        });

        updateStateTransaction(id, nuevo_estado);
        res.status(200).json({ message: `Estado del presupuesto actualizado a "${nuevo_estado}".` });
    } catch (err) {
        res.status(500).json({ message: 'Error al cambiar el estado.', error: err.message });
    }
});

/**
 * @route   PUT /api/presupuestos/:id
 * @desc    Actualizar un presupuesto existente.
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { id } = req.params;
    const { cliente_id, fecha, insumos, estado } = req.body;
    if (!cliente_id || !fecha || !Array.isArray(insumos) || !estado) return res.status(400).json({ message: 'Datos de actualización incompletos.' });

    try {
        const updateTransaction = db.transaction((data) => {
            const presupuestoAnterior = db.prepare('SELECT estado FROM presupuestos WHERE id = ?').get(data.id);
            if (!presupuestoAnterior) throw new Error('Presupuesto no encontrado.');

            if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(presupuestoAnterior.estado)) {
                const insumosAnteriores = db.prepare('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?').all(data.id);
                for (const item of insumosAnteriores) {
                    db.prepare('UPDATE insumos SET stock = stock + ? WHERE id = ?').run(item.cantidad, item.insumo_id);
                }
            }
            
            db.prepare('DELETE FROM presupuesto_insumos WHERE presupuesto_id = ?').run(data.id);
            
            let totalCalculado = 0;
            for (const item of data.insumos) {
                const insumoDB = db.prepare('SELECT precio_unitario FROM insumos WHERE id = ?').get(item.insumo_id);
                totalCalculado += item.cantidad * insumoDB.precio_unitario;
            }

            db.prepare('UPDATE presupuestos SET cliente_id = ?, fecha = ?, total = ?, estado = ? WHERE id = ?').run(data.cliente_id, data.fecha, totalCalculado, data.estado, data.id);
            
            const stmtItems = db.prepare('INSERT INTO presupuesto_insumos (presupuesto_id, insumo_id, cantidad) VALUES (?, ?, ?)');
            for (const item of data.insumos) {
                stmtItems.run(data.id, item.insumo_id, item.cantidad);
                if (['Aprobado por Cliente', 'En Ejecución'].includes(data.estado)) {
                    db.prepare('UPDATE insumos SET stock = stock - ? WHERE id = ?').run(item.cantidad, item.insumo_id);
                }
            }
        });

        updateTransaction({ id, cliente_id, fecha, insumos, estado });
        res.status(200).json({ message: 'Presupuesto actualizado exitosamente.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el presupuesto.', error: err.message });
    }
});

/**
 * @route   DELETE /api/presupuestos/:id
 * @desc    Eliminar un presupuesto y revertir su impacto.
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    const { id } = req.params;
    
    try {
        const deleteTransaction = db.transaction((presupuestoId) => {
            const presupuesto = db.prepare('SELECT estado FROM presupuestos WHERE id = ?').get(presupuestoId);
            if (!presupuesto) throw new Error('Presupuesto no encontrado.');

            if (['Aprobado por Cliente', 'En Ejecución', 'Facturado', 'Fac. Fiscal'].includes(presupuesto.estado)) {
                const insumosDelPresupuesto = db.prepare('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?').all(presupuestoId);
                for (const item of insumosDelPresupuesto) {
                    db.prepare('UPDATE insumos SET stock = stock + ? WHERE id = ?').run(item.cantidad, item.insumo_id);
                }
            }
            
            const result = db.prepare('DELETE FROM presupuestos WHERE id = ?').run(presupuestoId);
            if (result.changes === 0) throw new Error('No se pudo eliminar el presupuesto.');
        });

        deleteTransaction(id);
        res.status(200).json({ message: 'Presupuesto eliminado y su impacto ha sido revertido.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar el presupuesto.', error: err.message });
    }
});

module.exports = router;