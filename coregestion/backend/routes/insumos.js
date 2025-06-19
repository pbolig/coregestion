// backend/routes/insumos.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// Middleware de validación para los datos maestros del insumo
const validateInsumoData = (req, res, next) => {
    const { nombre, precio_unitario } = req.body;
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ message: 'El campo "nombre" es obligatorio.' });
    }
    if (precio_unitario === null || isNaN(precio_unitario) || precio_unitario < 0) {
        return res.status(400).json({ message: 'El campo "precio_unitario" debe ser un número no negativo.' });
    }
    next();
};

// --- RUTAS DE GESTIÓN DE INSUMOS ---

/**
 * @route   GET /api/insumos
 * @desc    Obtener todos los insumos
 * @access  Private (admin, almacen, ventas)
 */
router.get('/', authenticateToken, authorizeRoles(['admin', 'almacen', 'ventas']), async (req, res) => {
    try {
        const insumos = await db.all('SELECT * FROM insumos ORDER BY nombre');
        res.status(200).json(insumos);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los insumos.', error: err.message });
    }
});

/**
 * @route   POST /api/insumos
 * @desc    Crear un nuevo insumo (datos maestros)
 * @access  Private (admin, almacen)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'almacen']), validateInsumoData, async (req, res) => {
    // El stock y la cantidad pendiente siempre empiezan en 0 al crear el maestro
    const { nombre, unidad, precio_unitario } = req.body;
    const sql = `INSERT INTO insumos (nombre, stock, unidad, estado, precio_unitario, cantidad_pendiente) 
                 VALUES (?, 0, ?, 'Disponible', ?, 0)`;
    try {
        const result = await db.run(sql, [nombre, unidad, precio_unitario]);
        res.status(201).json({ id: result.lastID, message: 'Insumo maestro creado exitosamente.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al crear el insumo.', error: err.message });
    }
});

/**
 * @route   PUT /api/insumos/:id
 * @desc    Actualizar datos maestros de un insumo (nombre, unidad, precio)
 * @access  Private (admin, almacen)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'almacen']), validateInsumoData, async (req, res) => {
    const { nombre, unidad, precio_unitario } = req.body;
    const sql = `UPDATE insumos SET nombre = ?, unidad = ?, precio_unitario = ? WHERE id = ?`;
    try {
        const result = await db.run(sql, [nombre, unidad, precio_unitario, req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Datos maestros del insumo actualizados.' });
        } else {
            res.status(404).json({ message: 'Insumo no encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el insumo.', error: err.message });
    }
});

/**
 * @route   DELETE /api/insumos/:id
 * @desc    Eliminar un insumo
 * @access  Private (admin, almacen)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'almacen']), async (req, res) => {
    try {
        // La configuración de la DB con "ON DELETE" se encarga de las referencias.
        const result = await db.run('DELETE FROM insumos WHERE id = ?', [req.params.id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Insumo eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Insumo no encontrado.' });
        }
    } catch (err) {
        // El PRAGMA foreign_keys=ON devolverá este error si el insumo no se puede borrar
        if (err.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(409).json({ message: 'Conflicto: No se puede eliminar el insumo porque está siendo utilizado en presupuestos o compras activas.' });
        }
        res.status(500).json({ message: 'Error al eliminar el insumo.', error: err.message });
    }
});


// --- RUTA DE LÓGICA DE NEGOCIO: ADQUISICIÓN DE INSUMOS ---

/**
 * @route   POST /api/insumos/adquirir
 * @desc    Registrar una compra de insumos, afectando el stock y las cantidades pendientes.
 * @access  Private (admin, almacen, compras)
 */
router.post('/adquirir', authenticateToken, authorizeRoles(['admin', 'almacen', 'compras']), async (req, res) => {
    const { fecha_comprobante, proveedor_id, porcentaje_descuento = 0, insumos_adquiridos } = req.body;

    if (!insumos_adquiridos || !Array.isArray(insumos_adquiridos) || insumos_adquiridos.length === 0) {
        return res.status(400).json({ message: 'Debe especificar al menos un insumo en la adquisición.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        // 1. Calcular total de la compra
        let totalCompra = insumos_adquiridos.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario_compra), 0);
        if (porcentaje_descuento > 0) {
            totalCompra *= (1 - porcentaje_descuento / 100);
        }

        // 2. Insertar cabecera de la compra
        const compraResult = await db.run(
            'INSERT INTO compras_insumos (fecha_comprobante, proveedor_id, porcentaje_descuento, total_compra) VALUES (?, ?, ?, ?)',
            [fecha_comprobante, proveedor_id, porcentaje_descuento, totalCompra]
        );
        const compraId = compraResult.lastID;

        // 3. Procesar cada ítem de la compra
        for (const item of insumos_adquiridos) {
            // Insertar detalle de la compra
            await db.run(
                'INSERT INTO detalle_compras_insumos (compra_id, insumo_id, cantidad, precio_unitario_compra) VALUES (?, ?, ?, ?)',
                [compraId, item.insumo_id, item.cantidad, item.precio_unitario_compra]
            );

            // Actualizar stock y pendientes del insumo
            const oldInsumo = await db.get('SELECT stock, cantidad_pendiente, estado FROM insumos WHERE id = ?', [item.insumo_id]);
            if (!oldInsumo) throw new Error(`El insumo con ID ${item.insumo_id} no fue encontrado.`);

            const newStock = oldInsumo.stock + item.cantidad;
            const newCantidadPendiente = Math.max(0, oldInsumo.cantidad_pendiente - item.cantidad);
            let newEstado = oldInsumo.estado;
            if (newCantidadPendiente === 0 && oldInsumo.estado === 'Pendiente de Compra') {
                newEstado = 'Disponible';
            }

            await db.run(
                'UPDATE insumos SET stock = ?, cantidad_pendiente = ?, estado = ? WHERE id = ?',
                [newStock, newCantidadPendiente, newEstado, item.insumo_id]
            );
        }

        await db.run('COMMIT');
        res.status(201).json({ id: compraId, message: 'Compra de insumos registrada y stock actualizado exitosamente.' });

    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al registrar la compra de insumos.', error: err.message });
    }
});


module.exports = router;