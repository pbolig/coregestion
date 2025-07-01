// frontend/js/modules/proveedores.js
import { fetchData } from '../api.js';

/**
 * Función principal que renderiza la vista completa del módulo de proveedores.
 * @param {HTMLElement} container - El elemento del DOM donde se renderizará la vista.
 */
export async function render(container) {
    container.innerHTML = `
        <h2>Gestión de Proveedores</h2>

        <!-- Contenedor para el Formulario de Crear/Editar Proveedor -->
        <div id="proveedorFormContainer" class="form-container" style="display:none;">
            <h3 id="proveedorFormTitle">Agregar Proveedor</h3>
            <form id="proveedorForm" style="width:100%; display:contents;">
                <input type="hidden" id="proveedorId">
                <div class="form-group"><label for="proveedorNombre">Nombre</label><input type="text" id="proveedorNombre" required></div>
                <div class="form-group"><label for="proveedorCuit">CUIT</label><input type="text" id="proveedorCuit"></div>
                <div class="form-group"><label for="proveedorEmail">Email</label><input type="email" id="proveedorEmail"></div>
                <div class="form-group"><label for="proveedorTelefono">Teléfono</label><input type="tel" id="proveedorTelefono"></div>
                <div class="form-group" style="flex-basis: 100%;"><label for="proveedorDireccion">Dirección</label><input type="text" id="proveedorDireccion"></div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Guardar</button>
                    <button type="button" id="cancelBtn" class="btn btn-secondary">Cancelar</button>
                </div>
            </form>
        </div>

        <!-- Contenedor para la Tabla de Proveedores -->
        <div class="table-container">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Listado de Proveedores</h3>
                <button id="showFormBtn" class="btn btn-success">Agregar Proveedor</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>ID</th><th>Nombre</th><th>CUIT</th><th>Email</th><th>Teléfono</th><th style="width: 150px;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="proveedoresTableBody"></tbody>
            </table>
        </div>
    `;

    setupEventListeners();
    await loadProveedores();
}

/**
 * Carga los proveedores desde la API y los muestra en la tabla.
 */
async function loadProveedores() {
    const tableBody = document.getElementById('proveedoresTableBody');
    tableBody.innerHTML = '<tr><td colspan="6">Cargando proveedores...</td></tr>';
    try {
        const proveedores = await fetchData('proveedores');
        tableBody.innerHTML = '';
        proveedores.forEach(proveedor => {
            const row = tableBody.insertRow();
            row.dataset.proveedorId = proveedor.id;
            row.innerHTML = `
                <td>${proveedor.id}</td>
                <td>${proveedor.nombre || ''}</td>
                <td>${proveedor.cuit || ''}</td>
                <td>${proveedor.email || ''}</td>
                <td>${proveedor.telefono || ''}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-warning edit-btn">Editar</button>
                    <button class="btn btn-sm btn-danger delete-btn">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    }
}

/**
 * Configura todos los event listeners del módulo.
 */
function setupEventListeners() {
    document.getElementById('showFormBtn').addEventListener('click', () => showForm());
    document.getElementById('cancelBtn').addEventListener('click', hideForm);
    document.getElementById('proveedorForm').addEventListener('submit', handleFormSubmit);

    // Delegación de eventos para los botones de la tabla
    document.getElementById('proveedoresTableBody').addEventListener('click', (event) => {
        const target = event.target;
        const proveedorId = target.closest('tr')?.dataset.proveedorId;

        if (target.classList.contains('edit-btn')) {
            showForm(proveedorId);
        }
        if (target.classList.contains('delete-btn')) {
            const proveedorNombre = target.closest('tr').children[1].textContent;
            deleteProveedor(proveedorId, proveedorNombre);
        }
    });
}

// --- Lógica de Formularios y Acciones ---

/**
 * Muestra el formulario para agregar o editar un proveedor.
 * @param {string|null} editId - El ID del proveedor a editar, o null para crear uno nuevo.
 */
async function showForm(editId = null) {
    hideForm(); // Resetea el formulario antes de mostrarlo
    const formContainer = document.getElementById('proveedorFormContainer');

    if (editId) {
        document.getElementById('proveedorFormTitle').textContent = 'Editar Proveedor';
        try {
            const proveedor = await fetchData(`proveedores/${editId}`);
            document.getElementById('proveedorId').value = proveedor.id;
            document.getElementById('proveedorNombre').value = proveedor.nombre;
            document.getElementById('proveedorCuit').value = proveedor.cuit;
            document.getElementById('proveedorEmail').value = proveedor.email;
            document.getElementById('proveedorTelefono').value = proveedor.telefono;
            document.getElementById('proveedorDireccion').value = proveedor.direccion;
        } catch (error) {
            alert(`Error al cargar datos del proveedor: ${error.message}`);
            return;
        }
    } else {
        document.getElementById('proveedorFormTitle').textContent = 'Agregar Proveedor';
    }

    formContainer.style.display = 'block';
}

function hideForm() {
    document.getElementById('proveedorFormContainer').style.display = 'none';
    document.getElementById('proveedorForm').reset();
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('proveedorId').value;
    const data = {
        nombre: document.getElementById('proveedorNombre').value,
        cuit: document.getElementById('proveedorCuit').value,
        email: document.getElementById('proveedorEmail').value,
        telefono: document.getElementById('proveedorTelefono').value,
        direccion: document.getElementById('proveedorDireccion').value,
    };

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `proveedores/${id}` : 'proveedores';

    try {
        await fetchData(endpoint, { method, body: JSON.stringify(data) });
        alert(`Proveedor ${id ? 'actualizado' : 'creado'} con éxito.`);
        hideForm();
        await loadProveedores();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteProveedor(id, name) {
    if (confirm(`¿Estás seguro de que quieres eliminar al proveedor "${name}"?`)) {
        try {
            await fetchData(`proveedores/${id}`, { method: 'DELETE' });
            alert('Proveedor eliminado con éxito.');
            await loadProveedores();
        } catch (error) {
            alert(`Error al eliminar proveedor: ${error.message}`);
        }
    }
}