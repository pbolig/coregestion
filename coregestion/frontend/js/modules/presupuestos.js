// frontend/js/modules/presupuestos.js
import { fetchData } from '../api.js';

let insumosCache = [];
let clientesCache = [];
let currentPresupuestoData = {};
let insumoLineCounter = 0;

const moduleHTML = `
    <div id="notification-area-presupuestos" class="notification-area"></div>
    <h2>Gestión de Presupuestos</h2>
    <div id="presupuestoFormContainer" class="form-container" style="display:none;">
        <h3 id="presupuestoFormTitle">Nuevo Presupuesto</h3>
        <form id="presupuestoForm" style="width:100%; display:contents;">
            <input type="hidden" id="presupuestoId">
            <div class="form-group"><label for="presupuestoCliente">Cliente</label><select id="presupuestoCliente" required></select></div>
            <div class="form-group"><label for="presupuestoFecha">Fecha</label><input type="date" id="presupuestoFecha" required></div>
            <div class="form-group"><label for="presupuestoEstado">Estado</label><select id="presupuestoEstado" required></select></div>
            <h4>Insumos del Presupuesto</h4>
            <div id="insumosListContainer" class="item-list-container"></div>
            <div class="form-actions" style="justify-content: flex-start;"><button type="button" id="addInsumoLineBtn" class="btn btn-secondary btn-sm">Añadir Insumo</button></div>
            <div class="form-group" style="flex-basis: 100%; text-align: right;"><label for="presupuestoTotal">Total Presupuesto</label><input type="text" id="presupuestoTotal" readonly style="font-size: 1.5rem; font-weight: bold; text-align: right; background-color: #f0f0f0; border: none;"></div>
            <div class="form-actions" style="width: 100%; border-top: 1px solid var(--color-border); padding-top: 1.5rem; margin-top: 1rem;"><button type="submit" class="btn btn-primary">Guardar Presupuesto</button><button type="button" id="cancelBtn" class="btn btn-secondary">Cancelar</button></div>
        </form>
    </div>
    <div class="table-container">
        <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>Listado de Presupuestos</h3>
            <button id="showFormBtn" class="btn btn-success">Crear Presupuesto</button>
        </div>
        <table>
            <thead><tr><th>ID</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th><th style="width: 280px;">Acciones</th></tr></thead>
            <tbody id="presupuestosTableBody"></tbody>
        </table>
    </div>
    <div id="stockConflictModal" class="modal-overlay" style="display:none;"><div class="modal-content"><h3 id="conflictModalTitle">Conflicto de Stock</h3><p id="conflictModalMessage"></p><div class="form-actions" style="justify-content: center; margin-top: 1.5rem;"><button id="useAvailableBtn" class="btn btn-success">Usar Disponibles y Aprobar</button><button id="createPendingBtn" class="btn btn-warning">Crear como Pendiente</button><button id="cancelConflictBtn" class="btn btn-secondary">Cancelar</button></div></div></div>
    <div id="viewDetailsModal" class="modal-overlay" style="display:none;"><div class="modal-content"><button id="closeDetailsModalBtn" class="modal-close-btn">&times;</button><h3>Detalle de Presupuesto</h3><div id="detailsModalBody"></div></div></div>
    <div id="facturacionModal" class="modal-overlay" style="display:none;"><div class="modal-content"><button id="closeFacturacionModalBtn" class="modal-close-btn">&times;</button><h3>Generar Factura desde Presupuesto</h3><form id="facturacionForm"><div id="facturacionResumen" style="text-align: left; background-color: #f8f9fa; padding: 1rem; border-radius: var(--border-radius-md); margin-bottom: 1.5rem;"></div><h4>Gastos Adicionales (Opcional)</h4><div id="gastosAdicionalesContainer" class="item-list-container"></div><div class="form-actions" style="justify-content: flex-start; margin-bottom: 1rem;"><button type="button" id="addGastoBtn" class="btn btn-secondary btn-sm">Añadir Gasto</button></div><div class="form-group" style="text-align: right; border-top: 2px solid var(--color-primary); padding-top: 1rem;"><label for="facturaTotalFinal" style="font-size: 1.2rem; font-weight: bold;">Total Final Factura</label><input type="text" id="facturaTotalFinal" readonly style="font-size: 1.8rem; font-weight: bold; text-align: right; background: none; border: none; color: var(--color-primary-dark);"></div><div class="form-actions" style="margin-top: 1.5rem;"><button type="submit" class="btn btn-primary">Emitir Factura y Enviar por Email</button></div></form></div></div>
    <style>
        .notification-area { padding: 1rem; margin-bottom: 1rem; border-radius: var(--border-radius-md); display: none; text-align: center; font-weight: bold; }
        .notification-area.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .notification-area.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background-color: white; padding: 2rem; border-radius: var(--border-radius-md); width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; position: relative; }
        .modal-close-btn { position: absolute; top: 1rem; right: 1rem; font-size: 1.5rem; background: none; border: none; cursor: pointer; }
        .stock-ready-indicator { cursor: help; color: var(--color-success); font-weight: bold; margin-left: 8px; }
        .recurrente-indicator { font-size: 1.2rem; color: var(--color-primary); margin-left: 0.5rem; font-weight: bold; cursor: help; }
    </style>
`;

export async function render(container, params = {}) {
    container.innerHTML = moduleHTML;
    await initializeModule(params);
}

async function initializeModule(params) {
    setupEventListeners();
    try {
        [insumosCache, clientesCache] = await Promise.all([fetchData('insumos'), fetchData('clientes')]);
        await loadPresupuestos();
        
        if (params.editId) {
            await showForm(params.editId);
        }
    } catch (error) {
        showNotification(`Error al cargar datos iniciales: ${error.message}`, 'error');
    }
}

function setupEventListeners() {
    document.getElementById('showFormBtn').addEventListener('click', () => showForm());
    document.getElementById('cancelBtn').addEventListener('click', hideForm);
    document.getElementById('presupuestoForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('addInsumoLineBtn').addEventListener('click', () => addInsumoLine());
    document.getElementById('presupuestosTableBody').addEventListener('click', handleTableActions);
    document.getElementById('cancelConflictBtn').addEventListener('click', () => document.getElementById('stockConflictModal').style.display = 'none');
    document.getElementById('closeDetailsModalBtn').addEventListener('click', () => document.getElementById('viewDetailsModal').style.display = 'none');
    document.getElementById('closeFacturacionModalBtn')?.addEventListener('click', () => document.getElementById('facturacionModal').style.display = 'none');
    document.getElementById('addGastoBtn')?.addEventListener('click', addGastoLine);
    document.getElementById('facturacionForm')?.addEventListener('submit', handleFacturacionSubmit);
}

async function showForm(editId = null, prefillData = null) {
    hideForm();
    const formContainer = document.getElementById('presupuestoFormContainer');
    const form = document.getElementById('presupuestoForm');
    document.getElementById('presupuestoFecha').valueAsDate = new Date();
    
    formContainer.style.display = 'block';
    await populateSelects(prefillData);

    if (editId) {
        document.getElementById('presupuestoFormTitle').textContent = 'Editar Presupuesto';
        try {
            const data = await fetchData(`presupuestos/${editId}`);
            document.getElementById('presupuestoId').value = data.id;
            document.getElementById('presupuestoCliente').value = data.cliente_id;
            document.getElementById('presupuestoFecha').value = data.fecha.split('T')[0];
            document.getElementById('presupuestoEstado').value = data.estado;
            const insumosContainer = document.getElementById('insumosListContainer');
            insumosContainer.innerHTML = '';
            if (data.insumos && data.insumos.length > 0) {
                data.insumos.forEach(insumo => addInsumoLine(insumo));
            } else { addInsumoLine(); }
        } catch(error) {
             showNotification(`Error al cargar el presupuesto: ${error.message}`, 'error');
             return;
        }
    } else {
        document.getElementById('presupuestoFormTitle').textContent = 'Crear Nuevo Presupuesto';
        addInsumoLine();
        if (prefillData) {
            form.dataset.solicitudOrigenId = prefillData.solicitud_origen_id;
            showNotification(`Creando presupuesto. Necesidad: "${prefillData.descripcion}"`, 'info');
        }
    }
    calculateTotal();
}

async function populateSelects(prefillData = null) {
    const clienteSelect = document.getElementById('presupuestoCliente');
    clienteSelect.innerHTML = '<option value="">-- Cliente --</option>';
    if (clientesCache.length === 0) {
        try {
            clientesCache = await fetchData('clientes');
        } catch (error) {
            showNotification('No se pudieron cargar los clientes.', 'error');
        }
    }
    clientesCache.forEach(c => {
        const option = new Option(c.nombre, c.id);
        if (prefillData && c.id == prefillData.clienteId) {
            option.selected = true;
        }
        clienteSelect.add(option);
    });

    const estadoSelect = document.getElementById('presupuestoEstado');
    const estados = ['En Espera de Cotización', 'Aprobado por Cliente', 'Rechazado', 'En Ejecución', 'Facturado', 'Fac. Fiscal', 'Pendiente de Insumos', 'Cancelado'];
    estadoSelect.innerHTML = '';
    estados.forEach(e => estadoSelect.add(new Option(e, e)));
}

async function loadPresupuestos() {
    const tableBody = document.getElementById('presupuestosTableBody');
    tableBody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    try {
        const presupuestos = await fetchData('presupuestos');
        tableBody.innerHTML = '';
        presupuestos.forEach(p => {
            const row = tableBody.insertRow();
            row.dataset.presupuestoId = p.id;
            let estadoHtml = p.estado;
            if (p.estado === 'Pendiente de Insumos') { checkAndMarkReady(p.id); }
            // --- CELDAS CON ALINEACIÓN APLICADA ---
            row.innerHTML = `
                <td class="text-right">${p.id}</td>
                <td class="text-left">${p.cliente_nombre || 'N/A'}</td>
                <td class="text-left">${new Date(p.fecha).toLocaleDateString('es-AR')}</td>
                <td class="text-right">$${p.total.toFixed(2)}</td>
                <td data-estado-cell class="text-left">${estadoHtml}</td>
                <td class="actions-cell">${generateActionButtons(p)}</td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    }
}

function generateActionButtons(presupuesto) {
    let buttons = `<button class="btn btn-sm btn-info view-btn">Ver</button>`;
    if (['Facturado', 'Fac. Fiscal'].includes(presupuesto.estado)) {
        buttons += `<button class="btn btn-sm btn-secondary view-pdf-btn" title="Descargar PDF de Factura/Remito">🖨️ PDF</button>`;
    }
    if (!['Facturado', 'Fac. Fiscal', 'Rechazado', 'Cancelado'].includes(presupuesto.estado)) {
        buttons += `<button class="btn btn-sm btn-warning edit-btn">Editar</button>`;
    }
    switch (presupuesto.estado) {
        case 'En Espera de Cotización': case 'Pendiente de Insumos':
            buttons += `<button class="btn btn-sm btn-success action-btn" data-action="Aprobado por Cliente">Aprobar</button>`; break;
        case 'Aprobado por Cliente':
            buttons += `<button class="btn btn-sm btn-primary action-btn" data-action="En Ejecución">Ejecutar</button>`; break;
        case 'En Ejecución':
            buttons += `<button class="btn btn-sm btn-info action-btn" data-action="Facturar">Facturar (Interno)</button>`; break;
        case 'Facturado':
            buttons += `<button class="btn btn-sm btn-success action-btn" data-action="Emitir Fiscal">Emitir Fact. Fiscal</button>`; break;
    }
    if (!['Facturado', 'Fac. Fiscal', 'Rechazado', 'Cancelado'].includes(presupuesto.estado)) {
        buttons += `<button class="btn btn-sm btn-danger action-btn" data-action="Rechazado">Rechazar</button>`;
    }
    return buttons;
}

async function checkAndMarkReady(presupuestoId) {
    try {
        const budgetDetails = await fetchData(`presupuestos/${presupuestoId}`);
        const allInsumosSufficient = budgetDetails.insumos.every(item => {
            const cachedInsumo = insumosCache.find(i => i.id == item.insumo_id);
            return cachedInsumo && cachedInsumo.stock >= item.cantidad;
        });
        if (allInsumosSufficient) {
            const row = document.querySelector(`tr[data-presupuesto-id='${presupuestoId}']`);
            if (row) {
                const estadoCell = row.querySelector('[data-estado-cell]');
                if (estadoCell) estadoCell.innerHTML += `<span class="stock-ready-indicator" title="Stock disponible para aprobar">✔️</span>`;
            }
        }
    } catch (error) {
        console.warn(`No se pudo verificar el estado de stock para el presupuesto pendiente #${presupuestoId}`, error);
    }
}

function handleTableActions(event) {
    const target = event.target.closest('button');
    if (!target) return;
    const presupuestoId = target.closest('tr')?.dataset.presupuestoId;
    if (!presupuestoId) return;

    if (target.classList.contains('edit-btn')) {
        showForm(presupuestoId);
    } else if (target.classList.contains('action-btn')) {
        const action = target.dataset.action;
        if (action === 'Facturar') {
            showFacturacionModal(presupuestoId);
        } else if (action === 'Emitir Fiscal') {
            emitirFacturaFiscal(presupuestoId);
        } else {
            changePresupuestoStatus(presupuestoId, action);
        }
    } else if (target.classList.contains('view-btn')) {
        showPresupuestoDetails(presupuestoId);
    } else if (target.classList.contains('view-pdf-btn')) {
        downloadInvoicePDF(presupuestoId);
    }
}

/**
 * NUEVA FUNCIÓN: Llama a la API para asignar un número fiscal a una factura.
 * @param {string} presupuestoId El ID del presupuesto asociado a la factura.
 */
async function emitirFacturaFiscal(presupuestoId) {
    if (!confirm(`¿Estás seguro de que quieres emitir la FACTURA FISCAL para el presupuesto #${presupuestoId}? Esta acción es definitiva y cambiará el estado a "Fac. Fiscal".`)) {
        return;
    }
    showNotification('Emitiendo factura fiscal...', 'info');
    try {
        const result = await fetchData(`facturacion/presupuesto/${presupuestoId}/emitir-fiscal`, { method: 'POST' });
        showNotification(result.message, 'success');
        await loadPresupuestos(); // Recargar la tabla para ver el nuevo estado
    } catch (error) {
        showNotification(`Error al emitir la factura fiscal: ${error.message}`, 'error');
    }
}

async function changePresupuestoStatus(id, nuevoEstado) {
    if (confirm(`¿Estás seguro de que quieres cambiar el estado a "${nuevoEstado}"?`)) {
        try {
            const result = await fetchData(`presupuestos/${id}/estado`, { method: 'PUT', body: JSON.stringify({ nuevo_estado: nuevoEstado }) });
            showNotification(result.message);
            await loadPresupuestos();
        } catch (error) {
            showNotification(`Error al cambiar estado: ${error.message}`, 'error');
        }
    }
}

async function showPresupuestoDetails(presupuestoId) {
    const modal = document.getElementById('viewDetailsModal');
    const modalBody = document.getElementById('detailsModalBody');
    modalBody.innerHTML = '<p>Cargando detalles...</p>';
    modal.style.display = 'flex';
    try {
        const p = await fetchData(`presupuestos/${presupuestoId}`);
        let detailsHtml = `<div style="text-align: left; margin-bottom: 1.5rem;"><p><strong>Cliente:</strong> ${p.cliente_nombre}</p><p><strong>Fecha:</strong> ${new Date(p.fecha).toLocaleDateString('es-AR')}</p><p><strong>Estado:</strong> ${p.estado}</p><p><strong>Total:</strong> $${p.total.toFixed(2)}</p></div><h4>Insumos Incluidos</h4><div class="table-container"><table><thead><tr><th>Insumo</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead><tbody>`;
        p.insumos.forEach(item => {
            const subtotal = item.cantidad * item.precio_unitario;
            detailsHtml += `<tr><td>${item.nombre}</td><td style="text-align: right;">${item.cantidad}</td><td style="text-align: right;">$${item.precio_unitario.toFixed(2)}</td><td style="text-align: right;">$${subtotal.toFixed(2)}</td></tr>`;
        });
        detailsHtml += `</tbody></table></div>`;
        modalBody.innerHTML = detailsHtml;
    } catch (error) {
        modalBody.innerHTML = `<p class="error-message">Error al cargar el detalle: ${error.message}</p>`;
    }
}

function hideForm() {
    document.getElementById('presupuestoFormContainer').style.display = 'none';
    document.getElementById('presupuestoForm').reset();
    document.getElementById('insumosListContainer').innerHTML = '';
}

function addInsumoLine(insumoData = null) {
    insumoLineCounter++;
    const container = document.getElementById('insumosListContainer');
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    // --- CORRECCIÓN: Se añaden IDs y Names únicos ---
    itemRow.innerHTML = `
        <select class="insumo-select" id="insumo-select-${insumoLineCounter}" name="insumo_id" required></select>
        <span class="recurrente-indicator" title="Este es un servicio recurrente (abono)."></span>
        <input type="number" class="insumo-cantidad" id="insumo-cantidad-${insumoLineCounter}" name="cantidad" placeholder="Cant." min="1" value="${insumoData ? insumoData.cantidad : 1}" required>
        <button type="button" class="btn btn-danger btn-sm remove-item-btn">X</button>
    `;
    container.appendChild(itemRow);
    const newSelect = itemRow.querySelector('.insumo-select');
    newSelect.innerHTML = '<option value="">-- Seleccione un insumo --</option>';
    insumosCache.forEach(insumo => {
        const optionText = insumo.es_recurrente ? `🔄 ${insumo.nombre} (Abono)` : `${insumo.nombre} (Stock: ${insumo.stock})`;
        newSelect.add(new Option(optionText, insumo.id));
    });
    if (insumoData) newSelect.value = insumoData.insumo_id;
    updateRecurrenteIndicator(newSelect);
    newSelect.addEventListener('change', () => {
        calculateTotal();
        updateRecurrenteIndicator(newSelect);
    });
    itemRow.querySelector('.insumo-cantidad').addEventListener('input', calculateTotal);
    itemRow.querySelector('.remove-item-btn').addEventListener('click', (e) => {
        if (container.children.length > 1) {
            e.target.closest('.item-row').remove();
            calculateTotal();
        } else {
            showNotification('Debe haber al menos un insumo.', 'error');
        }
    });
}

function updateRecurrenteIndicator(selectElement) {
    const selectedId = selectElement.value;
    const insumo = insumosCache.find(i => i.id == selectedId);
    const indicatorSpan = selectElement.nextElementSibling;
    if (indicatorSpan) indicatorSpan.textContent = (insumo && insumo.es_recurrente === 1) ? '🔄' : '';
}

function calculateTotal() {
    let total = 0;
    document.querySelectorAll('#insumosListContainer .item-row').forEach(row => {
        const id = row.querySelector('.insumo-select').value;
        const cantidad = parseFloat(row.querySelector('.insumo-cantidad').value);
        const insumo = insumosCache.find(i => i.id == id);
        if (insumo && cantidad > 0) total += insumo.precio_unitario * cantidad;
    });
    document.getElementById('presupuestoTotal').value = `$${total.toFixed(2)}`;
}

async function downloadInvoicePDF(presupuestoId) {
    showNotification('Generando PDF para descarga...', 'info');
    try {
        const pdfBlob = await fetchData(`facturacion/presupuesto/${presupuestoId}/pdf`);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `Factura-Presupuesto-${presupuestoId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pdfUrl);
    } catch (error) {
        showNotification(`Error al generar el PDF: ${error.message}`, 'error');
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const presupuestoData = getFormData();
    if (!presupuestoData) return;
    try {
        await attemptToSavePresupuesto(presupuestoData);
    } catch (error) {
        if (error.status === 409 && error.detalles) {
            handleStockConflict(error.detalles, presupuestoData);
        } else {
            showNotification(`Error al guardar: ${error.message}`, 'error');
        }
    }
}

async function attemptToSavePresupuesto(presupuestoData, useStock = false) {
    const id = presupuestoData.id;
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `presupuestos/${id}` : 'presupuestos';
    const dataToSend = { ...presupuestoData, usarStockDisponible: useStock };
    try {
        const result = await fetchData(endpoint, { method, body: JSON.stringify(dataToSend) });
        showNotification(result.message || `Presupuesto ${id ? 'actualizado' : 'creado'} con éxito.`);
        hideForm();
        await loadPresupuestos();
    } catch (error) {
        throw error;
    }
}

function handleStockConflict(detalles, presupuestoData) {
    const modal = document.getElementById('stockConflictModal');
    document.getElementById('conflictModalTitle').textContent = `Conflicto de Stock para "${detalles.insumoNombre}"`;
    document.getElementById('conflictModalMessage').innerHTML = `Se solicitaron <strong>${detalles.solicitado}</strong> unidades, pero solo hay <strong>${detalles.disponible}</strong> disponibles.<br>¿Qué deseas hacer?`;
    const useAvailableBtn = document.getElementById('useAvailableBtn').cloneNode(true);
    const createPendingBtn = document.getElementById('createPendingBtn').cloneNode(true);
    document.getElementById('useAvailableBtn').parentNode.replaceChild(useAvailableBtn, document.getElementById('useAvailableBtn'));
    document.getElementById('createPendingBtn').parentNode.replaceChild(createPendingBtn, document.getElementById('createPendingBtn'));
    useAvailableBtn.onclick = async () => {
        modal.style.display = 'none';
        try {
            await attemptToSavePresupuesto(presupuestoData, true);
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    };
    createPendingBtn.onclick = async () => {
        modal.style.display = 'none';
        const pendingData = { ...presupuestoData, estado: 'Pendiente de Insumos' };
        try {
            await attemptToSavePresupuesto(pendingData);
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    };
    modal.style.display = 'flex';
}

/**
 * Recopila los datos del formulario para enviarlos a la API.
 */
function getFormData() {
    const id = document.getElementById('presupuestoId').value;
    const insumos = [];
    let isValid = true;
    document.querySelectorAll('#insumosListContainer .item-row').forEach(row => {
        const insumoId = row.querySelector('.insumo-select').value;
        const cantidad = parseInt(row.querySelector('.insumo-cantidad').value);
        if (!insumoId || isNaN(cantidad) || cantidad <= 0) isValid = false;
        insumos.push({ insumo_id: insumoId, cantidad });
    });
    if (!isValid) {
        showNotification('Verifique que todas las líneas de insumos tengan un producto y una cantidad válida.', 'error');
        return null;
    }
    
    // --- LÓGICA MEJORADA ---
    // Obtenemos el ID de la solicitud de origen si existe
    const form = document.getElementById('presupuestoForm');
    const solicitud_origen_id = form.dataset.solicitudOrigenId || null;

    return {
        id: id || null,
        cliente_id: document.getElementById('presupuestoCliente').value,
        fecha: document.getElementById('presupuestoFecha').value,
        estado: document.getElementById('presupuestoEstado').value,
        insumos: insumos,
        solicitud_origen_id: solicitud_origen_id // Lo añadimos a los datos
    };
}

async function deletePresupuesto(id) {
    if (confirm(`¿Seguro que quieres eliminar el presupuesto ID ${id}?`)) {
        try {
            const result = await fetchData(`presupuestos/${id}`, { method: 'DELETE' });
            showNotification(result.message);
            await loadPresupuestos();
        } catch (error) {
            showNotification(`Error al eliminar: ${error.message}`, 'error');
        }
    }
}

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area-presupuestos');
    if (!notificationArea) return;
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.style.display = 'block';
    setTimeout(() => {
        notificationArea.style.display = 'none';
    }, 4000);
}

async function showFacturacionModal(presupuestoId) {
    const modal = document.getElementById('facturacionModal');
    const resumenDiv = document.getElementById('facturacionResumen');
    const gastosContainer = document.getElementById('gastosAdicionalesContainer');
    resumenDiv.innerHTML = '<p>Cargando datos del presupuesto...</p>';
    gastosContainer.innerHTML = '';
    try {
        currentPresupuestoData = await fetchData(`presupuestos/${presupuestoId}`);
        resumenDiv.innerHTML = `<p><strong>Cliente:</strong> ${currentPresupuestoData.cliente_nombre}</p><p><strong>Subtotal (Insumos/Servicios):</strong> $${currentPresupuestoData.total.toFixed(2)}</p>`;
        updateFacturaTotal();
        modal.style.display = 'flex';
    } catch (error) {
        showNotification(`Error al cargar presupuesto para facturar: ${error.message}`, 'error');
    }
}

function addGastoLine() {
    const container = document.getElementById('gastosAdicionalesContainer');
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.style.padding = '0.5rem';
    itemRow.innerHTML = `<input type="text" class="gasto-concepto" placeholder="Concepto (ej: Flete)" style="flex: 2;" required><input type="number" class="gasto-monto" placeholder="Monto" min="0" step="0.01" style="flex: 1; text-align: right;" required><button type="button" class="btn btn-danger btn-sm remove-item-btn">X</button>`;
    itemRow.querySelector('.gasto-monto').addEventListener('input', updateFacturaTotal);
    itemRow.querySelector('.remove-item-btn').addEventListener('click', () => {
        itemRow.remove();
        updateFacturaTotal();
    });
    container.appendChild(itemRow);
}

function updateFacturaTotal() {
    let gastosTotal = 0;
    document.querySelectorAll('.gasto-monto').forEach(input => {
        gastosTotal += parseFloat(input.value) || 0;
    });
    const granTotal = (currentPresupuestoData.total || 0) + gastosTotal;
    document.getElementById('facturaTotalFinal').value = `$${granTotal.toFixed(2)}`;
}

async function handleFacturacionSubmit(e) {
    e.preventDefault();
    const gastosAdicionales = [];
    document.querySelectorAll('#gastosAdicionalesContainer .item-row').forEach(row => {
        const concepto = row.querySelector('.gasto-concepto').value;
        const monto = parseFloat(row.querySelector('.gasto-monto').value);
        if (concepto && monto > 0) {
            gastosAdicionales.push({ concepto, monto });
        }
    });
    const facturacionData = {
        presupuesto_id: currentPresupuestoData.id,
        gastosAdicionales: gastosAdicionales
    };
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Procesando...';
    try {
        const result = await fetchData('facturacion', {
            method: 'POST',
            body: JSON.stringify(facturacionData)
        });
        showNotification(result.message);
        document.getElementById('facturacionModal').style.display = 'none';
        await loadPresupuestos();
    } catch (error) {
        showNotification(`Error al emitir factura: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Emitir Factura y Enviar por Email';
    }
}