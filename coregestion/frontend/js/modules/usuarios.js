// frontend/js/modules/usuarios.js
import { fetchData } from '../api.js';

let allRolesCache = []; // Caché para los roles disponibles

/**
 * Función principal que renderiza la vista completa del módulo de Usuarios.
 * @param {HTMLElement} container - El elemento del DOM donde se renderizará.
 */
export async function render(container) {
    container.innerHTML = `
        <h2>Gestión de Usuarios</h2>

        <!-- Formulario para Crear/Editar Usuario -->
        <div id="userFormContainer" class="form-container" style="display:none;">
            <h3 id="userFormTitle">Agregar Nuevo Usuario</h3>
            <form id="userForm" style="width:100%; display:contents;">
                <input type="hidden" id="userId">
                <div class="form-group">
                    <label for="userName">Nombre de Usuario</label>
                    <input type="text" id="userName" required autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="userPassword">Contraseña</label>
                    <input type="password" id="userPassword" placeholder="Dejar en blanco para no cambiar" autocomplete="new-password">
                </div>
                <div class="form-group" style="flex-basis: 100%;">
                    <label>Roles Asignados</label>
                    <div id="userRolesContainer" style="display: flex; flex-wrap: wrap; gap: 1rem; padding-top: 0.5rem;">
                        <!-- Los checkboxes de los roles se insertarán aquí -->
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Guardar Usuario</button>
                    <button type="button" id="cancelBtn" class="btn btn-secondary">Cancelar</button>
                </div>
            </form>
        </div>

        <!-- Tabla de Usuarios -->
        <div class="table-container">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Listado de Usuarios del Sistema</h3>
                <button id="showFormBtn" class="btn btn-success">Agregar Usuario</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>ID</th><th>Nombre de Usuario</th><th>Roles</th><th style="width: 150px;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="usersTableBody"></tbody>
            </table>
        </div>
    `;

    await initializeModule();
}

async function initializeModule() {
    try {
        allRolesCache = await fetchData('roles'); // Precargar roles
        setupEventListeners();
        await loadUsers();
    } catch(e) {
        console.error("Error inicializando el módulo de usuarios:", e);
        alert("No se pudo inicializar el módulo de usuarios.");
    }
}

async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '<tr><td colspan="4">Cargando usuarios...</td></tr>';
    try {
        const users = await fetchData('users');
        tableBody.innerHTML = '';
        users.forEach(user => {
            const row = tableBody.insertRow();
            row.dataset.userId = user.id;
            // Guardamos los roles en un data-attribute para fácil acceso
            row.dataset.userRoles = JSON.stringify(user.roles); 
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.roles.join(', ') || 'Sin roles'}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-warning edit-btn">Editar</button>
                    <button class="btn btn-sm btn-danger delete-btn">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
    }
}

function setupEventListeners() {
    document.getElementById('showFormBtn').addEventListener('click', () => showForm());
    document.getElementById('cancelBtn').addEventListener('click', hideForm);
    document.getElementById('userForm').addEventListener('submit', handleFormSubmit);

    document.getElementById('usersTableBody').addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('tr');
        if (!row) return;

        const userId = row.dataset.userId;
        const userRoles = JSON.parse(row.dataset.userRoles);

        if (target.classList.contains('edit-btn')) {
            showForm(userId, userRoles);
        }
        if (target.classList.contains('delete-btn')) {
            deleteUser(userId);
        }
    });
}

// --- Lógica de Formularios y Acciones ---

function showForm(editId = null, userRoles = []) {
    hideForm();
    const formContainer = document.getElementById('userFormContainer');
    const passwordInput = document.getElementById('userPassword');
    const rolesContainer = document.getElementById('userRolesContainer');
    rolesContainer.innerHTML = ''; // Limpiar roles anteriores

    // Llenar el contenedor con los checkboxes de roles
    allRolesCache.forEach(role => {
        const isChecked = userRoles.includes(role.name);
        rolesContainer.innerHTML += `
            <label style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" class="role-checkbox" value="${role.id}" ${isChecked ? 'checked' : ''}>
                ${role.name}
            </label>
        `;
    });

    if (editId) {
        const userRow = document.querySelector(`tr[data-user-id='${editId}']`);
        document.getElementById('userFormTitle').textContent = 'Editar Usuario';
        passwordInput.placeholder = 'Dejar en blanco para no cambiar';
        passwordInput.required = false;
        document.getElementById('userId').value = editId;
        document.getElementById('userName').value = userRow.cells[1].textContent;
    } else {
        document.getElementById('userFormTitle').textContent = 'Agregar Nuevo Usuario';
        passwordInput.placeholder = 'Contraseña (mínimo 6 caracteres)';
        passwordInput.required = true;
    }
    formContainer.style.display = 'block';
}

function hideForm() {
    document.getElementById('userFormContainer').style.display = 'none';
    document.getElementById('userForm').reset();
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('userId').value;
    const password = document.getElementById('userPassword').value;

    // Recolectar los IDs de los roles seleccionados
    const selectedRoleIds = Array.from(document.querySelectorAll('.role-checkbox:checked')).map(cb => cb.value);

    if (selectedRoleIds.length === 0) {
        alert('Debe asignar al menos un rol al usuario.');
        return;
    }

    const data = {
        username: document.getElementById('userName').value,
        roleIds: selectedRoleIds,
    };
    
    if (password) data.password = password;

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `users/${id}` : 'users';

    try {
        await fetchData(endpoint, { method, body: JSON.stringify(data) });
        alert(`Usuario ${id ? 'actualizado' : 'creado'} con éxito.`);
        hideForm();
        await loadUsers();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteUser(id) {
    const userRow = document.querySelector(`tr[data-user-id='${id}']`);
    const name = userRow ? userRow.children[1].textContent : `ID ${id}`;
    
    if (confirm(`¿Estás seguro de que quieres eliminar al usuario "${name}"?`)) {
        try {
            await fetchData(`users/${id}`, { method: 'DELETE' });
            alert('Usuario eliminado con éxito.');
            await loadUsers();
        } catch (error) {
            alert(`Error al eliminar usuario: ${error.message}`);
        }
    }
}