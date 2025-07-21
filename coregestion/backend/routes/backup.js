// backend/routes/backup.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createBackup } = require('../services/backupService');
const { reprogramarBackupTask } = require('../scheduler');
const fs = require('fs-extra');
const path = require('path');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

const BACKUPS_DIR = path.join(__dirname, '../backups');

// Middleware para asegurar que solo los admins accedan a este módulo
router.use(authenticateToken, authorizeRoles(['admin']));

/**
 * @route   GET /api/backup/config
 * @desc    Obtiene la configuración actual del sistema de backups.
 */
router.get('/config', async (req, res) => {
    try {
        const rows = await db.all("SELECT key, value FROM system_config WHERE key LIKE 'backup_%'");
        const config = rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});
        res.status(200).json(config);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener la configuración.', error: err.message });
    }
});

/**
 * @route   POST /api/backup/config
 * @desc    Actualiza la configuración del sistema de backups.
 */
router.post('/config', async (req, res) => {
    // --- CONSOLE LOGS PARA DEPURACIÓN ---
    console.log('[BACKUP-CONFIG-DEBUG] Petición POST recibida en /api/backup/config');
    console.log('[BACKUP-CONFIG-DEBUG] Datos recibidos en el body:', JSON.stringify(req.body, null, 2));

    const { backup_enabled, backup_frequency, backup_notification_email, backup_retention_count, backup_hour } = req.body;
    
    try {
        await db.run('BEGIN TRANSACTION');
        console.log('[BACKUP-CONFIG-DEBUG] Transacción iniciada.');

        const stmt = await db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)");
        
        const updates = [
            { key: 'backup_enabled', value: String(backup_enabled) },
            { key: 'backup_frequency', value: backup_frequency },
            { key: 'backup_notification_email', value: backup_notification_email },
            { key: 'backup_retention_count', value: String(backup_retention_count) },
            { key: 'backup_hour', value: String(backup_hour).padStart(2, '0') }
        ];

        for (const update of updates) {
            console.log(`[BACKUP-CONFIG-DEBUG] Guardando: key='${update.key}', value='${update.value}'`);
            await stmt.run(update.key, update.value);
        }
        
        await stmt.finalize();
        await db.run('COMMIT');
        console.log('[BACKUP-CONFIG-DEBUG] Transacción confirmada (COMMIT).');

        // Después de guardar, le decimos al scheduler que se reprograme
        await reprogramarBackupTask();
        console.log('[BACKUP-CONFIG-DEBUG] Tarea de backup reprogramada.');

        res.status(200).json({ message: 'Configuración de backup actualizada exitosamente.' });
    } catch (err) {
        await db.run('ROLLBACK');
        console.error('[BACKUP-CONFIG-ERROR] Falló la transacción al guardar la configuración:', err);
        res.status(500).json({ message: 'Error al guardar la configuración.', error: err.message });
    }
});

/**
 * @route   POST /api/backup/config
 * @desc    Actualiza la configuración del sistema de backups.
 */
router.post('/config', async (req, res) => {
    const { backup_enabled, backup_frequency, backup_notification_email, backup_retention_count } = req.body;
    try {
        await db.run('BEGIN TRANSACTION');
        const stmt = await db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)");
        await stmt.run('backup_enabled', String(backup_enabled));
        await stmt.run('backup_frequency', backup_frequency);
        await stmt.run('backup_notification_email', backup_notification_email);
        await stmt.run('backup_retention_count', String(backup_retention_count));
        await stmt.finalize();
        await db.run('COMMIT');
        res.status(200).json({ message: 'Configuración de backup actualizada exitosamente.' });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error al guardar la configuración.', error: err.message });
    }
});

/**
 * @route   POST /api/backup/run-now
 * @desc    Dispara la creación de un backup manualmente.
 */
router.post('/run-now', async (req, res) => {
    try {
        const backupFileName = await createBackup();
        res.status(200).json({ message: `Backup '${backupFileName}' creado exitosamente.` });
    } catch (err) {
        res.status(500).json({ message: 'Error al ejecutar el backup manual.', error: err.message });
    }
});

/**
 * @route   GET /api/backup/list
 * @desc    Lista los archivos de backup existentes.
 */
router.get('/list', async (req, res) => {
    try {
        await fs.ensureDir(BACKUPS_DIR);
        const files = await fs.readdir(BACKUPS_DIR);
        const dbFiles = files.filter(f => f.endsWith('.db')).sort().reverse(); // Ordena de más nuevo a más viejo
        
        const fileDetails = await Promise.all(dbFiles.map(async (file) => {
            const stats = await fs.stat(path.join(BACKUPS_DIR, file));
            return {
                filename: file,
                size: (stats.size / 1024).toFixed(2), // en KB
                createdAt: stats.birthtime
            };
        }));

        res.status(200).json(fileDetails);
    } catch (err) {
        res.status(500).json({ message: 'Error al listar los backups.', error: err.message });
    }
});

/**
 * @route   GET /api/backup/download/:filename
 * @desc    Descarga un archivo de backup específico.
 */
router.get('/download/:filename', (req, res) => {
    const { filename } = req.params;
    // Medida de seguridad: asegurarse de que no se pueda acceder a carpetas superiores
    if (filename.includes('..')) {
        return res.status(400).send('Nombre de archivo inválido.');
    }
    const filePath = path.join(BACKUPS_DIR, filename);
    res.download(filePath, (err) => {
        if (err) {
            console.error("Error al descargar el backup:", err);
            res.status(404).send('Archivo no encontrado.');
        }
    });
});



module.exports = router;