// backend/routes/cuentas_corrientes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/cuentas-corrientes/cliente/:cliente_id
 * @desc    Obtener el historial de movimientos y saldo de un cliente.
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/cliente/:cliente_id', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
    try {
        const sql = `
            SELECT 
                cc.id, cc.fecha, cc.monto, con.tipo, cc.saldo_actual,
                con.nombre as concepto_nombre
            FROM cuentas_corrientes cc
            LEFT JOIN conceptos_cc con ON cc.concepto_id = con.id
            WHERE cc.cliente_id = ? 
            ORDER BY cc.id ASC
        `;
        const movimientosStmt = db.prepare(sql);
        const movimientos = movimientosStmt.all(req.params.cliente_id);
        
        const saldoStmt = db.prepare('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY id DESC LIMIT 1');
        const saldo = saldoStmt.get(req.params.cliente_id);
        
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
 * @desc    Registrar un nuevo movimiento (pago, ajuste, etc.) y aplicarlo si corresponde.
 * @access  Private (admin, cobranzas)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'cobranzas']), (req, res) => {
    const { cliente_id, fecha, concepto_id, monto, aplicaciones } = req.body;
    if (!cliente_id || !fecha || !concepto_id || !monto) return res.status(400).json({ message: 'Los campos cliente, fecha, concepto y monto son obligatorios.' });

    try {
        const createMovementTransaction = db.transaction((data) => {
            const conceptoStmt = db.prepare('SELECT nombre, tipo, requiere_aplicacion FROM conceptos_cc WHERE id = ?');
            const concepto = conceptoStmt.get(data.concepto_id);
            if (!concepto) throw new Error('El concepto seleccionado no es válido.');

            const ultimoMovimientoStmt = db.prepare('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY id DESC LIMIT 1');
            const ultimoMovimiento = ultimoMovimientoStmt.get(data.cliente_id);
            const saldo_anterior = ultimoMovimiento ? ultimoMovimiento.saldo_actual : 0;
            const montoAbsoluto = parseFloat(data.monto);
            const saldo_actual = concepto.tipo === 'DEBE' ? saldo_anterior + montoAbsoluto : saldo_anterior - montoAbsoluto;

            const insertMovementStmt = db.prepare(`INSERT INTO cuentas_corrientes (cliente_id, fecha, concepto_id, monto, saldo_anterior, saldo_actual) VALUES (?, ?, ?, ?, ?, ?)`);
            const result = insertMovementStmt.run(data.cliente_id, data.fecha, data.concepto_id, montoAbsoluto, saldo_anterior, saldo_actual);
            const pagoId = result.lastInsertRowid;

            if (concepto.requiere_aplicacion && data.aplicaciones && data.aplicaciones.length > 0) {
                let totalAplicado = data.aplicaciones.reduce((sum, app) => sum + parseFloat(app.monto_aplicado), 0);
                if (totalAplicado > montoAbsoluto + 0.001) { // Pequeña tolerancia para decimales
                    throw new Error('El monto total aplicado no puede ser mayor que el monto del pago.');
                }
                
                const stmtAplicacion = db.prepare('INSERT INTO aplicaciones_pago (pago_id, factura_id, monto_aplicado) VALUES (?, ?, ?)');
                const stmtFactura = db.prepare('UPDATE facturas_venta SET saldo_pendiente = saldo_pendiente - ? WHERE id = ?');
                for (const app of data.aplicaciones) {
                    stmtAplicacion.run(pagoId, app.factura_id, app.monto_aplicado);
                    stmtFactura.run(app.monto_aplicado, app.factura_id);
                }
            }
            
            // Se auto-asigna el ID del movimiento como comprobante de origen si no viene de otro lado.
            db.prepare('UPDATE cuentas_corrientes SET comprobante_origen_id = ? WHERE id = ?').run(pagoId, pagoId);
            
            return pagoId;
        });

        const newMovementId = createMovementTransaction({ cliente_id, fecha, concepto_id, monto, aplicaciones });
        res.status(201).json({ id: newMovementId, message: 'Movimiento registrado y aplicado exitosamente.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al registrar el movimiento.', error: err.message });
    }
});

module.exports = router;