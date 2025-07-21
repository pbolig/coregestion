// frontend/js/modules/insumos.js
import { fetchData } from '../api.js';

let allInsumosCache = [];

export async function render(container) {
    container.innerHTML = `
        <div id="notification-area-insumos" class="notification-area"></div>
        <h2>Gestión de Insumos y Servicios</h2>

        <div id="masterFormContainer" class="form-container" style="display:none;">
             <h3 id="masterFormTitle">Crear Insumo/Servicio</h3>
             <form id="masterForm" style="width:100%; display:contents;">
                <input type="hidden" id="masterInsumoId">
                <div class="form-group"><label for="masterInsumoNombre">Nombre</label><input type="text" id="masterInsumoNombre" required></div>
                <div class="form-group"><label for="masterInsumoUnidad">Unidad</label><select id="masterInsumoUnidad" required><option value="unidad">Unidad</option><option value="servicio">Servicio</option><option value="kg">Kg</option><option value="m">Metro</option><option value="hora">Hora</option></select></div>
                <div class="form-group"><label for="masterInsumoPrecio">Precio Unitario</label><input type="number" id="masterInsumoPrecio" required min="0" step="0.01"></div>
                
                <!-- CORRECCIÓN: Se añade margen superior para separar el checkbox -->
                <div class="form-group" style="flex-basis: 100%; flex-direction: row; align-items: center; gap: 10px; margin-top: 1rem;">
                    <input type="checkbox" id="masterInsumoRecurrente" style="width: auto;">
                    <label for="masterInsumoRecurrente" style="margin-bottom: 0;">Es un servicio recurrente (Abono)</label>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Guardar</button>
                    <button type="button" id="cancelMasterBtn" class="btn btn-secondary">Cancelar</button>
                </div>
             </form>
        </div>

        <div class="table-container">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Listado de Stock y Datos Maestros</h3>
                <button id="showMasterFormBtn" class="btn btn-success">Crear Insumo/Servicio</button>
            </div>
            <table>
                <thead>
                    <tr><th>ID</th><th>Nombre</th><th>Es Recurrente</th><th>Stock</th><th>Unidad</th><th>Precio</th><th>Acciones</th></tr>
                </thead>
                <tbody id="insumosTableBody"></tbody>
            </table>
        </div>
        <style>
            .notification-area { padding: 1rem; margin-bottom: 1rem; border-radius: var(--border-radius-md); display: none; text-align: center; font-weight: bold; }
            .notification-area.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .notification-area.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        </style>
    `;
    await initializeModule();
}

async function initializeModule() {
    setupEventListeners();
    await loadInsumos();
}

function setupEventListeners() {
    document.getElementById('showMasterFormBtn').addEventListener('click', () => showForm());
    document.getElementById('cancelMasterBtn').addEventListener('click', hideForm);
    document.getElementById('masterForm').addEventListener('submit', handleMasterFormSubmit);
    document.getElementById('insumosTableBody').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.classList.contains('edit-btn')) showForm(target.dataset.id);
        if (target.classList.contains('delete-btn')) deleteInsumo(target.dataset.id, target.dataset.name);
    });
}

async function loadInsumos() {
    const tableBody = document.getElementById('insumosTableBody');
    tableBody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
    try {
        allInsumosCache = await fetchData('insumos');
        tableBody.innerHTML = '';
        allInsumosCache.forEach(insumo => {
            const row = tableBody.insertRow();
            // --- CELDAS CON ALINEACIÓN APLICADA ---
            row.innerHTML = `
                <td class="text-right">${insumo.id}</td>
                <td class="text-left">${insumo.nombre}</td>
                <td class="text-center">${insumo.es_recurrente ? '✔️ Sí' : 'No'}</td>
                <td class="text-right">${insumo.stock}</td>
                <td class="text-left">${insumo.unidad}</td>
                <td class="text-right">$${insumo.precio_unitario.toFixed(2)}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-warning edit-btn" data-id="${insumo.id}">Editar</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${insumo.id}" data-name="${insumo.nombre}">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
    }
}

async function showForm(editId = null) {
    hideForm();
    const formContainer = document.getElementById('masterFormContainer');
    if (editId) {
        const insumo = allInsumosCache.find(i => i.id == editId);
        if (!insumo) {
            showNotification('Insumo no encontrado.', 'error');
            return;
        }
        document.getElementById('masterFormTitle').textContent = 'Editar Insumo/Servicio';
        document.getElementById('masterInsumoId').value = insumo.id;
        document.getElementById('masterInsumoNombre').value = insumo.nombre;
        document.getElementById('masterInsumoUnidad').value = insumo.unidad;
        document.getElementById('masterInsumoPrecio').value = insumo.precio_unitario;
        document.getElementById('masterInsumoRecurrente').checked = insumo.es_recurrente === 1;
    } else {
        document.getElementById('masterFormTitle').textContent = 'Crear Insumo/Servicio';
    }
    formContainer.style.display = 'block';
}

function hideForm() {
    document.getElementById('masterFormContainer').style.display = 'none';
    document.getElementById('masterForm').reset();
}

async function handleMasterFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('masterInsumoId').value;
    const data = {
        nombre: document.getElementById('masterInsumoNombre').value,
        unidad: document.getElementById('masterInsumoUnidad').value,
        precio_unitario: parseFloat(document.getElementById('masterInsumoPrecio').value),
        es_recurrente: document.getElementById('masterInsumoRecurrente').checked ? 1 : 0,
    };
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `insumos/${id}` : 'insumos';
    try {
        await fetchData(endpoint, { method, body: JSON.stringify(data) });
        showNotification(`Insumo ${id ? 'actualizado' : 'creado'} con éxito.`);
        hideForm();
        await loadInsumos();
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function deleteInsumo(id, name) {
    if (confirm(`¿Estás seguro de que quieres eliminar "${name}"?`)) {
        try {
            await fetchData(`insumos/${id}`, { method: 'DELETE' });
            showNotification('Insumo eliminado exitosamente.');
            await loadInsumos();
        } catch (error) {
            showNotification(`Error al eliminar insumo: ${error.message}`, 'error');
        }
    }
}

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area-insumos');
    if (!notificationArea) return;
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.style.display = 'block';
    setTimeout(() => {
        notificationArea.style.display = 'none';
    }, 4000);
}