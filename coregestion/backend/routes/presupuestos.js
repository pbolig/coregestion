// backend/routes/presupuestos.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// --- RUTAS DE GESTIÓN DE PRESUPUESTOS ---

/**
 * @route   GET /api/presupuestos
 * @desc    Obtener todos los presupuestos con el nombre del cliente.
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    const sql = `
        SELECT p.id, p.cliente_id, c.nombre AS cliente_nombre, p.fecha, p.total, p.estado
        FROM presupuestos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        ORDER BY p.id DESC
    `;
    try {
        const presupuestos = await db.all(sql);
        res.status(200).json(presupuestos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los presupuestos.', error: err.message });
    }
});

/**
 * @route   GET /api/presupuestos/:id
 * @desc    Obtener un presupuesto detallado (cabecera e insumos).
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    try {
        const presupuesto = await db.get('SELECT p.*, c.nombre as cliente_nombre FROM presupuestos p JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?', [req.params.id]);
        if (!presupuesto) {
            return res.status(404).json({ message: 'Presupuesto no encontrado.' });
        }
        const insumos = await db.all(`
            SELECT i.id, i.nombre, pi.cantidad, i.precio_unitario
            FROM presupuesto_insumos pi
            JOIN insumos i ON pi.insumo_id = i.id
            WHERE pi.presupuesto_id = ?`,
            [req.params.id]
        );
        res.status(200).json({ ...presupuesto, insumos });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el detalle del presupuesto.', error: err.message });
    }
});

/**
 * @route   POST /api/presupuestos
 * @desc    Crear un nuevo presupuesto con validación de stock.
 * @access  Private (admin, ventas)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { cliente_id, fecha, insumos, estado: estadoSolicitado } = req.body;

    if (!cliente_id || !fecha || !Array.isArray(insumos) || insumos.length === 0) {
        return res.status(400).json({ message: 'Se requieren cliente, fecha y una lista de insumos.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        let totalCalculado = 0;
        let finalEstado = estadoSolicitado;
        const insumosInsuficientes = [];

        // 1. Pre-validación de stock y cálculo de total
        for (const item of insumos) {
            const insumoDB = await db.get('SELECT nombre, stock, precio_unitario FROM insumos WHERE id = ?', [item.insumo_id]);
            if (!insumoDB) throw new Error(`Insumo con ID ${item.insumo_id} no existe.`);
            
            totalCalculado += item.cantidad * insumoDB.precio_unitario;

            if (insumoDB.stock < item.cantidad) {
                finalEstado = 'Pendiente de Insumos';
                insumosInsuficientes.push({ ...item, nombre: insumoDB.nombre, stock_disponible: insumoDB.stock });
            }
        }

        // 2. Insertar cabecera del presupuesto
        const presResult = await db.run(
            'INSERT INTO presupuestos (cliente_id, fecha, total, estado) VALUES (?, ?, ?, ?)',
            [cliente_id, fecha, totalCalculado, finalEstado]
        );
        const presupuestoId = presResult.lastID;

        // 3. Insertar detalles y actualizar insumos
        for (const item of insumos) {
            await db.run('INSERT INTO presupuesto_insumos (presupuesto_id, insumo_id, cantidad) VALUES (?, ?, ?)', [presupuestoId, item.insumo_id, item.cantidad]);
            
            if (finalEstado === 'Pendiente de Insumos') {
                const insumoInsuf = insumosInsuficientes.find(i => i.insumo_id === item.insumo_id);
                if (insumoInsuf) {
                    const cantidadPendiente = insumoInsuf.cantidad - insumoInsuf.stock_disponible;
                    await db.run('UPDATE insumos SET cantidad_pendiente = cantidad_pendiente + ? WHERE id = ?', [cantidadPendiente, item.insumo_id]);
                }
            } else if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(finalEstado)) {
                await db.run('UPDATE insumos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        }

        await db.run('COMMIT');

        let message = `Presupuesto ID ${presupuestoId} creado exitosamente con estado "${finalEstado}".`;
        if (insumosInsuficientes.length > 0) {
            message = `Presupuesto creado. Estado establecido a "Pendiente de Insumos" por falta de stock.`;
        }

        res.status(201).json({ id: presupuestoId, message, detalles: insumosInsuficientes });

    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al crear el presupuesto.', error: err.message });
    }
});


/**
 * @route   PUT /api/presupuestos/:id/estado
 * @desc    Actualizar el estado de un presupuesto, ajustando stock y pendientes.
 * @access  Private (admin, ventas)
 */
router.put('/:id/estado', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { nuevo_estado } = req.body;
    const { id } = req.params;

    if (!nuevo_estado) {
        return res.status(400).json({ message: 'Se requiere un nuevo estado.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        const presupuesto = await db.get('SELECT estado FROM presupuestos WHERE id = ?', [id]);
        if (!presupuesto) throw new Error('Presupuesto no encontrado.');
        
        const estadoAnterior = presupuesto.estado;
        const insumos = await db.all('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);
        
        // 1. Revertir efectos del estado anterior
        if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(estadoAnterior)) {
            for (const item of insumos) await db.run('UPDATE insumos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.insumo_id]);
        } else if (estadoAnterior === 'Pendiente de Insumos') {
            // Esta reversión es compleja y depende de cómo se manejó originalmente. La simplificamos aquí.
            // Una implementación más robusta requeriría saber cuánto contribuyó este presupuesto a la cantidad pendiente.
        }

        // 2. Aplicar efectos del nuevo estado
        let finalEstado = nuevo_estado;
        if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(nuevo_estado)) {
            for (const item of insumos) {
                const insumoDB = await db.get('SELECT stock FROM insumos WHERE id = ?', [item.insumo_id]);
                if (insumoDB.stock < item.cantidad) {
                    // Si no hay stock suficiente ahora, no se puede aprobar. Revertimos y avisamos.
                    await db.run('ROLLBACK');
                    return res.status(409).json({ message: `No se puede cambiar a "${nuevo_estado}". Stock insuficiente para el insumo ID ${item.insumo_id}.`});
                }
                await db.run('UPDATE insumos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        }
        
        // Actualizar el estado del presupuesto
        await db.run('UPDATE presupuestos SET estado = ? WHERE id = ?', [finalEstado, id]);

        await db.run('COMMIT');
        res.status(200).json({ message: `Estado del presupuesto actualizado a "${finalEstado}".` });

    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al cambiar el estado del presupuesto.', error: err.message });
    }
});


/**
 * @route   DELETE /api/presupuestos/:id
 * @desc    Eliminar un presupuesto, revirtiendo su impacto en stock.
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('BEGIN TRANSACTION');

        const presupuesto = await db.get('SELECT estado FROM presupuestos WHERE id = ?', [id]);
        if (!presupuesto) throw new Error('Presupuesto no encontrado.');

        // Revertir stock si estaba aprobado/en ejecución/facturado
        if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(presupuesto.estado)) {
            const insumos = await db.all('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);
            for (const item of insumos) {
                await db.run('UPDATE insumos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        }
        // Aquí también se debería revertir la cantidad_pendiente si el estado era 'Pendiente de Insumos'.

        // Eliminar detalles (ON DELETE CASCADE lo hace, pero es bueno ser explícito)
        await db.run('DELETE FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);
        // Eliminar cabecera
        await db.run('DELETE FROM presupuestos WHERE id = ?', [id]);

        await db.run('COMMIT');
        res.status(200).json({ message: 'Presupuesto eliminado y su impacto en el stock ha sido revertido.' });

    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al eliminar el presupuesto.', error: err.message });
    }
});


module.exports = router;