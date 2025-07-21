// backend/scheduler.js
const cron = require('node-cron');
const dbPromise = require('./db');
const { sendEmail } = require('./services/emailService');
const { createBackup } = require('./services/backupService');

let db;
let backupTask = null;


/**
 * Función principal que inicializa y arranca las tareas programadas.
 */
async function iniciarScheduler() {
    db = await dbPromise;
    console.log('[SCHEDULER] Programador de tareas iniciado.');

    // Tarea de reintento de correos (sin cambios)
    cron.schedule('*/15 * * * *', () => {
        console.log('[SCHEDULER] Ejecutando tarea de reintento de correos...');
        // procesarColaDeEmails(); // Descomentar cuando la lógica de envío directo esté lista
    });

    // Tarea de backups (ahora se reprograma dinámicamente)
    await reprogramarBackupTask();
}

/**
 * Lee la configuración de la DB y (re)programa la tarea de backup.
 */
async function reprogramarBackupTask() {
    // Detiene la tarea anterior si existe, para evitar duplicados.
    if (backupTask) {
        backupTask.stop();
    }

    try {
        const configRows = await db.all("SELECT key, value FROM system_config WHERE key LIKE 'backup_%'");
        const settings = configRows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        if (settings.backup_enabled === 'true') {
            const hour = settings.backup_hour || '03';
            const cronString = settings.backup_frequency === 'semanal' 
                ? `0 ${hour} * * 0` // Domingos a la hora especificada
                : `0 ${hour} * * *`; // Todos los días a la hora especificada
            
            backupTask = cron.schedule(cronString, verificarYProcesarBackups);
            console.log(`[SCHEDULER] Tarea de backup programada con la regla: "${cronString}"`);
        } else {
            console.log('[SCHEDULER] Backups automáticos desactivados. No se programó ninguna tarea.');
        }
    } catch (error) {
        console.error('[SCHEDULER-ERROR] No se pudo leer la configuración para programar backups:', error);
    }
}

/**
 * Busca y procesa todos los correos pendientes o fallidos en la cola.
 */
async function procesarColaDeEmails() {
    try {
        const emailsAEnviar = await db.all(
            "SELECT * FROM email_queue WHERE status = 'pendiente' OR status = 'fallido' AND retry_count < 5"
        );

        if (emailsAEnviar.length === 0) {
            return; // No hay nada que hacer
        }
        
        console.log(`[SCHEDULER-EMAIL] Se encontraron ${emailsAEnviar.length} correos para procesar.`);

        for (const email of emailsAEnviar) {
            try {
                // Reconstruimos las opciones del correo desde los datos de la DB
                const mailOptions = {
                    to: email.recipient,
                    subject: email.subject,
                    html: email.body,
                    attachments: email.attachments ? JSON.parse(email.attachments) : []
                };
                
                // Usamos el servicio de email para el reintento
                await sendEmail(mailOptions);
                
                // Si el envío es exitoso (no lanza error), actualizamos el estado
                await db.run("UPDATE email_queue SET status = 'enviado' WHERE id = ?", [email.id]);
                console.log(`[SCHEDULER-EMAIL] Correo ID #${email.id} reenviado con éxito.`);

            } catch (error) {
                // Si el reintento falla, actualizamos el contador y el mensaje de error
                await db.run(
                    "UPDATE email_queue SET retry_count = retry_count + 1, last_attempt = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?",
                    [error.message, email.id]
                );
                console.error(`[SCHEDULER-EMAIL] Falló el reintento para el correo ID #${email.id}.`);
            }
        }
    } catch (error) {
        console.error('[SCHEDULER-EMAIL-ERROR] Falló la tarea de procesamiento de cola:', error);
    }
}

/**
 * Verifica la configuración y ejecuta el backup si es necesario.
 */
async function verificarYProcesarBackups() {
    try {
        const configEnabled = await db.get("SELECT value FROM system_config WHERE key = 'backup_enabled'");
        if (configEnabled?.value !== 'true') {
            console.log('[SCHEDULER-BACKUP] Los backups automáticos están desactivados (verificado antes de correr).');
            return;
        }

        console.log('[SCHEDULER-BACKUP] Iniciando proceso de backup automático...');
        const backupFileName = await createBackup();

        // Enviamos notificación por email
        const configEmail = await db.get("SELECT value FROM system_config WHERE key = 'backup_notification_email'");
        if (configEmail?.value) {
            await sendEmail({
                to: configEmail.value,
                subject: '✅ Backup de CoreGestión Realizado con Éxito',
                html: `
                    <p>Hola Administrador,</p>
                    <p>Se ha completado exitosamente el backup automático de la base de datos de CoreGestión.</p>
                    <p><strong>Nombre del archivo:</strong> ${backupFileName}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
                    <p>No es necesario realizar ninguna acción.</p>
                `
            });
        }
    } catch (error) {
        console.error('[SCHEDULER-BACKUP-ERROR] Falló la tarea de backup automático:', error);
    }
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

module.exports = { iniciarScheduler, reprogramarBackupTask };