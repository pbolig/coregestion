// backend/routes/cuentas_corrientes.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Obtenemos la instancia de la base de datos una vez que la promesa se resuelva.
let db;
dbPromise.then(database => {
    db = database;
}).catch(err => {
    console.error("Error al inicializar la base de datos para Cuentas Corrientes:", err);
});

/**
 * @route   GET /api/cuentas-corrientes/cliente/:cliente_id
 * @desc    Obtener todos los movimientos de la cuenta corriente de un cliente y su saldo final.
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/cliente/:cliente_id', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    try {
        // 1. Obtener todos los movimientos del cliente, ordenados cronológicamente.
        const movimientos = await db.all(
            'SELECT * FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY fecha, id', 
            [req.params.cliente_id]
        );

        // 2. Obtener el saldo del último movimiento registrado para ese cliente.
        const ultimoMovimiento = await db.get(
            'SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY fecha DESC, id DESC LIMIT 1', 
            [req.params.cliente_id]
        );
        
        // 3. Devolver la lista de movimientos y el saldo final. Si no hay movimientos, el saldo es 0.
        res.status(200).json({
            movimientos: movimientos,
            saldo_final: ultimoMovimiento ? ultimoMovimiento.saldo_actual : 0
        });

    } catch (err) {
        console.error('Error al obtener la cuenta corriente:', err.message);
        res.status(500).json({ message: 'Error interno del servidor al obtener la cuenta corriente.', error: err.message });
    }
});

/**
 * @route   POST /api/cuentas-corrientes
 * @desc    Añadir un nuevo movimiento a una cuenta corriente (DEBE o HABER).
 * @access  Private (admin, cobranzas)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'cobranzas']), async (req, res) => {
    const { cliente_id, fecha, concepto, monto, tipo } = req.body;

    // --- Validación de Entrada ---
    if (!cliente_id || !fecha || !concepto || !monto || !tipo) {
        return res.status(400).json({ message: 'Todos los campos (cliente_id, fecha, concepto, monto, tipo) son obligatorios.' });
    }
    if (typeof monto !== 'number' || monto <= 0) {
        return res.status(400).json({ message: 'El monto debe ser un número positivo.' });
    }
    const tipoNormalizado = tipo.toUpperCase();
    if (!['DEBE', 'HABER'].includes(tipoNormalizado)) {
        return res.status(400).json({ message: "El tipo de movimiento debe ser 'DEBE' (aumenta deuda) o 'HABER' (reduce deuda)." });
    }

    try {
        // --- Lógica Transaccional ---
        // 1. Obtener el saldo anterior del cliente.
        const ultimoMovimiento = await db.get(
            'SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY fecha DESC, id DESC LIMIT 1', 
            [cliente_id]
        );
        const saldo_anterior = ultimoMovimiento ? ultimoMovimiento.saldo_actual : 0;

        // 2. Calcular el nuevo saldo.
        const saldo_actual = (tipoNormalizado === 'DEBE')
            ? saldo_anterior + monto
            : saldo_anterior - monto;

        // 3. Insertar el nuevo movimiento con los saldos calculados.
        const sql = `
            INSERT INTO cuentas_corrientes (cliente_id, fecha, concepto, monto, tipo, saldo_anterior, saldo_actual) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await db.run(sql, [cliente_id, fecha, concepto, monto, tipoNormalizado, saldo_anterior, saldo_actual]);

        res.status(201).json({ id: result.lastID, message: 'Movimiento registrado exitosamente en la cuenta corriente.' });

    } catch (err) {
        console.error('Error al registrar el movimiento en la cuenta corriente:', err.message);
        res.status(500).json({ message: 'Error interno del servidor al registrar el movimiento.', error: err.message });
    }
});

module.exports = router;