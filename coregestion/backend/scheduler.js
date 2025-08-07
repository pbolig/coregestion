// backend/scheduler.js
const cron = require('node-cron');
const db = require('./db'); // Importa la conexión directa a better-sqlite3
const { sendEmail } = require('./services/emailService');
const { createBackup } = require('./services/backupService');

let backupTask = null;

/**
 * Función principal que inicializa y arranca las tareas programadas.
 */
function iniciarScheduler() {
    console.log('[SCHEDULER] Programador de tareas iniciado.');

    // Tarea 1: Procesar la cola de correos cada 15 minutos.
    cron.schedule('*/15 * * * *', () => {
        console.log('[SCHEDULER] Ejecutando tarea de reintento de correos...');
        procesarColaDeEmails();
    });

    // Tarea 2: Realizar backups según la configuración.
    reprogramarBackupTask();
}

/**
 * Lee la configuración de la DB y (re)programa la tarea de backup.
 */
function reprogramarBackupTask() {
    if (backupTask) {
        backupTask.stop();
    }

    try {
        const stmt = db.prepare("SELECT key, value FROM system_config WHERE key LIKE 'backup_%'");
        const configRows = stmt.all();
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
            console.log('[SCHEDULER] Backups automáticos desactivados.');
        }
    } catch (error) {
        console.error('[SCHEDULER-ERROR] No se pudo leer la configuración para programar backups:', error);
    }
}

/**
 * Busca y procesa todos los correos pendientes o fallidos en la cola.
 */
function procesarColaDeEmails() {
    try {
        const stmt = db.prepare("SELECT * FROM email_queue WHERE (status = 'pendiente' OR status = 'fallido') AND retry_count < 5");
        const emailsAEnviar = stmt.all();

        if (emailsAEnviar.length === 0) return;
        
        console.log(`[SCHEDULER-EMAIL] Se encontraron ${emailsAEnviar.length} correos para procesar.`);

        for (const email of emailsAEnviar) {
            // Lógica de reintento (simplificada por ahora)
            // En un futuro, podríamos llamar a una función de envío directo aquí.
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
        const stmtEnabled = db.prepare("SELECT value FROM system_config WHERE key = 'backup_enabled'");
        const configEnabled = stmtEnabled.get();
        if (configEnabled?.value !== 'true') {
            return;
        }

        console.log('[SCHEDULER-BACKUP] Iniciando proceso de backup automático...');
        const backupFileName = await createBackup();

        const stmtEmail = db.prepare("SELECT value FROM system_config WHERE key = 'backup_notification_email'");
        const configEmail = stmtEmail.get();
        if (configEmail?.value) {
            await sendEmail({
                to: configEmail.value,
                subject: '✅ Backup de CoreGestión Realizado con Éxito',
                html: `<p>Se ha completado exitosamente el backup automático de la base de datos.</p><p><strong>Archivo:</strong> ${backupFileName}</p>`
            });
        }
    } catch (error) {
        console.error('[SCHEDULER-BACKUP-ERROR] Falló la tarea de backup automático:', error);
    }
}

module.exports = { iniciarScheduler, reprogramarBackupTask };