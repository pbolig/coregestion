// frontend/js/modules/clientes.js
import { fetchData } from '../api.js';

let editingClientId = null;

export async function render(container) {
    container.innerHTML = `
        <div id="notification-area-clientes" class="notification-area"></div>
        <h2>Gestión de Clientes</h2>
        
        <div id="clientFormContainer" class="form-container" style="display:none;">
            <h3 id="formTitle">Agregar Cliente</h3>
            <form id="clientForm" style="width:100%; display:contents;">
                <input type="hidden" id="clientId">
                <div class="form-group"><label for="clientName">Nombre</label><input type="text" id="clientName" required></div>
                <div class="form-group"><label for="clientCuit">CUIT</label><input type="text" id="clientCuit"></div>
                <div class="form-group"><label for="clientEmail">Email</label><input type="email" id="clientEmail"></div>
                <div class="form-group"><label for="clientPhone">Teléfono</label><input type="tel" id="clientPhone"></div>
                <div class="form-group" style="flex-basis: 100%;"><label for="clientAddress">Dirección</label><input type="text" id="clientAddress"></div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Guardar</button>
                    <button type="button" id="cancelBtn" class="btn btn-secondary">Cancelar</button>
                </div>
            </form>
        </div>

        <div class="table-container">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Listado de Clientes</h3>
                <button id="addClientBtn" class="btn btn-success">Agregar Cliente</button>
            </div>
            <table>
                <thead>
                    <tr><th>ID</th><th>Nombre</th><th>CUIT</th><th>Email</th><th>Teléfono</th><th style="width: 150px;">Acciones</th></tr>
                </thead>
                <tbody id="clientsTableBody"></tbody>
            </table>
        </div>
        <style>
            .notification-area { padding: 1rem; margin-bottom: 1rem; border-radius: var(--border-radius-md); display: none; text-align: center; font-weight: bold; }
            .notification-area.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .notification-area.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        </style>
    `;
    setupEventListeners();
    await loadClients();
}

async function loadClients() {
    const tableBody = document.getElementById('clientsTableBody');
    tableBody.innerHTML = '<tr><td colspan="6">Cargando clientes...</td></tr>';
    try {
        const clients = await fetchData('clientes');
        tableBody.innerHTML = '';
        clients.forEach(client => {
            const row = tableBody.insertRow();
            row.dataset.clientId = client.id;
            // --- CELDAS CON ALINEACIÓN APLICADA ---
            row.innerHTML = `
                <td class="text-right">${client.id}</td>
                <td class="text-left">${client.nombre || ''}</td>
                <td class="text-left">${client.cuit || ''}</td>
                <td class="text-left">${client.email || ''}</td>
                <td class="text-left">${client.telefono || ''}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-warning edit-btn" data-id="${client.id}">Editar</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${client.id}" data-name="${client.nombre}">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    }
}

/**
 * CORREGIDO: Crea una nueva fila completa en la tabla.
 * @param {object} client - Los datos del cliente a añadir.
 */
function addClientRowToTable(client) {
    const tableBody = document.getElementById('clientsTableBody');
    // insertRow(0) añade la fila al principio, para verla inmediatamente.
    const row = tableBody.insertRow(0); 
    row.dataset.clientId = client.id;
    
    row.innerHTML = `
        <td>${client.id}</td>
        <td>${client.nombre || ''}</td>
        <td>${client.cuit || ''}</td>
        <td>${client.email || ''}</td>
        <td>${client.telefono || ''}</td>
        <td class="actions-cell">
            <button class="btn btn-sm btn-warning edit-btn" data-id="${client.id}">Editar</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${client.id}" data-name="${client.nombre}">Eliminar</button>
        </td>
    `;
}

/**
 * CORREGIDO: Actualiza las celdas de una fila existente.
 * @param {object} client - Los datos actualizados del cliente.
 */
function updateClientRowInTable(client) {
    const row = document.querySelector(`tr[data-client-id='${client.id}']`);
    if (row) {
        row.cells[1].textContent = client.nombre || '';
        row.cells[2].textContent = client.cuit || '';
        row.cells[3].textContent = client.email || '';
        row.cells[4].textContent = client.telefono || '';
        // Actualizamos el nombre en el botón de eliminar por si cambió
        const deleteBtn = row.querySelector('.delete-btn');
        if (deleteBtn) deleteBtn.dataset.name = client.nombre;
    }
}

function setupEventListeners() {
    document.getElementById('addClientBtn').addEventListener('click', showAddForm);
    document.getElementById('cancelBtn').addEventListener('click', hideForm);
    document.getElementById('clientForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('clientsTableBody').addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        if (target.classList.contains('edit-btn')) showEditForm(target.dataset.id);
        if (target.classList.contains('delete-btn')) deleteClient(target.dataset.id, target.dataset.name);
    });
}

function showAddForm() {
    editingClientId = null;
    document.getElementById('clientForm').reset();
    document.getElementById('formTitle').textContent = 'Agregar Cliente';
    document.getElementById('clientFormContainer').style.display = 'block';
}

async function showEditForm(id) {
    editingClientId = id;
    document.getElementById('clientForm').reset();
    try {
        const client = await fetchData(`clientes/${id}`);
        document.getElementById('clientId').value = client.id;
        document.getElementById('clientName').value = client.nombre;
        document.getElementById('clientCuit').value = client.cuit;
        document.getElementById('clientAddress').value = client.direccion;
        document.getElementById('clientPhone').value = client.telefono;
        document.getElementById('clientEmail').value = client.email;
        document.getElementById('formTitle').textContent = 'Editar Cliente';
        document.getElementById('clientFormContainer').style.display = 'block';
    } catch (error) {
        showNotification(`Error al cargar datos del cliente: ${error.message}`, 'error');
    }
}

function hideForm() {
    document.getElementById('clientFormContainer').style.display = 'none';
    document.getElementById('clientForm').reset();
    editingClientId = null;
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const clientData = {
        id: editingClientId,
        nombre: document.getElementById('clientName').value,
        cuit: document.getElementById('clientCuit').value,
        direccion: document.getElementById('clientAddress').value,
        telefono: document.getElementById('clientPhone').value,
        email: document.getElementById('clientEmail').value,
    };
    try {
        if (editingClientId) {
            await fetchData(`clientes/${editingClientId}`, { method: 'PUT', body: JSON.stringify(clientData) });
            showNotification('Cliente actualizado exitosamente.');
            updateClientRowInTable(clientData);
        } else {
            const newClient = await fetchData('clientes', { method: 'POST', body: JSON.stringify(clientData) });
            showNotification('Cliente creado exitosamente.');
            addClientRowToTable({ ...clientData, id: newClient.id });
        }
        hideForm();
    } catch (error) {
        showNotification(`Error al guardar cliente: ${error.message}`, 'error');
    }
}

async function deleteClient(id, name) {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${name}?`)) {
        try {
            await fetchData(`clientes/${id}`, { method: 'DELETE' });
            showNotification('Cliente eliminado exitosamente.');
            const row = document.querySelector(`tr[data-client-id='${id}']`);
            if (row) row.remove();
        } catch (error) {
            showNotification(`Error al eliminar cliente: ${error.message}`, 'error');
        }
    }
}

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area-clientes');
    if (!notificationArea) return;
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.style.display = 'block';
    setTimeout(() => {
        notificationArea.style.display = 'none';
    }, 4000);
}