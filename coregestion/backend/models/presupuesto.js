// backend/routes/presupuestos.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   GET /api/presupuestos
 * @desc    Obtener todos los presupuestos con info del cliente
 * @access  Private (admin, ventas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const sql = `
        SELECT p.id, p.fecha, p.total, p.estado, c.nombre as cliente_nombre
        FROM presupuestos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        ORDER BY p.fecha DESC
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
 * @desc    Obtener un presupuesto detallado con sus insumos
 * @access  Private (admin, ventas)
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    try {
        const presupuesto = await db.get(`
            SELECT p.*, c.nombre as cliente_nombre 
            FROM presupuestos p 
            LEFT JOIN clientes c ON p.cliente_id = c.id 
            WHERE p.id = ?`, 
        [req.params.id]);

        if (!presupuesto) {
            return res.status(404).json({ message: 'Presupuesto no encontrado.' });
        }

        const insumos = await db.all(`
            SELECT pi.cantidad, i.nombre, i.precio_unitario, i.id as insumo_id
            FROM presupuesto_insumos pi
            JOIN insumos i ON pi.insumo_id = i.id
            WHERE pi.presupuesto_id = ?`, 
        [req.params.id]);

        res.status(200).json({ ...presupuesto, insumos });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el detalle del presupuesto.', error: err.message });
    }
});

/**
 * @route   POST /api/presupuestos
 * @desc    Crear un nuevo presupuesto y sus detalles (transaccional)
 * @access  Private (admin, ventas)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { cliente_id, fecha, insumos, estado } = req.body;

    if (!cliente_id || !fecha || !insumos || !Array.isArray(insumos) || insumos.length === 0) {
        return res.status(400).json({ message: 'Datos incompletos. Se requiere cliente, fecha y una lista de insumos.' });
    }

    try {
        // --- Inicio de la transacción manual ---
        await db.run('BEGIN TRANSACTION');

        // 1. Calcular el total y verificar precios
        let totalCalculado = 0;
        for (const item of insumos) {
            const insumoDB = await db.get('SELECT precio_unitario FROM insumos WHERE id = ?', [item.insumo_id]);
            if (!insumoDB) throw new Error(`El insumo con ID ${item.insumo_id} no existe.`);
            totalCalculado += item.cantidad * insumoDB.precio_unitario;
        }

        // 2. Insertar la cabecera del presupuesto
        const presupuestoSql = 'INSERT INTO presupuestos (cliente_id, fecha, total, estado) VALUES (?, ?, ?, ?)';
        const presupuestoResult = await db.run(presupuestoSql, [cliente_id, fecha, totalCalculado, estado || 'Pendiente']);
        const presupuestoId = presupuestoResult.lastID;

        // 3. Insertar los insumos del presupuesto
        const insumoSql = 'INSERT INTO presupuesto_insumos (presupuesto_id, insumo_id, cantidad) VALUES (?, ?, ?)';
        for (const item of insumos) {
            await db.run(insumoSql, [presupuestoId, item.insumo_id, item.cantidad]);
        }

        // --- Fin de la transacción ---
        await db.run('COMMIT');

        res.status(201).json({ id: presupuestoId, message: 'Presupuesto creado exitosamente.' });

    } catch (err) {
        // Si algo falla, revertimos todos los cambios
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al crear el presupuesto.', error: err.message });
    }
});

/**
 * @route   PUT /api/presupuestos/:id/estado
 * @desc    Actualizar el estado de un presupuesto (ej: a 'Aprobado')
 * @access  Private (admin, ventas)
 */
router.put('/:id/estado', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { estado } = req.body;
    const { id } = req.params;

    if (!estado) {
        return res.status(400).json({ message: 'Se requiere un nuevo estado.' });
    }

    try {
        // Lógica adicional si el presupuesto se aprueba: descontar stock
        if (estado.toLowerCase() === 'aprobado') {
            await db.run('BEGIN TRANSACTION');

            // Obtener todos los insumos del presupuesto
            const insumos = await db.all('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);

            for (const item of insumos) {
                // Descontar el stock de cada insumo
                await db.run('UPDATE insumos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }

            // Aquí también se podría generar un movimiento en la cuenta corriente del cliente
            // const presupuesto = await db.get('SELECT total, cliente_id FROM presupuestos WHERE id = ?', [id]);
            // ...lógica para añadir a cuenta corriente...
        }

        // Actualizar el estado del presupuesto
        const result = await db.run('UPDATE presupuestos SET estado = ? WHERE id = ?', [estado, id]);
        
        await db.run('COMMIT');

        if (result.changes > 0) {
            res.status(200).json({ message: `Presupuesto actualizado a estado: ${estado}` });
        } else {
            res.status(404).json({ message: 'Presupuesto no encontrado.' });
        }
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al actualizar el estado del presupuesto.', error: err.message });
    }
});

module.exports = router;