// backend/routes/cuentas_corrientes.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

router.get('/cliente/:cliente_id', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    try {
        // CORRECCIÓN: Usamos LEFT JOIN para que no falle si un concepto es nulo.
        const sql = `
            SELECT 
                cc.id, cc.fecha, cc.monto, con.tipo, cc.saldo_actual,
                con.nombre as concepto_nombre
            FROM cuentas_corrientes cc
            LEFT JOIN conceptos_cc con ON cc.concepto_id = con.id
            WHERE cc.cliente_id = ? 
            ORDER BY cc.id ASC
        `;
        const movimientos = await db.all(sql, [req.params.cliente_id]);
        
        const saldo = await db.get('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY id DESC LIMIT 1', [req.params.cliente_id]);
        
        res.status(200).json({
            movimientos,
            saldo_final: saldo ? saldo.saldo_actual : 0
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener la cuenta corriente.', error: err.message });
    }
});

router.post('/', authenticateToken, authorizeRoles(['admin', 'cobranzas']), async (req, res) => {
    const { cliente_id, fecha, concepto_id, monto, aplicaciones } = req.body;
    if (!cliente_id || !fecha || !concepto_id || !monto) return res.status(400).json({ message: 'Los campos cliente, fecha, concepto y monto son obligatorios.' });

    try {
        await db.run('BEGIN TRANSACTION');
        const concepto = await db.get('SELECT nombre, tipo, requiere_aplicacion FROM conceptos_cc WHERE id = ?', [concepto_id]);
        if (!concepto) throw new Error('El concepto seleccionado no es válido.');

        const ultimoMovimiento = await db.get('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY id DESC LIMIT 1', [cliente_id]);
        const saldo_anterior = ultimoMovimiento ? ultimoMovimiento.saldo_actual : 0;
        const montoAbsoluto = parseFloat(monto);
        const saldo_actual = concepto.tipo === 'DEBE' ? saldo_anterior + montoAbsoluto : saldo_anterior - montoAbsoluto;

        const result = await db.run(
            `INSERT INTO cuentas_corrientes (cliente_id, fecha, concepto_id, monto, saldo_anterior, saldo_actual) VALUES (?, ?, ?, ?, ?, ?)`,
            [cliente_id, fecha, concepto_id, montoAbsoluto, saldo_anterior, saldo_actual]
        );
        const pagoId = result.lastID;

        if (concepto.requiere_aplicacion && aplicaciones && aplicaciones.length > 0) {
            let totalAplicado = aplicaciones.reduce((sum, app) => sum + parseFloat(app.monto_aplicado), 0);
            if (totalAplicado > montoAbsoluto + 0.001) throw new Error('El monto total aplicado no puede ser mayor que el monto del pago.');
            
            const stmtAplicacion = await db.prepare('INSERT INTO aplicaciones_pago (pago_id, factura_id, monto_aplicado) VALUES (?, ?, ?)');
            const stmtFactura = await db.prepare('UPDATE facturas_venta SET saldo_pendiente = saldo_pendiente - ? WHERE id = ?');
            for (const app of aplicaciones) {
                await stmtAplicacion.run(pagoId, app.factura_id, app.monto_aplicado);
                await stmtFactura.run(app.monto_aplicado, app.factura_id);
            }
            await stmtAplicacion.finalize();
            await stmtFactura.finalize();
        }
        await db.run('UPDATE cuentas_corrientes SET comprobante_origen_id = ? WHERE id = ?', [pagoId, pagoId]);
        
        await db.run('COMMIT');
        res.status(201).json({ message: 'Movimiento registrado y aplicado exitosamente.' });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al registrar el movimiento.', error: err.message });
    }
});

module.exports = router;