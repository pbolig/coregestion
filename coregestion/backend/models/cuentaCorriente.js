// backend/routes/cuentas_corrientes.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   GET /api/cuentas-corrientes/cliente/:cliente_id
 * @desc    Obtener todos los movimientos de la cuenta corriente de un cliente
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/cliente/:cliente_id', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    try {
        const movimientos = await db.all('SELECT * FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY fecha, id', [req.params.cliente_id]);
        const saldo = await db.get('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY fecha DESC, id DESC LIMIT 1', [req.params.cliente_id]);
        
        res.status(200).json({
            movimientos,
            saldo_final: saldo ? saldo.saldo_actual : 0
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener la cuenta corriente.', error: err.message });
    }
});

/**
 * @route   POST /api/cuentas-corrientes
 * @desc    Añadir un nuevo movimiento a una cuenta corriente (DEBE o HABER)
 * @access  Private (admin, cobranzas)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'cobranzas']), async (req, res) => {
    const { cliente_id, fecha, concepto, monto, tipo } = req.body;

    if (!cliente_id || !fecha || !concepto || !monto || !tipo) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    if (monto <= 0) {
        return res.status(400).json({ message: 'El monto debe ser un valor positivo.' });
    }
    if (!['DEBE', 'HABER'].includes(tipo.toUpperCase())) {
        return res.status(400).json({ message: "El tipo de movimiento debe ser 'DEBE' o 'HABER'." });
    }

    try {
        // 1. Obtener el último saldo del cliente
        const ultimoMovimiento = await db.get('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY fecha DESC, id DESC LIMIT 1', [cliente_id]);
        const saldo_anterior = ultimoMovimiento ? ultimoMovimiento.saldo_actual : 0;

        // 2. Calcular el nuevo saldo
        const montoAbsoluto = parseFloat(monto);
        const saldo_actual = tipo.toUpperCase() === 'DEBE' 
            ? saldo_anterior + montoAbsoluto
            : saldo_anterior - montoAbsoluto;

        // 3. Insertar el nuevo movimiento
        const sql = `INSERT INTO cuentas_corrientes (cliente_id, fecha, concepto, monto, tipo, saldo_anterior, saldo_actual) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const result = await db.run(sql, [cliente_id, fecha, concepto, montoAbsoluto, tipo.toUpperCase(), saldo_anterior, saldo_actual]);

        res.status(201).json({ id: result.lastID, message: 'Movimiento registrado exitosamente.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al registrar el movimiento.', error: err.message });
    }
});

module.exports = router;