// frontend/js/modules/roles.js
import { fetchData } from '../api.js';

/**
 * Función principal que renderiza la vista de Gestión de Roles.
 * @param {HTMLElement} container - El elemento del DOM donde se renderizará.
 */
export async function render(container) {
    container.innerHTML = `
        <h2>Gestión de Roles del Sistema</h2>

        <!-- Formulario para Crear/Editar Rol -->
        <div id="roleFormContainer" class="form-container" style="display:none;">
            <h3 id="roleFormTitle">Agregar Nuevo Rol</h3>
            <form id="roleForm" style="width:100%; display:contents;">
                <input type="hidden" id="roleId">
                <div class="form-group">
                    <label for="roleName">Nombre del Rol</label>
                    <input type="text" id="roleName" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Guardar Rol</button>
                    <button type="button" id="cancelBtn" class="btn btn-secondary">Cancelar</button>
                </div>
            </form>
        </div>

        <!-- Tabla de Roles -->
        <div class="table-container">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Listado de Roles Disponibles</h3>
                <button id="showFormBtn" class="btn btn-success">Agregar Rol</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>ID</th><th>Nombre del Rol</th><th style="width: 150px;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="rolesTableBody"></tbody>
            </table>
        </div>
    `;

    setupEventListeners();
    await loadRoles();
}

async function loadRoles() {
    const tableBody = document.getElementById('rolesTableBody');
    tableBody.innerHTML = '<tr><td colspan="3">Cargando roles...</td></tr>';
    try {
        const roles = await fetchData('roles');
        tableBody.innerHTML = '';
        roles.forEach(role => {
            const row = tableBody.insertRow();
            row.dataset.roleId = role.id;
            const isAdminRole = role.name === 'admin';
            row.innerHTML = `
                <td>${role.id}</td>
                <td>${role.name}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-warning edit-btn" ${isAdminRole ? 'disabled' : ''}>Editar</button>
                    <button class="btn btn-sm btn-danger delete-btn" ${isAdminRole ? 'disabled' : ''}>Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="3">Error: ${error.message}</td></tr>`;
    }
}

function setupEventListeners() {
    document.getElementById('showFormBtn').addEventListener('click', () => showForm());
    document.getElementById('cancelBtn').addEventListener('click', hideForm);
    document.getElementById('roleForm').addEventListener('submit', handleFormSubmit);

    document.getElementById('rolesTableBody').addEventListener('click', (event) => {
        const target = event.target;
        if (target.disabled) return; // No hacer nada si el botón está deshabilitado

        const roleId = target.closest('tr')?.dataset.roleId;

        if (target.classList.contains('edit-btn')) {
            showForm(roleId);
        }
        if (target.classList.contains('delete-btn')) {
            deleteRole(roleId);
        }
    });
}

function showForm(editId = null) {
    hideForm();
    const formContainer = document.getElementById('roleFormContainer');

    if (editId) {
        document.getElementById('roleFormTitle').textContent = 'Editar Rol';
        const roleRow = document.querySelector(`tr[data-role-id='${editId}']`);
        document.getElementById('roleId').value = editId;
        document.getElementById('roleName').value = roleRow.cells[1].textContent;
    } else {
        document.getElementById('roleFormTitle').textContent = 'Agregar Nuevo Rol';
    }
    formContainer.style.display = 'block';
}

function hideForm() {
    document.getElementById('roleFormContainer').style.display = 'none';
    document.getElementById('roleForm').reset();
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('roleId').value;
    const data = { name: document.getElementById('roleName').value };
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `roles/${id}` : 'roles';

    try {
        await fetchData(endpoint, { method, body: JSON.stringify(data) });
        alert(`Rol ${id ? 'actualizado' : 'creado'} con éxito.`);
        hideForm();
        await loadRoles();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteRole(id) {
    const roleRow = document.querySelector(`tr[data-role-id='${id}']`);
    const name = roleRow ? roleRow.children[1].textContent : `ID ${id}`;
    
    if (confirm(`¿Estás seguro de que quieres eliminar el rol "${name}"?`)) {
        try {
            await fetchData(`roles/${id}`, { method: 'DELETE' });
            alert('Rol eliminado con éxito.');
            await loadRoles();
        } catch (error) {
            alert(`Error al eliminar rol: ${error.message}`);
        }
    }
}