// backend/routes/facturacion.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { crearFacturaPDF } = require('../services/pdfService');
const { sendEmail } = require('../services/emailService');

/**
 * @route   POST /api/facturacion
 * @desc    Crea una factura y, si corresponde, activa un abono recurrente.
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { presupuesto_id, gastosAdicionales = [] } = req.body;
    if (!presupuesto_id) return res.status(400).json({ message: 'Se requiere el ID del presupuesto.' });
    
    let facturaId;
    let cliente;

    try {
        const createInvoiceTransaction = db.transaction(() => {
            const presupuesto = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get(presupuesto_id);
            if (!presupuesto) throw new Error('El presupuesto no existe.');
            if (presupuesto.estado !== 'En Ejecución') throw new Error(`No se puede facturar un presupuesto en estado "${presupuesto.estado}".`);

            cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(presupuesto.cliente_id);
            if (!cliente) throw new Error('Cliente asociado al presupuesto no encontrado.');

            const puntoVentaInterno = process.env.PUNTO_DE_VENTA || 1;
            const ultimoComprobante = db.prepare('SELECT MAX(numero_comprobante) as lastNumber FROM facturas_venta WHERE punto_venta = ?').get(puntoVentaInterno);
            const nuevoNumeroInterno = (ultimoComprobante && ultimoComprobante.lastNumber) ? ultimoComprobante.lastNumber + 1 : 1;
            
            const total_insumos = presupuesto.total;
            const total_gastos = gastosAdicionales.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
            const total_factura = total_insumos + total_gastos;

            const facturaResult = db.prepare(`INSERT INTO facturas_venta (presupuesto_id, cliente_id, fecha_emision, punto_venta, numero_comprobante, total_insumos, total_gastos, total_factura, saldo_pendiente) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(presupuesto_id, presupuesto.cliente_id, new Date().toISOString(), puntoVentaInterno, nuevoNumeroInterno, total_insumos, total_gastos, total_factura, total_factura);
            facturaId = facturaResult.lastInsertRowid;
            
            if (gastosAdicionales.length > 0) {
                const stmtGastos = db.prepare('INSERT INTO factura_gastos_adicionales (factura_id, concepto, monto) VALUES (?, ?, ?)');
                gastosAdicionales.forEach(gasto => stmtGastos.run(facturaId, gasto.concepto, gasto.monto));
            }

            const conceptoFactura = db.prepare("SELECT id FROM conceptos_cc WHERE nombre = 'Factura de Venta'").get();
            if (!conceptoFactura) throw new Error("Concepto 'Factura de Venta' no encontrado en la DB.");
            
            const ultimoMovimiento = db.prepare('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY id DESC LIMIT 1').get(presupuesto.cliente_id);
            const saldo_anterior = ultimoMovimiento ? ultimoMovimiento.saldo_actual : 0;
            const saldo_actual = saldo_anterior + total_factura;
            db.prepare(`INSERT INTO cuentas_corrientes (cliente_id, fecha, concepto_id, monto, comprobante_origen_id, saldo_anterior, saldo_actual) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(presupuesto.cliente_id, new Date().toISOString(), conceptoFactura.id, total_factura, facturaId, saldo_anterior, saldo_actual);

            const insumosDelPresupuesto = db.prepare('SELECT insumo_id FROM presupuesto_insumos WHERE presupuesto_id = ?').all(presupuesto_id);
            for (const item of insumosDelPresupuesto) {
                const insumo = db.prepare('SELECT es_recurrente, precio_unitario FROM insumos WHERE id = ?').get(item.insumo_id);
                if (insumo && insumo.es_recurrente === 1) {
                    const fechaInicio = new Date();
                    const proximaFacturacion = new Date(new Date(fechaInicio).setMonth(fechaInicio.getMonth() + 1));
                    db.prepare(`INSERT INTO abonos (cliente_id, insumo_id, presupuesto_origen_id, monto_recurrente, proxima_fecha_facturacion, estado, frecuencia) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(presupuesto.cliente_id, item.insumo_id, presupuesto_id, insumo.precio_unitario, proximaFacturacion.toISOString(), 'Activo', 'mensual');
                }
            }
            db.prepare("UPDATE presupuestos SET estado = 'Facturado' WHERE id = ?").run(presupuesto_id);
        });

        createInvoiceTransaction();
        
        // El envío de email se hace fuera de la transacción.
        (async () => {
            try {
                const insumosPresupuesto = db.prepare('SELECT pi.cantidad, i.nombre, i.precio_unitario FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?').all(presupuesto_id);
                const facturaData = db.prepare('SELECT * FROM facturas_venta WHERE id = ?').get(facturaId);
                const pdfBuffer = await crearFacturaPDF({ factura: facturaData, cliente: cliente, presupuesto: { insumos: insumosPresupuesto }, gastosAdicionales: gastosAdicionales });
                await sendEmail({
                    to: cliente.email,
                    subject: `Factura N° ${facturaData.punto_venta}-${facturaData.numero_comprobante} - CoreGestión`,
                    html: `<p>Hola ${cliente.nombre},</p><p>Adjuntamos la factura/remito correspondiente a nuestros servicios.</p>`,
                    attachments: [{ filename: `Factura-${facturaId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
                });
                res.status(201).json({ id: facturaId, message: `Factura #${facturaId} creada y enviada. Abonos (si aplica) activados.` });
            } catch (emailError) {
                console.error("[EMAIL-ERROR] La factura se creó pero falló el envío:", emailError);
                res.status(201).json({ 
                    id: facturaId, 
                    message: `¡Factura #${facturaId} creada con éxito! Falló el envío por email. Puede reenviarla manualmente.` 
                });
            }
        })();

    } catch (err) {
        console.error("[FACTURACION-ERROR] Falló la transacción:", err);
        return res.status(500).json({ message: 'Error al generar la factura en la base de datos.', error: err.message });
    }
});

/**
 * @route   POST /api/facturacion/presupuesto/:presupuestoId/emitir-fiscal
 * @desc    Asigna un número fiscal a una factura.
 */
router.post('/presupuesto/:presupuestoId/emitir-fiscal', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { presupuestoId } = req.params;
    const puntoVentaFiscal = process.env.PUNTO_DE_VENTA_FISCAL;
    if (!puntoVentaFiscal) return res.status(500).json({ message: "Punto de venta fiscal no configurado." });

    let numeroFormateado;

    try {
        const emitirFiscalTransaction = db.transaction(() => {
            let factura = db.prepare('SELECT * FROM facturas_venta WHERE presupuesto_id = ?').get(presupuestoId);
            if (!factura) throw new Error('No se encontró una factura interna para este presupuesto.');
            if (factura.numero_comprobante_fiscal) throw new Error('Esta factura ya tiene un número fiscal asignado.');
            
            const presupuesto = db.prepare('SELECT estado FROM presupuestos WHERE id = ?').get(presupuestoId);
            if (!presupuesto || presupuesto.estado !== 'Facturado') throw new Error(`El presupuesto debe estar en estado 'Facturado'.`);

            const ultimoFiscal = db.prepare('SELECT MAX(numero_comprobante_fiscal) as lastNumber FROM facturas_venta WHERE punto_venta_fiscal = ?').get(puntoVentaFiscal);
            const nuevoNumeroFiscal = (ultimoFiscal && ultimoFiscal.lastNumber) ? ultimoFiscal.lastNumber + 1 : 1;

            db.prepare(`UPDATE facturas_venta SET punto_venta_fiscal = ?, numero_comprobante_fiscal = ?, fecha_emision_fiscal = ? WHERE id = ?`).run(puntoVentaFiscal, nuevoNumeroFiscal, new Date().toISOString(), factura.id);
            db.prepare("UPDATE presupuestos SET estado = 'Fac. Fiscal' WHERE id = ?").run(presupuestoId);
            
            numeroFormateado = `${String(puntoVentaFiscal).padStart(5, '0')}-${String(nuevoNumeroFiscal).padStart(8, '0')}`;
        });

        emitirFiscalTransaction();

        // El envío de email se hace fuera de la transacción.
        (async () => {
            try {
                const factura = db.prepare('SELECT * FROM facturas_venta WHERE presupuesto_id = ?').get(presupuestoId);
                const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(factura.cliente_id);
                const insumosPresupuesto = db.prepare('SELECT pi.cantidad, i.nombre, i.precio_unitario FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?').all(presupuestoId);
                const gastosAdicionales = db.prepare('SELECT * FROM factura_gastos_adicionales WHERE factura_id = ?').all(factura.id);
                
                const pdfBuffer = await crearFacturaPDF({ factura, cliente, presupuesto: { insumos: insumosPresupuesto }, gastosAdicionales });
                await sendEmail({
                    to: cliente.email,
                    subject: `Factura Fiscal N° ${numeroFormateado} - CoreGestión`,
                    html: `<p>Hola ${cliente.nombre},</p><p>Adjuntamos la factura fiscal correspondiente a nuestros servicios.</p>`,
                    attachments: [{ filename: `Factura-Fiscal-${numeroFormateado}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
                });
                res.status(200).json({ message: `Factura fiscal N° ${numeroFormateado} emitida y enviada con éxito.` });
            } catch (emailError) {
                res.status(200).json({ message: `¡Factura fiscal N° ${numeroFormateado} emitida con éxito! Falló el envío por email.` });
            }
        })();

    } catch (err) {
        res.status(500).json({ message: 'Error al emitir la factura fiscal.', error: err.message });
    }
});

/**
 * @route   POST /api/facturacion/:id/reenviar
 * @desc    Reenvía una factura existente por email.
 */
router.post('/:id/reenviar', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    const { id } = req.params;
    try {
        const factura = db.prepare('SELECT * FROM facturas_venta WHERE id = ?').get(id);
        if (!factura) return res.status(404).json({ message: 'Factura no encontrada.' });

        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(factura.cliente_id);
        const insumosPresupuesto = factura.presupuesto_id ? db.prepare('SELECT pi.cantidad, i.nombre, i.precio_unitario FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?').all(factura.presupuesto_id) : [];
        const gastosAdicionales = db.prepare('SELECT * FROM factura_gastos_adicionales WHERE factura_id = ?').all(id);

        const pdfBuffer = await crearFacturaPDF({ factura, cliente, presupuesto: { insumos: insumosPresupuesto }, gastosAdicionales });
        await sendEmail({
            to: cliente.email,
            subject: `Copia de Factura - CoreGestión`,
            html: `<p>Hola ${cliente.nombre},</p><p>Te reenviamos una copia de la factura #${factura.id}.</p>`,
            attachments: [{ filename: `Factura-${factura.id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        });
        res.status(200).json({ message: `Factura #${id} reenviada exitosamente a ${cliente.email}.` });
    } catch (err) {
        res.status(500).json({ message: 'Error al reenviar la factura.', error: err.message });
    }
});

/**
 * @route   GET /api/facturacion/cliente/:clienteId/pendientes
 * @desc    Obtiene todas las facturas de un cliente con saldo pendiente.
 */
router.get('/cliente/:clienteId/pendientes', authenticateToken, authorizeRoles(['admin', 'cobranzas', 'ventas']), (req, res) => {
    const { clienteId } = req.params;
    try {
        const stmt = db.prepare(`SELECT id, fecha_emision, total_factura, saldo_pendiente FROM facturas_venta WHERE cliente_id = ? AND saldo_pendiente > 0.01 ORDER BY fecha_emision ASC`);
        const facturas = stmt.all(clienteId);
        res.status(200).json(facturas);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener las facturas pendientes.', error: err.message });
    }
});

/**
 * @route   GET /api/facturacion/presupuesto/:presupuestoId/pdf
 * @desc    Genera y devuelve el PDF de la factura asociada a un presupuesto.
 */
router.get('/presupuesto/:presupuestoId/pdf', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    const { presupuestoId } = req.params;
    try {
        const factura = db.prepare('SELECT * FROM facturas_venta WHERE presupuesto_id = ?').get(presupuestoId);
        if (!factura) return res.status(404).json({ message: 'No se encontró una factura para este presupuesto.' });
        
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(factura.cliente_id);
        const insumosPresupuesto = factura.presupuesto_id ? db.prepare('SELECT pi.cantidad, i.nombre, i.precio_unitario FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?').all(factura.presupuesto_id) : [];
        const gastosAdicionales = db.prepare('SELECT * FROM factura_gastos_adicionales WHERE factura_id = ?').all(factura.id);

        const pdfBuffer = await crearFacturaPDF({ factura, cliente, presupuesto: { insumos: insumosPresupuesto }, gastosAdicionales });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Factura-${factura.id}.pdf`);
        res.send(pdfBuffer);
    } catch (err) {
        res.status(500).json({ message: 'Error al generar el PDF de la factura.', error: err.message });
    }
});

module.exports = router;