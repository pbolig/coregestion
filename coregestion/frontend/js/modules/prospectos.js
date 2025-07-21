// frontend/js/modules/prospectos.js
import { fetchData } from '../api.js';

const moduleHTML = `
    <div id="notification-area-prospectos" class="notification-area"></div>
    <h2>Gestión de Prospectos y Solicitudes</h2>
    <div class="tabs-container">
        <button class="tab-link active" data-target="prospectosTab">Prospectos Pendientes</button>
        <button class="tab-link" data-target="solicitudesTab">Solicitudes Recibidas</button>
    </div>
    <div id="prospectosTab" class="tab-content active">
        <h3>Nuevos Prospectos Pendientes de Aprobación</h3>
        <div class="table-container">
            <table>
                <thead><tr><th>Nombre</th><th>Empresa</th><th>Email</th><th>Teléfono</th><th style="width: 200px;">Acciones</th></tr></thead>
                <tbody id="prospectosTableBody"></tbody>
            </table>
        </div>
    </div>
    <div id="solicitudesTab" class="tab-content">
         <h3>Solicitudes de Presupuesto Recibidas</h3>
         <div class="table-container">
            <table>
                <thead><tr><th>Fecha</th><th>Prospecto</th><th>Descripción</th><th>Estado</th><th style="width: 180px;">Acciones</th></tr></thead>
                <tbody id="solicitudesTableBody"></tbody>
            </table>
        </div>
    </div>
    <style>
        .tabs-container { border-bottom: 2px solid var(--color-border); margin-bottom: 1.5rem; }
        .tab-link { background: none; border: none; padding: 1rem 1.5rem; cursor: pointer; font-size: 1.1rem; border-bottom: 3px solid transparent; }
        .tab-link.active { border-bottom-color: var(--color-primary); font-weight: bold; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .notification-area { padding: 1rem; margin-bottom: 1rem; border-radius: var(--border-radius-md); display: none; text-align: center; font-weight: bold; }
        .notification-area.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .notification-area.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
`;

let moduleContainer;

export async function render(container) {
    container.innerHTML = moduleHTML;
    moduleContainer = container;
    await initializeModule();
}

async function initializeModule() {
    setupEventListeners();
    await loadProspectos();
    await loadSolicitudes();
}

function setupEventListeners() {
    moduleContainer.querySelectorAll('.tab-link').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            moduleContainer.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            moduleContainer.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
            moduleContainer.querySelector(`#${targetId}`).classList.add('active');
            button.classList.add('active');
        });
    });

    moduleContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.closest('#prospectosTableBody')) {
            const prospectoId = target.dataset.id;
            if (target.classList.contains('approve-btn')) approveProspecto(prospectoId);
            else if (target.classList.contains('reject-btn')) rejectProspecto(prospectoId);
        }
        if (target.closest('#solicitudesTableBody')) {
            if (target.classList.contains('create-budget-btn')) {
                const solicitudData = JSON.parse(target.dataset.solicitud);
                prepararYNavegarAPresupuesto(solicitudData);
            }
        }
    });
}

async function loadProspectos() {
    const tableBody = document.getElementById('prospectosTableBody');
    tableBody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    try {
        const prospectos = await fetchData('prospectos?estado=Pendiente');
        tableBody.innerHTML = '';
        if (prospectos.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No hay nuevos prospectos pendientes.</td></tr>';
        } else {
            prospectos.forEach(p => {
                const row = tableBody.insertRow();
                row.innerHTML = `<td>${p.nombre}</td><td>${p.empresa || 'N/A'}</td><td>${p.email}</td><td>${p.telefono || 'N/A'}</td><td class="actions-cell"><button class="btn btn-sm btn-success approve-btn" data-id="${p.id}">Aprobar</button><button class="btn btn-sm btn-danger reject-btn" data-id="${p.id}">Rechazar</button></td>`;
            });
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
    }
}

async function loadSolicitudes() {
    const tableBody = document.getElementById('solicitudesTableBody');
    tableBody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    try {
        const solicitudes = await fetchData('solicitudes');
        tableBody.innerHTML = '';
        if (solicitudes.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No hay solicitudes recibidas.</td></tr>';
        } else {
            solicitudes.forEach(s => {
                const row = tableBody.insertRow();
                const solicitudDataString = JSON.stringify(s);
                row.innerHTML = `<td>${new Date(s.fecha_solicitud).toLocaleDateString('es-AR')}</td><td>${s.prospecto_nombre} (${s.prospecto_empresa || 'Particular'})</td><td>${s.descripcion_necesidad}</td><td>${s.estado}</td><td class="actions-cell"><button class="btn btn-sm btn-primary create-budget-btn" data-solicitud='${solicitudDataString}' ${s.estado !== 'Recibida' ? 'disabled' : ''}>Crear Presupuesto</button></td>`;
            });
        }
    } catch (error) {
         tableBody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
    }
}

async function approveProspecto(id) {
    if (confirm(`¿Seguro que quieres aprobar este prospecto y convertirlo en cliente?`)) {
        try {
            const result = await fetchData(`prospectos/${id}/aprobar`, { method: 'POST' });
            showNotification(result.message, 'success');
            await loadProspectos();
        } catch (error) {
            showNotification(`Error al aprobar: ${error.message}`, 'error');
        }
    }
}

async function rejectProspecto(id) {
     if (confirm(`¿Seguro que quieres rechazar a este prospecto?`)) {
        try {
            const result = await fetchData(`prospectos/${id}/rechazar`, { method: 'POST' });
            showNotification(result.message, 'success');
            await loadProspectos();
        } catch (error) {
            showNotification(`Error al rechazar: ${error.message}`, 'error');
        }
    }
}

async function prepararYNavegarAPresupuesto(solicitud) {
    try {
        const clientes = await fetchData('clientes');
        const clienteExistente = clientes.find(c => c.email === solicitud.prospecto_email);
        if (!clienteExistente) {
            showNotification('Este prospecto debe ser aprobado primero.', 'error');
            return;
        }
        
        if (window.navigateToModule) {
            window.navigateToModule('presupuestos', { 
                fromRequest: { 
                    clienteId: clienteExistente.id, 
                    descripcion: solicitud.descripcion_necesidad,
                    solicitud_origen_id: solicitud.id
                }
            });
        } else {
            showNotification('Error de navegación interna.', 'error');
        }
    } catch (error) {
        showNotification(`Error al preparar presupuesto: ${error.message}`, 'error');
    }
}

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area-prospectos');
    if (!notificationArea) return;
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.style.display = 'block';
    setTimeout(() => {
        notificationArea.style.display = 'none';
    }, 4000);
}