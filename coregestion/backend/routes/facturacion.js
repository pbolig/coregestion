// backend/routes/facturacion.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { crearFacturaPDF } = require('../services/pdfService');
const { sendEmail } = require('../services/emailService');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   POST /api/facturacion
 * @desc    Crea una factura y maneja de forma robusta el posible fallo del envío de email.
 * @access  Private (admin, ventas)
 */
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { presupuesto_id, gastosAdicionales = [] } = req.body;
    if (!presupuesto_id) return res.status(400).json({ message: 'Se requiere el ID del presupuesto.' });
    
    let facturaId; // La declaramos aquí para que sea accesible fuera del try/catch de la DB
    let cliente;
    let facturaData;
    let pdfBuffer;

    try {
        // --- ETAPA 1: TRANSACCIÓN DE BASE DE DATOS ---
        // Nos aseguramos de que todos los registros contables sean exitosos.
        await db.run('BEGIN TRANSACTION');

        const presupuesto = await db.get('SELECT * FROM presupuestos WHERE id = ?', [presupuesto_id]);
        if (!presupuesto) throw new Error('El presupuesto no existe.');
        if (presupuesto.estado !== 'En Ejecución') throw new Error(`No se puede facturar un presupuesto en estado "${presupuesto.estado}".`);

        cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [presupuesto.cliente_id]);
        if (!cliente) throw new Error('Cliente asociado al presupuesto no encontrado.');

        const puntoVentaInterno = process.env.PUNTO_DE_VENTA || 1;
        const ultimoComprobanteInterno = await db.get('SELECT MAX(numero_comprobante) as lastNumber FROM facturas_venta WHERE punto_venta = ?', [puntoVentaInterno]);
        const nuevoNumeroInterno = (ultimoComprobanteInterno && ultimoComprobanteInterno.lastNumber) ? ultimoComprobanteInterno.lastNumber + 1 : 1;
        
        const total_insumos = presupuesto.total;
        const total_gastos = gastosAdicionales.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
        const total_factura = total_insumos + total_gastos;

        const facturaResult = await db.run(
            `INSERT INTO facturas_venta (presupuesto_id, cliente_id, fecha_emision, punto_venta, numero_comprobante, total_insumos, total_gastos, total_factura, saldo_pendiente) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [presupuesto_id, presupuesto.cliente_id, new Date().toISOString(), puntoVentaInterno, nuevoNumeroInterno, total_insumos, total_gastos, total_factura, total_factura]
        );
        facturaId = facturaResult.lastID;
        
        if (gastosAdicionales.length > 0) {
            const stmtGastos = await db.prepare('INSERT INTO factura_gastos_adicionales (factura_id, concepto, monto) VALUES (?, ?, ?)');
            for (const gasto of gastosAdicionales) await stmtGastos.run(facturaId, gasto.concepto, gasto.monto);
            await stmtGastos.finalize();
        }

        const conceptoFactura = await db.get("SELECT id FROM conceptos_cc WHERE nombre = 'Factura de Venta'");
        if (!conceptoFactura) throw new Error("Concepto 'Factura de Venta' no encontrado en la DB.");
        
        const ultimoMovimiento = await db.get('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY id DESC LIMIT 1', [presupuesto.cliente_id]);
        const saldo_anterior = ultimoMovimiento ? ultimoMovimiento.saldo_actual : 0;
        const saldo_actual = saldo_anterior + total_factura;
        
        await db.run(`INSERT INTO cuentas_corrientes (cliente_id, fecha, concepto_id, monto, comprobante_origen_id, saldo_anterior, saldo_actual) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [presupuesto.cliente_id, new Date().toISOString(), conceptoFactura.id, total_factura, facturaId, saldo_anterior, saldo_actual]
        );

        await db.run("UPDATE presupuestos SET estado = 'Facturado' WHERE id = ?", [presupuesto_id]);
        
        // Preparamos los datos para el PDF antes de confirmar
        const insumosPresupuesto = await db.all('SELECT pi.cantidad, i.nombre, i.precio_unitario FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?', [presupuesto_id]);
        facturaData = { id: facturaId, ...req.body, fecha_emision: new Date(), saldo_pendiente: total_factura, punto_venta: puntoVentaInterno, numero_comprobante: nuevoNumeroInterno };
        pdfBuffer = await crearFacturaPDF({ factura: facturaData, cliente: cliente, presupuesto: { ...presupuesto, insumos: insumosPresupuesto }, gastosAdicionales: gastosAdicionales });
        
        await db.run('COMMIT');

    } catch (err) {
        await db.run('ROLLBACK');
        console.error("[FACTURACION-ERROR] Falló la transacción de la base de datos:", err);
        return res.status(500).json({ message: 'Error al generar la factura en la base de datos.', error: err.message });
    }

    // --- ETAPA 2: ENVÍO DE NOTIFICACIÓN (fuera de la transacción) ---
    try {
        await sendEmail({
            to: cliente.email,
            subject: `Factura N° ${facturaData.punto_venta}-${facturaData.numero_comprobante} - CoreGestión`,
            html: `<p>Hola ${cliente.nombre},</p><p>Adjuntamos la factura/remito correspondiente a nuestros servicios.</p>`,
            attachments: [{ filename: `Factura-${facturaId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        });
        
        // Si todo sale bien, enviamos el mensaje de éxito completo.
        res.status(201).json({ id: facturaId, message: `Factura #${facturaId} creada y enviada al cliente exitosamente.` });

    } catch (emailError) {
        console.error("[EMAIL-ERROR] La factura se creó pero falló el envío por email:", emailError);
        // Si solo falla el email, enviamos un mensaje de éxito parcial.
        res.status(201).json({ 
            id: facturaId, 
            message: `¡Factura #${facturaId} creada con éxito! Falló el envío por email. Puede reenviarla manualmente desde Cuentas Corrientes.` 
        });
    }
});


/**
 * @route   POST /api/facturacion/presupuesto/:presupuestoId/emitir-fiscal
 * @desc    Asigna un número fiscal, actualiza el estado y ENVÍA la factura fiscal por email.
 * @access  Private (admin, ventas)
 */
router.post('/presupuesto/:presupuestoId/emitir-fiscal', authenticateToken, authorizeRoles(['admin', 'ventas']), async (req, res) => {
    const { presupuestoId } = req.params;
    const puntoVentaFiscal = process.env.PUNTO_DE_VENTA_FISCAL;

    if (!puntoVentaFiscal) {
        return res.status(500).json({ message: "El punto de venta fiscal no está configurado en el servidor." });
    }

    let factura;
    let cliente;
    let presupuesto;
    let insumosPresupuesto;
    let gastosAdicionales;
    let numeroFormateado;

    try {
        // --- ETAPA 1: TRANSACCIÓN DE BASE DE DATOS ---
        await db.run('BEGIN TRANSACTION');

        factura = await db.get('SELECT * FROM facturas_venta WHERE presupuesto_id = ?', [presupuestoId]);
        if (!factura) throw new Error('No se encontró una factura interna para este presupuesto.');
        if (factura.numero_comprobante_fiscal) throw new Error('Esta factura ya tiene un número fiscal asignado.');
        
        presupuesto = await db.get('SELECT estado FROM presupuestos WHERE id = ?', [presupuestoId]);
        if (!presupuesto || presupuesto.estado !== 'Facturado') {
            throw new Error(`El presupuesto debe estar en estado 'Facturado'. Estado actual: ${presupuesto ? presupuesto.estado : 'N/A'}.`);
        }

        const ultimoComprobanteFiscal = await db.get('SELECT MAX(numero_comprobante_fiscal) as lastNumber FROM facturas_venta WHERE punto_venta_fiscal = ?', [puntoVentaFiscal]);
        const nuevoNumeroFiscal = (ultimoComprobanteFiscal && ultimoComprobanteFiscal.lastNumber) ? ultimoComprobanteFiscal.lastNumber + 1 : 1;

        await db.run(
            `UPDATE facturas_venta SET punto_venta_fiscal = ?, numero_comprobante_fiscal = ?, fecha_emision_fiscal = ? WHERE id = ?`,
            [puntoVentaFiscal, nuevoNumeroFiscal, new Date().toISOString(), factura.id]
        );

        await db.run("UPDATE presupuestos SET estado = 'Fac. Fiscal' WHERE id = ?", [presupuestoId]);
        
        // Preparamos los datos para el PDF y el email
        factura.punto_venta_fiscal = puntoVentaFiscal;
        factura.numero_comprobante_fiscal = nuevoNumeroFiscal;
        factura.fecha_emision_fiscal = new Date().toISOString();
        numeroFormateado = `${String(puntoVentaFiscal).padStart(5, '0')}-${String(nuevoNumeroFiscal).padStart(8, '0')}`;

        cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [factura.cliente_id]);
        insumosPresupuesto = await db.all('SELECT pi.cantidad, i.nombre, i.precio_unitario FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?', [presupuestoId]);
        gastosAdicionales = await db.all('SELECT * FROM factura_gastos_adicionales WHERE factura_id = ?', [factura.id]);

        await db.run('COMMIT');

    } catch (err) {
        await db.run('ROLLBACK');
        console.error("Error al emitir factura fiscal (DB):", err);
        return res.status(500).json({ message: 'Error al emitir la factura fiscal en la base de datos.', error: err.message });
    }

    // --- ETAPA 2: ENVÍO DE EMAIL (fuera de la transacción) ---
    try {
        const pdfBuffer = await crearFacturaPDF({
            factura: factura,
            cliente: cliente,
            presupuesto: { ...presupuesto, insumos: insumosPresupuesto },
            gastosAdicionales: gastosAdicionales
        });

        await sendEmail({
            to: cliente.email,
            subject: `Factura Fiscal N° ${numeroFormateado} - CoreGestión`,
            html: `<p>Hola ${cliente.nombre},</p><p>Adjuntamos la factura fiscal correspondiente a nuestros servicios.</p><p>Gracias.</p>`,
            attachments: [{
                filename: `Factura-Fiscal-${numeroFormateado}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });
        
        res.status(200).json({ message: `Factura fiscal N° ${numeroFormateado} emitida y enviada con éxito.` });
    
    } catch (emailError) {
        console.error("[EMAIL-ERROR] La factura fiscal se creó pero falló el envío por email:", emailError);
        res.status(200).json({ 
            message: `¡Factura fiscal N° ${numeroFormateado} emitida con éxito! Falló el envío por email. Puede reenviarla manualmente.` 
        });
    }
});


/**
 * @route   POST /api/facturacion/:id/reenviar
 * @desc    Reenvía una factura existente por email.
 * @access  Private (admin, ventas, cobranzas)
 */
router.post('/:id/reenviar', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    const { id } = req.params;
    try {
        const factura = await db.get('SELECT * FROM facturas_venta WHERE id = ?', [id]);
        if (!factura) return res.status(404).json({ message: 'Factura no encontrada.' });

        const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [factura.cliente_id]);
        const presupuesto = factura.presupuesto_id ? await db.get('SELECT * FROM presupuestos WHERE id = ?', [factura.presupuesto_id]) : {};
        const insumosPresupuesto = factura.presupuesto_id ? await db.all('SELECT pi.cantidad, i.nombre, i.precio_unitario FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?', [factura.presupuesto_id]) : [];
        const gastosAdicionales = await db.all('SELECT * FROM factura_gastos_adicionales WHERE factura_id = ?', [id]);

        const pdfBuffer = await crearFacturaPDF({ factura: factura, cliente: cliente, presupuesto: { ...presupuesto, insumos: insumosPresupuesto }, gastosAdicionales: gastosAdicionales });

        await sendEmail({
            to: cliente.email,
            subject: `Copia de Factura - CoreGestión`,
            html: `<p>Hola ${cliente.nombre},</p><p>Te reenviamos una copia de la factura #${factura.id}.</p><p>Gracias.</p>`,
            attachments: [{ filename: `Factura-${factura.id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        });

        res.status(200).json({ message: `Factura #${id} reenviada exitosamente a ${cliente.email}.` });
    } catch (err) {
        console.error("Error al reenviar factura:", err);
        res.status(500).json({ message: 'Error al reenviar la factura.', error: err.message });
    }
});


/**
 * @route   GET /api/facturacion/cliente/:clienteId/pendientes
 * @desc    Obtiene todas las facturas de un cliente con saldo pendiente.
 * @access  Private (admin, cobranzas, ventas)
 */
router.get('/cliente/:clienteId/pendientes', authenticateToken, authorizeRoles(['admin', 'cobranzas', 'ventas']), async (req, res) => {
    const { clienteId } = req.params;
    try {
        const facturas = await db.all(
            `SELECT id, fecha_emision, total_factura, saldo_pendiente FROM facturas_venta WHERE cliente_id = ? AND saldo_pendiente > 0.01 ORDER BY fecha_emision ASC`,
            [clienteId]
        );
        res.status(200).json(facturas);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener las facturas pendientes.', error: err.message });
    }
});


/**
 * @route   GET /api/facturacion/presupuesto/:presupuestoId/pdf
 * @desc    Genera y devuelve el PDF de la factura asociada a un presupuesto.
 * @access  Private (admin, ventas, cobranzas)
 */
router.get('/presupuesto/:presupuestoId/pdf', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), async (req, res) => {
    const { presupuestoId } = req.params;
    try {
        const factura = await db.get('SELECT * FROM facturas_venta WHERE presupuesto_id = ?', [presupuestoId]);
        if (!factura) return res.status(404).json({ message: 'No se encontró una factura para este presupuesto.' });

        const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [factura.cliente_id]);
        const presupuesto = await db.get('SELECT * FROM presupuestos WHERE id = ?', [factura.presupuesto_id]);
        const insumosPresupuesto = presupuesto ? await db.all('SELECT pi.cantidad, i.nombre, i.precio_unitario FROM presupuesto_insumos pi JOIN insumos i ON pi.insumo_id = i.id WHERE pi.presupuesto_id = ?', [factura.presupuesto_id]) : [];
        const gastosAdicionales = await db.all('SELECT * FROM factura_gastos_adicionales WHERE factura_id = ?', [factura.id]);

        const pdfBuffer = await crearFacturaPDF({ factura: factura, cliente: cliente, presupuesto: { ...presupuesto, insumos: insumosPresupuesto }, gastosAdicionales: gastosAdicionales });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Factura-${factura.id}.pdf`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("Error al generar PDF de factura:", err);
        res.status(500).json({ message: 'Error al generar el PDF de la factura.', error: err.message });
    }
});

module.exports = router;