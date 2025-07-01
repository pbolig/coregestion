// frontend/js/modules/compras.js
import { fetchData } from '../api.js';

let insumosCache = [];
let proveedoresCache = [];

/**
 * Función principal que renderiza la vista de Compras.
 * @param {HTMLElement} container - El elemento del DOM donde se renderizará.
 */
export async function render(container) {
    container.innerHTML = `
        <h2>Gestión de Compras</h2>

        <!-- Formulario para Registrar Nueva Compra -->
        <div id="compraFormContainer" class="form-container" style="display:none;">
            <h3 id="compraFormTitle">Registrar Nueva Compra</h3>
            <form id="compraForm" style="width:100%; display:contents;">
                <div class="form-group"><label for="compraFecha">Fecha Comprobante</label><input type="date" id="compraFecha" required></div>
                <div class="form-group"><label for="compraProveedor">Proveedor</label><select id="compraProveedor" required></select></div>
                <div class="form-group"><label for="compraDescuento">Descuento (%)</label><input type="number" id="compraDescuento" min="0" max="100" value="0"></div>
                
                <h4>Insumos Adquiridos</h4>
                <div id="compraItemsContainer" class="item-list-container"></div>
                <div class="form-actions" style="justify-content: flex-start;">
                    <button type="button" id="addCompraItemBtn" class="btn btn-secondary btn-sm">Añadir Insumo</button>
                </div>

                <div class="form-actions" style="width: 100%; border-top: 1px solid var(--color-border); padding-top: 1.5rem; margin-top: 1rem;">
                    <button type="submit" class="btn btn-primary">Guardar Compra</button>
                    <button type="button" id="cancelCompraBtn" class="btn btn-secondary">Cancelar</button>
                </div>
            </form>
        </div>

        <!-- Tabla de Historial de Compras -->
        <div class="table-container">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Historial de Compras</h3>
                <button id="showCompraFormBtn" class="btn btn-success">Registrar Nueva Compra</button>
            </div>
            <table>
                <thead>
                    <tr><th>ID</th><th>Fecha</th><th>Proveedor</th><th>Total</th><th style="width: 150px;">Acciones</th></tr>
                </thead>
                <tbody id="comprasTableBody"></tbody>
            </table>
        </div>

        <!-- Modal para Ver Detalle de Compra (oculto por defecto) -->
        <div id="detailsModal" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <button id="closeModalBtn" class="modal-close-btn">&times;</button>
                <h3>Detalle de Compra</h3>
                <div id="modalBody">Cargando detalles...</div>
            </div>
        </div>
        <style>
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
            .modal-content { background-color: white; padding: 2rem; border-radius: var(--border-radius-md); width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; position: relative; }
            .modal-close-btn { position: absolute; top: 1rem; right: 1rem; font-size: 1.5rem; background: none; border: none; cursor: pointer; }
        </style>
    `;

    await initializeModule();
}

async function initializeModule() {
    setupEventListeners();
    try {
        [insumosCache, proveedoresCache] = await Promise.all([
            fetchData('insumos'),
            fetchData('proveedores')
        ]);
        await loadCompras();
    } catch (error) {
        console.error("Error inicializando el módulo de compras:", error);
        document.getElementById('comprasTableBody').innerHTML = `<tr><td colspan="5">Error al cargar datos. ${error.message}</td></tr>`;
    }
}

function setupEventListeners() {
    document.getElementById('showCompraFormBtn').addEventListener('click', () => showForm());
    document.getElementById('cancelCompraBtn').addEventListener('click', hideForm);
    document.getElementById('compraForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('addCompraItemBtn').addEventListener('click', addCompraItem);
    
    // Listeners para el modal
    document.getElementById('closeModalBtn').addEventListener('click', () => document.getElementById('detailsModal').style.display = 'none');
    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') { // Cierra si se hace clic en el fondo
            document.getElementById('detailsModal').style.display = 'none';
        }
    });

    // Delegación de eventos para el botón "Ver Detalle"
    document.getElementById('comprasTableBody').addEventListener('click', (e) => {
        if (e.target.classList.contains('view-btn')) {
            showPurchaseDetails(e.target.dataset.id);
        }
    });
}

async function loadCompras() {
    const tableBody = document.getElementById('comprasTableBody');
    tableBody.innerHTML = '<tr><td colspan="5">Cargando historial de compras...</td></tr>';
    try {
        const compras = await fetchData('compras');
        tableBody.innerHTML = '';
        compras.forEach(compra => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${compra.id}</td>
                <td>${new Date(compra.fecha_comprobante).toLocaleDateString('es-AR')}</td>
                <td>${compra.proveedor_nombre}</td>
                <td>$${compra.total_compra.toFixed(2)}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-info view-btn" data-id="${compra.id}">Ver Detalle</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5">Error al cargar compras: ${error.message}</td></tr>`;
    }
}

function showForm() {
    hideForm();
    const formContainer = document.getElementById('compraFormContainer');
    document.getElementById('compraFecha').valueAsDate = new Date();
    const proveedorSelect = document.getElementById('compraProveedor');
    proveedorSelect.innerHTML = '<option value="">-- Seleccionar --</option>';
    proveedoresCache.forEach(p => proveedorSelect.add(new Option(p.nombre, p.id)));
    addCompraItem();
    formContainer.style.display = 'block';
}

function hideForm() {
    document.getElementById('compraFormContainer').style.display = 'none';
    document.getElementById('compraForm').reset();
    document.getElementById('compraItemsContainer').innerHTML = '';
}

function addCompraItem() {
    const container = document.getElementById('compraItemsContainer');
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    const select = document.createElement('select');
    select.innerHTML = '<option value="">-- Seleccionar Insumo --</option>';
    insumosCache.forEach(i => select.add(new Option(`${i.nombre} (Stock: ${i.stock})`, i.id)));
    itemRow.innerHTML = `
        <input type="number" placeholder="Cantidad" class="compra-quantity" min="1" required>
        <input type="number" placeholder="Precio Unitario" class="compra-price" min="0" step="0.01" required>
        <button type="button" class="btn btn-danger btn-sm remove-item-btn">X</button>
    `;
    itemRow.prepend(select);
    itemRow.querySelector('.remove-item-btn').addEventListener('click', () => {
        if (container.children.length > 1) itemRow.remove();
        else alert('Debe haber al menos un insumo en la compra.');
    });
    container.appendChild(itemRow);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('#compraItemsContainer .item-row').forEach(row => {
        const insumoId = row.querySelector('select').value;
        const cantidad = parseFloat(row.querySelector('.compra-quantity').value);
        const precio = parseFloat(row.querySelector('.compra-price').value);
        if (insumoId && cantidad > 0 && precio >= 0) {
            items.push({
                insumo_id: insumoId,
                cantidad: cantidad,
                precio_unitario_compra: precio,
            });
        }
    });
    if (items.length === 0) {
        alert("Por favor, agregue y complete al menos una línea de insumo.");
        return;
    }
    const compraData = {
        fecha_comprobante: document.getElementById('compraFecha').value,
        proveedor_id: document.getElementById('compraProveedor').value,
        porcentaje_descuento: parseFloat(document.getElementById('compraDescuento').value || 0),
        insumos_adquiridos: items
    };
    try {
        await fetchData('compras', { method: 'POST', body: JSON.stringify(compraData) });
        alert('Compra registrada con éxito.');
        hideForm();
        await loadCompras();
    } catch (error) {
        alert(`Error al registrar la compra: ${error.message}`);
    }
}

/**
 * Muestra el detalle de una compra en un modal.
 * @param {string} compraId - El ID de la compra a detallar.
 */
async function showPurchaseDetails(compraId) {
    const modal = document.getElementById('detailsModal');
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = '<p>Cargando detalles...</p>';
    modal.style.display = 'flex';

    try {
        const compra = await fetchData(`compras/${compraId}`);
        let detailsHtml = `
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; margin-bottom: 1rem;">
                <p><strong>Proveedor:</strong> ${compra.proveedor_nombre}</p>
                <p><strong>Fecha:</strong> ${new Date(compra.fecha_comprobante).toLocaleDateString('es-AR')}</p>
                <p><strong>Total Compra:</strong> $${compra.total_compra.toFixed(2)}</p>
            </div>
            <h4>Insumos en esta Compra</h4>
            <div class="table-container">
                <table>
                    <thead><tr><th>Insumo</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
                    <tbody>
        `;
        compra.detalles.forEach(item => {
            const subtotal = item.cantidad * item.precio_unitario_compra;
            detailsHtml += `
                <tr>
                    <td>${item.insumo_nombre}</td>
                    <td>${item.cantidad} ${item.unidad}</td>
                    <td>$${item.precio_unitario_compra.toFixed(2)}</td>
                    <td>$${subtotal.toFixed(2)}</td>
                </tr>
            `;
        });
        detailsHtml += `
                    </tbody>
                </table>
            </div>
        `;
        modalBody.innerHTML = detailsHtml;
    } catch (error) {
        modalBody.innerHTML = `<p class="error-message">Error al cargar el detalle: ${error.message}</p>`;
    }
}