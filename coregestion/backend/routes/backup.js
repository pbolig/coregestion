// backend/routes/backup.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createBackup } = require('../services/backupService');
const { reprogramarBackupTask } = require('../scheduler');
const fs = require('fs-extra');
const path = require('path');

const BACKUPS_DIR = path.join(__dirname, '../backups');

// Middleware para asegurar que solo los admins accedan a este módulo
router.use(authenticateToken, authorizeRoles(['admin']));

/**
 * @route   GET /api/backup/config
 * @desc    Obtiene la configuración actual del sistema de backups.
 */
router.get('/config', (req, res) => {
    try {
        const stmt = db.prepare("SELECT key, value FROM system_config WHERE key LIKE 'backup_%'");
        const rows = stmt.all();
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
router.post('/config', (req, res) => {
    const { backup_enabled, backup_frequency, backup_notification_email, backup_retention_count, backup_hour } = req.body;
    
    try {
        const saveConfigTransaction = db.transaction(() => {
            const stmt = db.prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)");
            stmt.run('backup_enabled', String(backup_enabled));
            stmt.run('backup_frequency', backup_frequency);
            stmt.run('backup_notification_email', backup_notification_email);
            stmt.run('backup_retention_count', String(backup_retention_count));
            stmt.run('backup_hour', String(backup_hour).padStart(2, '0'));
        });

        saveConfigTransaction();
        
        // Después de guardar, le decimos al scheduler que se reprograme (esto es asíncrono)
        reprogramarBackupTask().catch(err => console.error("Error al reprogramar la tarea de backup:", err));

        res.status(200).json({ message: 'Configuración de backup actualizada exitosamente.' });
    } catch (err) {
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
        const dbFiles = files.filter(f => f.endsWith('.db')).sort().reverse();
        
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
    if (filename.includes('..')) {
        return res.status(400).send('Nombre de archivo inválido.');
    }
    const filePath = path.join(BACKUPS_DIR, filename);
    res.download(filePath, (err) => {
        if (err) {
            console.error("Error al descargar el backup:", err);
            if (!res.headersSent) {
                res.status(404).send('Archivo no encontrado.');
            }
        }
    });
});

module.exports = router;