// frontend/js/modules/proveedores.js
import { fetchData } from '../api.js';

let editingProveedorId = null;

export async function render(container) {
    container.innerHTML = `
        <div id="notification-area-proveedores" class="notification-area"></div>
        <h2>Gestión de Proveedores</h2>
        
        <div id="proveedorFormContainer" class="form-container" style="display:none;">
            <h3 id="formTitle">Agregar Proveedor</h3>
            <form id="proveedorForm" style="width:100%; display:contents;">
                <input type="hidden" id="proveedorId">
                <div class="form-group"><label for="proveedorName">Nombre</label><input type="text" id="proveedorName" required></div>
                <div class="form-group"><label for="proveedorCuit">CUIT</label><input type="text" id="proveedorCuit"></div>
                <div class="form-group"><label for="proveedorEmail">Email</label><input type="email" id="proveedorEmail"></div>
                <div class="form-group"><label for="proveedorPhone">Teléfono</label><input type="tel" id="proveedorPhone"></div>
                <div class="form-group" style="flex-basis: 100%;"><label for="proveedorAddress">Dirección</label><input type="text" id="proveedorAddress"></div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Guardar</button>
                    <button type="button" id="cancelBtn" class="btn btn-secondary">Cancelar</button>
                </div>
            </form>
        </div>

        <div class="table-container">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Listado de Proveedores</h3>
                <button id="addProveedorBtn" class="btn btn-success">Agregar Proveedor</button>
            </div>
            <table>
                <thead>
                    <tr><th>ID</th><th>Nombre</th><th>CUIT</th><th>Email</th><th>Teléfono</th><th style="width: 150px;">Acciones</th></tr>
                </thead>
                <tbody id="proveedoresTableBody"></tbody>
            </table>
        </div>
        <style>
            .notification-area { padding: 1rem; margin-bottom: 1rem; border-radius: var(--border-radius-md); display: none; text-align: center; font-weight: bold; }
            .notification-area.success { background-color: #d4edda; color: #155724; }
            .notification-area.error { background-color: #f8d7da; color: #721c24; }
        </style>
    `;
    setupEventListeners();
    await loadProveedores();
}

async function loadProveedores() {
    const tableBody = document.getElementById('proveedoresTableBody');
    tableBody.innerHTML = '<tr><td colspan="6">Cargando proveedores...</td></tr>';
    try {
        const proveedores = await fetchData('proveedores');
        tableBody.innerHTML = '';
        proveedores.forEach(proveedor => {
            const row = tableBody.insertRow();
            row.dataset.proveedorId = proveedor.id;
            // --- CELDAS CON ALINEACIÓN APLICADA ---
            row.innerHTML = `
                <td class="text-right">${proveedor.id}</td>
                <td class="text-left">${proveedor.nombre || ''}</td>
                <td class="text-left">${proveedor.cuit || ''}</td>
                <td class="text-left">${proveedor.email || ''}</td>
                <td class="text-left">${proveedor.telefono || ''}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-warning edit-btn" data-id="${proveedor.id}">Editar</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${proveedor.id}" data-name="${proveedor.nombre}">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    }
}

function setupEventListeners() {
    document.getElementById('addProveedorBtn').addEventListener('click', showAddForm);
    document.getElementById('cancelBtn').addEventListener('click', hideForm);
    document.getElementById('proveedorForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('proveedoresTableBody').addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        if (target.classList.contains('edit-btn')) showEditForm(target.dataset.id);
        if (target.classList.contains('delete-btn')) deleteProveedor(target.dataset.id, target.dataset.name);
    });
}

function showAddForm() {
    editingProveedorId = null;
    document.getElementById('proveedorForm').reset();
    document.getElementById('formTitle').textContent = 'Agregar Proveedor';
    document.getElementById('proveedorFormContainer').style.display = 'block';
}

async function showEditForm(id) {
    editingProveedorId = id;
    document.getElementById('proveedorForm').reset();
    try {
        const proveedor = await fetchData(`proveedores/${id}`);
        document.getElementById('proveedorId').value = proveedor.id;
        document.getElementById('proveedorName').value = proveedor.nombre;
        document.getElementById('proveedorCuit').value = proveedor.cuit;
        document.getElementById('proveedorAddress').value = proveedor.direccion;
        document.getElementById('proveedorPhone').value = proveedor.telefono;
        document.getElementById('proveedorEmail').value = proveedor.email;
        document.getElementById('formTitle').textContent = 'Editar Proveedor';
        document.getElementById('proveedorFormContainer').style.display = 'block';
    } catch (error) {
        showNotification(`Error al cargar datos del proveedor: ${error.message}`, 'error');
    }
}

function hideForm() {
    document.getElementById('proveedorFormContainer').style.display = 'none';
    document.getElementById('proveedorForm').reset();
    editingProveedorId = null;
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const proveedorData = {
        id: editingProveedorId,
        nombre: document.getElementById('proveedorName').value,
        cuit: document.getElementById('proveedorCuit').value,
        direccion: document.getElementById('proveedorAddress').value,
        telefono: document.getElementById('proveedorPhone').value,
        email: document.getElementById('proveedorEmail').value,
    };
    try {
        if (editingProveedorId) {
            await fetchData(`proveedores/${editingProveedorId}`, { method: 'PUT', body: JSON.stringify(proveedorData) });
            showNotification('Proveedor actualizado exitosamente.');
        } else {
            const newProveedor = await fetchData('proveedores', { method: 'POST', body: JSON.stringify(proveedorData) });
            showNotification('Proveedor creado exitosamente.');
        }
        hideForm();
        await loadProveedores();
    } catch (error) {
        showNotification(`Error al guardar proveedor: ${error.message}`, 'error');
    }
}

async function deleteProveedor(id, name) {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${name}?`)) {
        try {
            await fetchData(`proveedores/${id}`, { method: 'DELETE' });
            showNotification('Proveedor eliminado exitosamente.');
            await loadProveedores();
        } catch (error) {
            showNotification(`Error al eliminar proveedor: ${error.message}`, 'error');
        }
    }
}

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area-proveedores');
    if (!notificationArea) return;
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.style.display = 'block';
    setTimeout(() => {
        notificationArea.style.display = 'none';
    }, 4000);
}