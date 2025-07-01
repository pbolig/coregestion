// backend/scheduler.js
const cron = require('node-cron');
const dbPromise = require('./db');
const { crearFacturaPDF } = require('./services/pdfService');
const { sendEmail } = require('./services/emailService');

let db;

/**
 * Función principal que inicializa y arranca el programador de tareas.
 */
async function iniciarScheduler() {
    db = await dbPromise;
    console.log('[SCHEDULER] Programador de tareas de facturación iniciado.');

    // Se ejecuta todos los días a las 5:00 AM.
    cron.schedule('0 5 * * *', () => {
        console.log('[SCHEDULER] Ejecutando tarea diaria de verificación de abonos...');
        verificarYProcesarAbonos();
    });
}

/**
 * Busca y procesa todos los abonos cuya fecha de facturación ha llegado.
 */
async function verificarYProcesarAbonos() {
    const hoy = new Date().toISOString().split('T')[0];
    try {
        const abonosAFacturar = await db.all(
            "SELECT * FROM abonos WHERE proxima_fecha_facturacion <= ? AND estado = 'Activo'",
            [hoy]
        );

        if (abonosAFacturar.length === 0) {
            console.log('[SCHEDULER] No hay abonos para facturar hoy.');
            return;
        }

        console.log(`[SCHEDULER] Se encontraron ${abonosAFacturar.length} abonos para procesar.`);
        for (const abono of abonosAFacturar) {
            await procesarFacturaDeAbono(abono);
        }
    } catch (error) {
        console.error('[SCHEDULER-ERROR] Falló la tarea de verificación de abonos:', error);
    }
}

/**
 * Genera una factura para un abono específico, aplicando la lógica de facturación acumulativa.
 * @param {object} abono - El registro del abono a procesar.
 */
async function procesarFacturaDeAbono(abono) {
    console.log(`[SCHEDULER] Procesando abono ID: ${abono.id} para cliente ID: ${abono.cliente_id}`);
    try {
        await db.run('BEGIN TRANSACTION');

        const multiplicadorPorFrecuencia = { 'mensual': 1, 'trimestral': 3, 'semestral': 6, 'anual': 12 };
        const multiplicador = multiplicadorPorFrecuencia[abono.frecuencia] || 1;
        const totalFacturaAbono = abono.monto_recurrente * multiplicador;
        const conceptoFacturaTexto = `Factura por Abono (${abono.frecuencia})`;

        const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [abono.cliente_id]);
        if (!cliente) throw new Error(`Cliente con ID ${abono.cliente_id} no encontrado.`);

        const puntoVenta = process.env.PUNTO_DE_VENTA || 1;
        const ultimoComp = await db.get('SELECT MAX(numero_comprobante) as lastNumber FROM facturas_venta WHERE punto_venta = ?', [puntoVenta]);
        const nuevoNumero = (ultimoComp && ultimoComp.lastNumber) ? ultimoComp.lastNumber + 1 : 1;

        const facturaResult = await db.run(
            `INSERT INTO facturas_venta (cliente_id, fecha_emision, punto_venta, numero_comprobante, total_factura, saldo_pendiente) VALUES (?, ?, ?, ?, ?, ?)`,
            [abono.cliente_id, new Date().toISOString(), puntoVenta, nuevoNumero, totalFacturaAbono, totalFacturaAbono]
        );
        const facturaId = facturaResult.lastID;

        const concepto = await db.get("SELECT id FROM conceptos_cc WHERE nombre = 'Factura de Venta'");
        const ultimoMov = await db.get('SELECT saldo_actual FROM cuentas_corrientes WHERE cliente_id = ? ORDER BY id DESC LIMIT 1', [abono.cliente_id]);
        const saldo_anterior = ultimoMov ? ultimoMov.saldo_actual : 0;
        const saldo_actual = saldo_anterior + totalFacturaAbono;
        await db.run(
            `INSERT INTO cuentas_corrientes (cliente_id, fecha, concepto_id, monto, comprobante_origen_id, saldo_anterior, saldo_actual) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [abono.cliente_id, new Date().toISOString(), concepto.id, totalFacturaAbono, facturaId, saldo_anterior, saldo_actual]
        );

        const proximaFecha = new Date(abono.proxima_fecha_facturacion);
        proximaFecha.setMonth(proximaFecha.getMonth() + multiplicador);
        await db.run("UPDATE abonos SET proxima_fecha_facturacion = ? WHERE id = ?", [proximaFecha.toISOString(), abono.id]);

        await db.run('COMMIT');
        console.log(`[SCHEDULER] Factura #${facturaId} por $${totalFacturaAbono} creada para el abono #${abono.id}.`);

        try {
            const facturaCompleta = await db.get('SELECT * FROM facturas_venta WHERE id = ?', [facturaId]);
            const pdfBuffer = await crearFacturaPDF({ 
                factura: facturaCompleta, 
                cliente: cliente, 
                presupuesto: {insumos: []}, 
                gastosAdicionales: [{concepto: conceptoFacturaTexto, monto: totalFacturaAbono}] 
            });
            await sendEmail({
                to: cliente.email,
                subject: `Factura de Abono Mensual - CoreGestión`,
                html: `<p>Hola ${cliente.nombre},</p><p>Adjuntamos la factura correspondiente a tu abono ${abono.frecuencia}.</p>`,
                attachments: [{ filename: `Factura-Abono-${facturaId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
            });
        } catch (emailError) {
            console.error(`[SCHEDULER-EMAIL-ERROR] La factura #${facturaId} se creó, pero falló el envío por email.`, emailError);
            await db.run("INSERT INTO notificaciones_sistema (mensaje, tipo) VALUES (?, ?)", [`Fallo en envío de factura de abono #${facturaId} para cliente ${cliente.nombre}`, 'error']);
        }

    } catch (error) {
        await db.run('ROLLBACK');
        console.error(`[SCHEDULER-DB-ERROR] Falló la creación de la factura para el abono #${abono.id}:`, error);
        await db.run("INSERT INTO notificaciones_sistema (mensaje, tipo) VALUES (?, ?)", [`Error crítico al facturar abono #${abono.id}. Revisión manual requerida.`, 'critico']);
    }
}

module.exports = { iniciarScheduler };