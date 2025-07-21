// backend/services/backupService.js
const fs = require('fs-extra');
const path = require('path');
const dbPromise = require('../db');

/**
 * Crea una copia de seguridad y aplica la política de retención.
 * @returns {Promise<string>} - Una promesa que resuelve con el nombre del archivo de backup creado.
 */
async function createBackup() {
    const dbPath = path.join(__dirname, '../database.db');
    const backupsDir = path.join(__dirname, '../backups');

    await fs.ensureDir(backupsDir);

    const now = new Date();
    const backupFileName = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}-bkdb.db`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    await fs.copy(dbPath, backupFilePath);
    console.log(`[BACKUP-SERVICE] Backup creado exitosamente: ${backupFileName}`);

    // --- LÓGICA DE RETENCIÓN ---
    await applyRetentionPolicy(backupsDir);

    return backupFileName;
}

/**
 * Revisa la carpeta de backups y elimina los más antiguos si se excede el límite.
 * @param {string} backupsDir - La ruta a la carpeta de backups.
 */
async function applyRetentionPolicy(backupsDir) {
    console.log('[BACKUP-SERVICE] Aplicando política de retención...');
    try {
        const db = await dbPromise;
        const config = await db.get("SELECT value FROM system_config WHERE key = 'backup_retention_count'");
        const retentionCount = parseInt(config?.value, 10);

        if (isNaN(retentionCount) || retentionCount <= 0) {
            console.log('[BACKUP-SERVICE] Política de retención no configurada o inválida. No se eliminarán backups.');
            return;
        }

        const backupFiles = await fs.readdir(backupsDir);
        const dbBackups = backupFiles.filter(f => f.endsWith('.db'));

        if (dbBackups.length > retentionCount) {
            console.log(`[BACKUP-SERVICE] Límite de ${retentionCount} backups excedido. Se tienen ${dbBackups.length}. Eliminando los más antiguos.`);
            
            // Obtenemos las fechas de creación de cada archivo
            const filesWithStats = await Promise.all(
                dbBackups.map(async file => {
                    const filePath = path.join(backupsDir, file);
                    const stats = await fs.stat(filePath);
                    return { name: file, time: stats.birthtimeMs };
                })
            );

            // Ordenamos los archivos del más antiguo al más nuevo
            filesWithStats.sort((a, b) => a.time - b.time);

            // Calculamos cuántos archivos hay que borrar
            const filesToDeleteCount = filesWithStats.length - retentionCount;
            const filesToDelete = filesWithStats.slice(0, filesToDeleteCount);

            // Eliminamos los archivos más antiguos
            for (const file of filesToDelete) {
                await fs.remove(path.join(backupsDir, file.name));
                console.log(`[BACKUP-SERVICE] Backup antiguo eliminado: ${file.name}`);
            }
        } else {
            console.log('[BACKUP-SERVICE] No se excede el límite de retención. No se eliminan backups.');
        }

    } catch (error) {
        console.error('[BACKUP-SERVICE-ERROR] Falló la aplicación de la política de retención:', error);
    }
}

module.exports = { createBackup };