// backend/routes/presupuestos.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// --- Lógica de la Máquina de Estados ---
const validTransitions = {
    'En Espera de Cotización': ['Aprobado por Cliente', 'Rechazado'],
    'Pendiente de Insumos': ['En Espera de Cotización', 'Aprobado por Cliente', 'Rechazado'],
    'Aprobado por Cliente': ['En Ejecución', 'Cancelado'],
    'En Ejecución': ['Facturado', 'Cancelado'],
    // Los estados 'Rechazado', 'Facturado', 'Cancelado' son finales, no tienen transiciones de salida.
};

/**
 * @route   PUT /api/presupuestos/:id/estado
 * @desc    Actualizar el estado de un presupuesto siguiendo un flujo lógico.
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
        if (!presupuesto) {
            throw new Error('Presupuesto no encontrado.');
        }

        const estadoActual = presupuesto.estado;

        // 1. Validar si la transición de estado es permitida
        if (!validTransitions[estadoActual] || !validTransitions[estadoActual].includes(nuevo_estado)) {
            await db.run('ROLLBACK');
            return res.status(409).json({ message: `Acción no permitida: No se puede cambiar el estado de "${estadoActual}" a "${nuevo_estado}".` });
        }

        // 2. Lógica de negocio específica para cada transición
        if (nuevo_estado === 'Aprobado por Cliente') {
            // Validación crítica de stock antes de aprobar
            const insumos = await db.all('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);
            for (const item of insumos) {
                const insumoDB = await db.get('SELECT nombre, stock FROM insumos WHERE id = ?', [item.insumo_id]);
                if (insumoDB.stock < item.cantidad) {
                    await db.run('ROLLBACK');
                    return res.status(409).json({ message: `No se puede aprobar. Stock insuficiente para el insumo: ${insumoDB.nombre}` });
                }
            }
            // Si hay stock, se descuenta
            for (const item of insumos) {
                await db.run('UPDATE insumos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        } else if (nuevo_estado === 'Cancelado' && ['Aprobado por Cliente', 'En Ejecución'].includes(estadoActual)) {
            // Si se cancela un presupuesto que ya había consumido stock, lo reintegramos.
            const insumos = await db.all('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);
            for (const item of insumos) {
                await db.run('UPDATE insumos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        }
        
        // 3. Actualizar el estado del presupuesto
        await db.run('UPDATE presupuestos SET estado = ? WHERE id = ?', [nuevo_estado, id]);

        await db.run('COMMIT');
        res.status(200).json({ message: `Estado del presupuesto actualizado a "${nuevo_estado}".` });

    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al cambiar el estado del presupuesto.', error: err.message });
    }
});

/**
 * @route   GET /api/presupuestos
 * @desc    Obtener todos los presupuestos con el nombre del cliente.
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const sql = `
        SELECT p.id, p.fecha, p.total, p.estado, c.nombre as cliente_nombre
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
 * @desc    Obtener un presupuesto detallado.
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    try {
        const presupuesto = await db.get(`SELECT p.*, c.nombre as cliente_nombre FROM presupuestos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?`, [req.params.id]);
        if (!presupuesto) return res.status(404).json({ message: 'Presupuesto no encontrado.' });
        
        const insumos = await db.all(`SELECT pi.cantidad, i.nombre, i.precio_unitario, i.id as insumo_id FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?`, [req.params.id]);
        res.status(200).json({ ...presupuesto, insumos });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el detalle del presupuesto.', error: err.message });
    }
});

/**
 * @route   POST /api/presupuestos
 * @desc    Crear un nuevo presupuesto con lógica de pendientes.
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    // La lógica de creación no cambia
    const { cliente_id, fecha, insumos, estado, usarStockDisponible } = req.body;
    if (!cliente_id || !fecha || !Array.isArray(insumos) || insumos.length === 0) return res.status(400).json({ message: 'Datos incompletos.' });

    try {
        await db.run('BEGIN TRANSACTION');

        if (!usarStockDisponible && estado !== 'Pendiente de Insumos') {
            for (const item of insumos) {
                const insumoDB = await db.get('SELECT nombre, stock FROM insumos WHERE id = ?', [item.insumo_id]);
                if (!insumoDB) throw new Error(`Insumo ID ${item.insumo_id} no existe.`);
                if (insumoDB.stock < item.cantidad) {
                    await db.run('ROLLBACK');
                    return res.status(409).json({ error: "Conflicto de stock", message: `Stock insuficiente para '${insumoDB.nombre}'.`, detalles: { insumoId: item.insumo_id, insumoNombre: insumoDB.nombre, solicitado: item.cantidad, disponible: insumoDB.stock } });
                }
            }
        }
        
        let totalCalculado = 0;
        const insumosParaProcesar = [...insumos];
        if (usarStockDisponible) {
            for (const item of insumosParaProcesar) {
                const insumoDB = await db.get('SELECT stock, precio_unitario FROM insumos WHERE id = ?', [item.insumo_id]);
                item.cantidad = Math.min(item.cantidad, insumoDB.stock); 
            }
        }
        for(const item of insumosParaProcesar) {
             const insumoDB = await db.get('SELECT precio_unitario FROM insumos WHERE id = ?', [item.insumo_id]);
             totalCalculado += item.cantidad * insumoDB.precio_unitario;
        }

        const presResult = await db.run('INSERT INTO presupuestos (cliente_id, fecha, total, estado) VALUES (?, ?, ?, ?)', [cliente_id, fecha, totalCalculado, estado]);
        const presupuestoId = presResult.lastID;

        for (const item of insumosParaProcesar) {
            await db.run('INSERT INTO presupuesto_insumos (presupuesto_id, insumo_id, cantidad) VALUES (?, ?, ?)', [presupuestoId, item.insumo_id, item.cantidad]);
            if (estado === 'Pendiente de Insumos') {
                const insumoDB = await db.get('SELECT stock FROM insumos WHERE id = ?', [item.insumo_id]);
                const faltante = item.cantidad - insumoDB.stock;
                if (faltante > 0) {
                    await db.run('INSERT INTO presupuesto_pendientes (presupuesto_id, insumo_id, cantidad_necesaria) VALUES (?, ?, ?)', [presupuestoId, item.insumo_id, faltante]);
                    await db.run('UPDATE insumos SET cantidad_pendiente = cantidad_pendiente + ? WHERE id = ?', [faltante, item.insumo_id]);
                }
            } else if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(estado)) {
                await db.run('UPDATE insumos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        }

        await db.run('COMMIT');
        res.status(201).json({ id: presupuestoId, message: 'Presupuesto creado exitosamente.' });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al crear el presupuesto.', error: err.message });
    }
});


/* --- RUTA CORREGIDA / AÑADIDA PARA ACTUALIZAR PRESUPUESTOS --- */
/**
 * @route   PUT /api/presupuestos/:id
 * @desc    Actualizar un presupuesto completo.
 * @access  Private (admin, ventas)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { id } = req.params;
    const { cliente_id, fecha, insumos, estado } = req.body;

    if (!cliente_id || !fecha || !Array.isArray(insumos) || !estado) {
        return res.status(400).json({ message: 'Datos de actualización incompletos.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        // 1. Revertir impacto del estado anterior del presupuesto
        const presupuestoAnterior = await db.get('SELECT estado FROM presupuestos WHERE id = ?', [id]);
        if (presupuestoAnterior.estado === 'Pendiente de Insumos') {
            const pendientesAsociados = await db.all('SELECT insumo_id, cantidad_necesaria FROM presupuesto_pendientes WHERE presupuesto_id = ?', [id]);
            for (const pendiente of pendientesAsociados) {
                await db.run('UPDATE insumos SET cantidad_pendiente = MAX(0, cantidad_pendiente - ?) WHERE id = ?', [pendiente.cantidad_necesaria, pendiente.insumo_id]);
            }
        } else if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(presupuestoAnterior.estado)) {
            const insumosAnteriores = await db.all('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);
            for (const item of insumosAnteriores) {
                await db.run('UPDATE insumos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        }

        // 2. Borrar detalles antiguos (insumos y pendientes)
        await db.run('DELETE FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);
        await db.run('DELETE FROM presupuesto_pendientes WHERE presupuesto_id = ?', [id]);
        
        // 3. Recalcular total y actualizar cabecera del presupuesto
        let totalCalculado = 0;
        for(const item of insumos) {
            const insumoDB = await db.get('SELECT precio_unitario FROM insumos WHERE id = ?', [item.insumo_id]);
            totalCalculado += item.cantidad * insumoDB.precio_unitario;
        }
        await db.run('UPDATE presupuestos SET cliente_id = ?, fecha = ?, total = ?, estado = ? WHERE id = ?', [cliente_id, fecha, totalCalculado, estado, id]);

        // 4. Re-insertar insumos y aplicar nueva lógica de stock/pendientes
        for (const item of insumos) {
            await db.run('INSERT INTO presupuesto_insumos (presupuesto_id, insumo_id, cantidad) VALUES (?, ?, ?)', [id, item.insumo_id, item.cantidad]);
            if (estado === 'Pendiente de Insumos') {
                const insumoDB = await db.get('SELECT stock FROM insumos WHERE id = ?', [item.insumo_id]);
                const faltante = item.cantidad - insumoDB.stock;
                if (faltante > 0) {
                    await db.run('INSERT INTO presupuesto_pendientes (presupuesto_id, insumo_id, cantidad_necesaria) VALUES (?, ?, ?)', [id, item.insumo_id, faltante]);
                    await db.run('UPDATE insumos SET cantidad_pendiente = cantidad_pendiente + ? WHERE id = ?', [faltante, item.insumo_id]);
                }
            } else if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(estado)) {
                await db.run('UPDATE insumos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        }
        
        await db.run('COMMIT');
        res.status(200).json({ message: 'Presupuesto actualizado exitosamente.' });

    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al actualizar el presupuesto.', error: err.message });
    }
});


/**
 * @route   DELETE /api/presupuestos/:id
 * @desc    Eliminar un presupuesto.
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    // ... La lógica de DELETE no cambia y se mantiene igual ...
    const { id } = req.params;
    try {
        await db.run('BEGIN TRANSACTION');
        const presupuesto = await db.get('SELECT estado FROM presupuestos WHERE id = ?', [id]);
        if (!presupuesto) throw new Error('Presupuesto no encontrado.');
        const insumosDelPresupuesto = await db.all('SELECT insumo_id, cantidad FROM presupuesto_insumos WHERE presupuesto_id = ?', [id]);
        if (presupuesto.estado === 'Pendiente de Insumos') {
            const pendientesAsociados = await db.all('SELECT insumo_id, cantidad_necesaria FROM presupuesto_pendientes WHERE presupuesto_id = ?', [id]);
            for (const pendiente of pendientesAsociados) {
                await db.run('UPDATE insumos SET cantidad_pendiente = MAX(0, cantidad_pendiente - ?) WHERE id = ?', [pendiente.cantidad_necesaria, pendiente.insumo_id]);
            }
        } else if (['Aprobado por Cliente', 'En Ejecución', 'Facturado'].includes(presupuesto.estado)) {
            for (const item of insumosDelPresupuesto) {
                await db.run('UPDATE insumos SET stock = stock + ? WHERE id = ?', [item.cantidad, item.insumo_id]);
            }
        }
        await db.run('DELETE FROM presupuestos WHERE id = ?', [id]);
        await db.run('COMMIT');
        res.status(200).json({ message: 'Presupuesto eliminado y su impacto ha sido revertido.' });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al eliminar el presupuesto.', error: err.message });
    }
});

module.exports = router;