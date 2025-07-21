// frontend/js/modules/backup.js
import { fetchData } from '../api.js';

export async function render(container) {
    let hourOptions = '';
    for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, '0');
        hourOptions += `<option value="${hour}">${hour}:00 hs</option>`;
    }

    container.innerHTML = `
        <div id="notification-area-backup" class="notification-area"></div>
        <h2>Gestión de Backups de Base de Datos</h2>

        <!-- Sección de Configuración -->
        <div class="form-container">
            <h3 style="width: 100%; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem;">Configuración de Backups Automáticos</h3>
            <form id="backupConfigForm" style="width:100%; display:contents; align-items: flex-end;">
                <div class="form-group" style="flex-direction: row; align-items: center; gap: 1rem; flex-basis: 100%;">
                    <label for="backupEnabled" style="margin-bottom: 0;">Activar Backups Automáticos:</label>
                    <input type="checkbox" id="backupEnabled" class="toggle-switch">
                </div>
                <div class="form-group">
                    <label for="backupFrequency">Frecuencia</label>
                    <select id="backupFrequency">
                        <option value="diario">Diario</option>
                        <option value="semanal">Semanal</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="backupHour">Hora de Ejecución</label>
                    <select id="backupHour">${hourOptions}</select>
                </div>
                <div class="form-group">
                    <label for="backupRetention">Copias a Conservar</label>
                    <input type="number" id="backupRetention" min="1" value="7" required>
                </div>
                <div class="form-group" style="flex-basis: 100%;">
                    <label for="backupEmail">Email para Notificaciones</label>
                    <input type="email" id="backupEmail" placeholder="admin@ejemplo.com">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Guardar Configuración</button>
                </div>
            </form>
        </div>

        <!-- Sección de Acciones y Listado -->
        <div class="table-container" style="margin-top: 2rem;">
             <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Backups Disponibles</h3>
                <button id="runBackupNowBtn" class="btn btn-success">Realizar Backup Ahora</button>
            </div>
            <table>
                <thead>
                    <tr><th>Fecha de Creación</th><th>Nombre del Archivo</th><th>Tamaño</th><th>Acciones</th></tr>
                </thead>
                <tbody id="backupsTableBody"></tbody>
            </table>
        </div>
        <style>
            .toggle-switch { width: 50px; height: 25px; appearance: none; background: #ccc; border-radius: 25px; position: relative; cursor: pointer; transition: background-color 0.3s; }
            .toggle-switch::before { content: ''; position: absolute; width: 21px; height: 21px; border-radius: 50%; background: white; top: 2px; left: 2px; transition: transform 0.3s; }
            .toggle-switch:checked { background-color: var(--color-success); }
            .toggle-switch:checked::before { transform: translateX(25px); }
        </style>
    `;
    await initializeModule();
}

async function initializeModule() {
    setupEventListeners();
    await loadConfig();
    await loadBackups();
}

function setupEventListeners() {
    document.getElementById('backupConfigForm').addEventListener('submit', handleConfigSave);
    document.getElementById('runBackupNowBtn').addEventListener('click', handleRunBackupNow);
    document.getElementById('backupsTableBody').addEventListener('click', (e) => {
        const target = e.target.closest('button.download-btn');
        if (target) {
            handleDownload(target.dataset.filename);
        }
    });
}

async function loadConfig() {
    try {
        const config = await fetchData('backup/config');
        document.getElementById('backupEnabled').checked = config.backup_enabled === 'true';
        document.getElementById('backupFrequency').value = config.backup_frequency || 'diario';
        document.getElementById('backupRetention').value = config.backup_retention_count || '7';
        document.getElementById('backupHour').value = config.backup_hour || '03';
        document.getElementById('backupEmail').value = config.backup_notification_email || '';
    } catch (error) {
        showNotification(`Error al cargar la configuración: ${error.message}`, 'error');
    }
}

async function loadBackups() {
    const tableBody = document.getElementById('backupsTableBody');
    tableBody.innerHTML = '<tr><td colspan="4">Cargando backups...</td></tr>';
    try {
        const backups = await fetchData('backup/list');
        tableBody.innerHTML = '';
        if (backups.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">No hay backups disponibles.</td></tr>';
            return;
        }
        backups.forEach(backup => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${new Date(backup.createdAt).toLocaleString('es-AR')}</td>
                <td>${backup.filename}</td>
                <td>${backup.size} KB</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-primary download-btn" data-filename="${backup.filename}">Descargar</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4">Error al listar backups: ${error.message}</td></tr>`;
    }
}

async function handleConfigSave(e) {
    e.preventDefault();
    const configData = {
        backup_enabled: document.getElementById('backupEnabled').checked,
        backup_frequency: document.getElementById('backupFrequency').value,
        backup_retention_count: document.getElementById('backupRetention').value,
        backup_hour: document.getElementById('backupHour').value,
        backup_notification_email: document.getElementById('backupEmail').value,
    };
    try {
        const result = await fetchData('backup/config', {
            method: 'POST',
            body: JSON.stringify(configData)
        });
        showNotification(result.message, 'success');
    } catch (error) {
        showNotification(`Error al guardar la configuración: ${error.message}`, 'error');
    }
}

async function handleRunBackupNow() {
    if (!confirm('¿Estás seguro de que quieres realizar un backup manual en este momento?')) {
        return;
    }
    showNotification('Iniciando backup manual...', 'info');
    try {
        const result = await fetchData('backup/run-now', { method: 'POST' });
        showNotification(result.message, 'success');
        await loadBackups(); // Recargar la lista para ver el nuevo backup
    } catch (error) {
        showNotification(`Error en el backup manual: ${error.message}`, 'error');
    }
}

async function handleDownload(filename) {
    showNotification(`Preparando descarga de ${filename}...`, 'info');
    try {
        const fileBlob = await fetchData(`backup/download/${filename}`);
        const url = window.URL.createObjectURL(fileBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (error) {
        showNotification(`Error al descargar el archivo: ${error.message}`, 'error');
    }
}

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area-backup');
    if (!notificationArea) return;
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.style.display = 'block';
    setTimeout(() => {
        notificationArea.style.display = 'none';
    }, 4000);
}