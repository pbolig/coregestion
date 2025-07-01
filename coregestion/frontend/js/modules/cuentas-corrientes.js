// frontend/js/modules/cuentascorrientes.js
import { fetchData } from '../api.js';

// --- Estado del Módulo ---
let clientesCache = [];
let conceptosCache = [];
let facturasPendientesCache = [];
let userRole = null;

// --- Plantilla HTML ---
const moduleHTML = `
    <div id="notification-area-cc" class="notification-area"></div>
    <h2>Gestión de Cuentas Corrientes</h2>
    
    <div class="form-container" style="margin-bottom: 2rem;">
        <div class="form-group" style="flex-grow: 3;">
            <label for="clientSelector">Seleccione un Cliente</label>
            <select id="clientSelector"></select>
        </div>
        <div id="saldoContainer" class="form-group" style="text-align: right;">
             <label>Saldo Total Real</label>
             <h3 id="saldoFinal" style="margin:0; font-size: 2rem;">$ 0.00</h3>
        </div>
    </div>
    
    <div id="resultsContainer" style="display: none;">
        <div class="table-container" style="margin-bottom: 2.5rem;">
             <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>Facturas con Saldo Pendiente</h3>
                <button id="showMovementModalBtn" class="btn btn-success">Registrar Pago</button>
            </div>
             <table>
                <thead><tr><th>Factura N°</th><th>Fecha</th><th>Total Factura</th><th>Saldo Pendiente</th></tr></thead>
                <tbody id="pendingInvoicesTableBody"></tbody>
            </table>
        </div>

        <div class="table-container">
             <h3>Historial Completo de Movimientos</h3>
             <table>
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Debe</th><th>Haber</th><th>Saldo Acumulado</th></tr></thead>
                <tbody id="movementsHistoryTableBody"></tbody>
            </table>
        </div>
    </div>

    <!-- Modal para Nuevo Movimiento -->
    <div id="movementModal" class="modal-overlay" style="display:none;">
        <div class="modal-content">
            <button id="closeMovementModalBtn" class="modal-close-btn">&times;</button>
            <h3>Registrar Movimiento en Cuenta Corriente</h3>
            <form id="newMovementForm">
                <div class="form-group">
                    <label for="movementConcepto">1. Seleccione el Concepto</label>
                    <select id="movementConcepto" required></select>
                </div>
                <div id="dynamicFieldsContainer"></div>
                <div class="form-actions" style="margin-top: 1rem;">
                    <button type="submit" class="btn btn-primary">Guardar Movimiento</button>
                </div>
            </form>
        </div>
    </div>
    <style>
        .notification-area { padding: 1rem; margin-bottom: 1rem; border-radius: var(--border-radius-md); display: none; text-align: center; font-weight: bold; }
        .notification-area.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .notification-area.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background-color: white; padding: 2rem; border-radius: var(--border-radius-md); width: 90%; max-width: 700px; max-height: 90vh; overflow-y: auto; position: relative; }
        .modal-close-btn { position: absolute; top: 1rem; right: 1rem; font-size: 1.5rem; background: none; border: none; cursor: pointer; }
    </style>
`;

export async function render(container) {
    userRole = JSON.parse(localStorage.getItem('user'))?.roles || [];
    container.innerHTML = moduleHTML;
    await initializeModule();
}

async function initializeModule() {
    setupEventListeners();
    try {
        [clientesCache, conceptosCache] = await Promise.all([
            fetchData('clientes'),
            fetchData('conceptos-cc')
        ]);
        populateClientSelector();
    } catch (error) { showNotification(`Error al cargar datos iniciales: ${error.message}`, 'error'); }
}

function setupEventListeners() {
    document.getElementById('clientSelector').addEventListener('change', handleClientSelection);
    document.getElementById('showMovementModalBtn')?.addEventListener('click', showMovementModal);
    document.getElementById('closeMovementModalBtn')?.addEventListener('click', hideMovementModal);
    document.getElementById('movementConcepto')?.addEventListener('change', handleConceptChange);
    document.getElementById('newMovementForm')?.addEventListener('submit', handleMovementSubmit);

    // NUEVO: Listener para la tabla de facturas pendientes
    document.getElementById('pendingInvoicesTableBody').addEventListener('click', (e) => {
        if (e.target.classList.contains('resend-btn')) {
            const facturaId = e.target.dataset.id;
            reenviarFactura(facturaId);
        }
    });
}

function populateClientSelector() {
    const selector = document.getElementById('clientSelector');
    selector.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
    clientesCache.forEach(client => selector.add(new Option(client.nombre, client.id)));
}

async function handleClientSelection(event) {
    const clientId = event.target.value;
    const resultsContainer = document.getElementById('resultsContainer');
    if (!clientId) {
        resultsContainer.style.display = 'none';
        renderBalance(0);
        return;
    }
    resultsContainer.style.display = 'block';
    await refreshClientData(clientId);
}

async function refreshClientData(clientId) {
    const pendingInvoicesTableBody = document.getElementById('pendingInvoicesTableBody');
    const movementsHistoryTableBody = document.getElementById('movementsHistoryTableBody');
    
    pendingInvoicesTableBody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    movementsHistoryTableBody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    renderBalance(null); // Pone el saldo en modo "cargando"

    try {
        // --- LÓGICA MEJORADA: Hacemos ambas llamadas en paralelo ---
        const [ccData, facturasData] = await Promise.all([
            fetchData(`cuentas-corrientes/cliente/${clientId}`),
            fetchData(`facturacion/cliente/${clientId}/pendientes`)
        ]);

        facturasPendientesCache = facturasData;
        
        // Renderizar ambas tablas
        renderPendingInvoices(facturasPendientesCache);
        renderMovementsHistory(ccData.movimientos);

        // El saldo final real viene del historial completo de la C/C.
        renderBalance(ccData.saldo_final);

    } catch (error) {
        pendingInvoicesTableBody.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
        movementsHistoryTableBody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
        renderBalance('Error');
    }
}

function renderPendingInvoices(invoices) {
    const tableBody = document.getElementById('pendingInvoicesTableBody');
    tableBody.innerHTML = '';
    if (invoices.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Este cliente no tiene facturas pendientes de pago.</td></tr>';
        return;
    }
    invoices.forEach(f => {
        const row = tableBody.insertRow();
        // Se añade una columna para Acciones
        row.innerHTML = `
            <td>#${f.id}</td>
            <td>${new Date(f.fecha_emision).toLocaleDateString('es-AR')}</td>
            <td>$${f.total_factura.toFixed(2)}</td>
            <td style="color:var(--color-danger); font-weight:bold;">$${f.saldo_pendiente.toFixed(2)}</td>
            <td class="actions-cell">
                <button class="btn btn-sm btn-secondary resend-btn" data-id="${f.id}" title="Reenviar Factura por Email">Reenviar</button>
            </td>
        `;
    });
}

/**
 * NUEVA FUNCIÓN: Llama a la API para reenviar una factura por correo.
 * @param {string} facturaId - El ID de la factura a reenviar.
 */
async function reenviarFactura(facturaId) {
    if (!confirm(`¿Estás seguro de que quieres reenviar la factura #${facturaId} por email al cliente?`)) {
        return;
    }
    
    showNotification('Reenviando factura...', 'info');

    try {
        const result = await fetchData(`facturacion/${facturaId}/reenviar`, { method: 'POST' });
        showNotification(result.message, 'success');
    } catch (error) {
        showNotification(`Error al reenviar la factura: ${error.message}`, 'error');
    }
}

/**
 * FUNCIÓN para renderizar el historial completo de movimientos.
 * @param {Array} movements - La lista completa de movimientos de la cuenta corriente.
 */
function renderMovementsHistory(movements) {
    const tableBody = document.getElementById('movementsHistoryTableBody');
    tableBody.innerHTML = '';
    if (movements.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No hay movimientos registrados para este cliente.</td></tr>';
        return;
    }
    movements.forEach(mov => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${new Date(mov.fecha).toLocaleDateString('es-AR')}</td>
            <td>${mov.concepto_nombre}</td>
            <td style="color: var(--color-danger); text-align: right;">${mov.tipo === 'DEBE' ? `$ ${mov.monto.toFixed(2)}` : ''}</td>
            <td style="color: var(--color-success); text-align: right;">${mov.tipo === 'HABER' ? `$ ${mov.monto.toFixed(2)}` : ''}</td>
            <td style="text-align: right; font-weight: bold;">$ ${mov.saldo_actual.toFixed(2)}</td>
        `;
    });
}


function showMovementModal() {
    const clientId = document.getElementById('clientSelector').value;
    if (!clientId) {
        showNotification('Por favor, seleccione un cliente primero.', 'error');
        return;
    }
    const modal = document.getElementById('movementModal');
    const conceptSelect = document.getElementById('movementConcepto');
    document.getElementById('newMovementForm').reset();
    document.getElementById('dynamicFieldsContainer').innerHTML = '';
    
    conceptSelect.innerHTML = '<option value="">-- Seleccionar Concepto --</option>';
    conceptosCache.forEach(c => conceptSelect.add(new Option(c.nombre, c.id)));
    
    modal.style.display = 'flex';
}

function hideMovementModal() {
    document.getElementById('movementModal').style.display = 'none';
}

function handleConceptChange(event) {
    const conceptoId = event.target.value;
    const fieldsContainer = document.getElementById('dynamicFieldsContainer');
    fieldsContainer.innerHTML = '';
    if (!conceptoId) return;
    const concepto = conceptosCache.find(c => c.id == conceptoId);
    if (!concepto) return;

    let commonFieldsHTML = `<div class="form-group"><label for="movementDate">Fecha</label><input type="date" id="movementDate" required></div>`;
    
    if (concepto.requiere_aplicacion) {
        commonFieldsHTML += `
            <div id="applicationsContainer" style="width:100%; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
                <h4>2. Ingrese los montos a aplicar en cada factura</h4>
                <div id="invoice-list-for-payment"></div>
                <div class="form-group" style="text-align: right; margin-top: 1.5rem;">
                    <label>Total del Pago Registrado</label>
                    <input type="text" id="paymentTotal" readonly style="font-size: 1.5rem; font-weight: bold; text-align: right; background: none; border: none; color: var(--color-success);">
                </div>
            </div>
        `;
        fieldsContainer.innerHTML = commonFieldsHTML;
        renderFacturasParaAplicar();
    } else {
        commonFieldsHTML += `<div class="form-group"><label for="movementAmount">Monto</label><input type="number" id="movementAmount" required min="0.01" step="0.01"></div>`;
        fieldsContainer.innerHTML = commonFieldsHTML;
    }
    document.getElementById('movementDate').valueAsDate = new Date();
}

function renderFacturasParaAplicar() {
    const applicationsDiv = document.getElementById('invoice-list-for-payment');
    applicationsDiv.innerHTML = '';
    if (facturasPendientesCache.length === 0) {
        applicationsDiv.innerHTML = '<p>No hay facturas pendientes para aplicar este pago.</p>';
        return;
    }
    facturasPendientesCache.forEach(f => {
        const appRow = document.createElement('div');
        appRow.className = 'form-group';
        appRow.innerHTML = `<label for="app-${f.id}">Factura #${f.id} (Pendiente: $${f.saldo_pendiente.toFixed(2)})</label><input type="number" class="application-input" data-invoice-id="${f.id}" placeholder="0.00" min="0" max="${f.saldo_pendiente}" step="0.01">`;
        appRow.querySelector('input').addEventListener('input', updateTotalFromApplications);
        applicationsDiv.appendChild(appRow);
    });
}

function updateTotalFromApplications() {
    let totalApplied = 0;
    document.querySelectorAll('.application-input').forEach(input => {
        totalApplied += parseFloat(input.value) || 0;
    });
    document.getElementById('paymentTotal').value = `$${totalApplied.toFixed(2)}`;
}

async function handleMovementSubmit(e) {
    e.preventDefault();
    const clientId = document.getElementById('clientSelector').value;
    const conceptoId = document.getElementById('movementConcepto').value;
    const concepto = conceptosCache.find(c => c.id == conceptoId);

    if (!concepto) {
        showNotification('Debe seleccionar un concepto válido.', 'error');
        return;
    }

    let paymentData;

    if (concepto.requiere_aplicacion) {
        let totalAplicado = 0;
        const aplicaciones = [];
        document.querySelectorAll('.application-input').forEach(input => {
            const monto = parseFloat(input.value) || 0;
            if (monto > 0) {
                totalAplicado += monto;
                aplicaciones.push({ factura_id: input.dataset.invoiceId, monto_aplicado: monto });
            }
        });
        if (totalAplicado <= 0) {
            showNotification('Debe aplicar un monto mayor a cero a al menos una factura.', 'error');
            return;
        }
        paymentData = { cliente_id: parseInt(clientId), fecha: document.getElementById('movementDate').value, concepto_id: conceptoId, monto: totalAplicado, aplicaciones: aplicaciones };
    } else {
        paymentData = { cliente_id: parseInt(clientId), fecha: document.getElementById('movementDate').value, concepto_id: conceptoId, monto: parseFloat(document.getElementById('movementAmount').value) };
        if (isNaN(paymentData.monto) || paymentData.monto <= 0) {
             showNotification('Debe ingresar un monto válido.', 'error');
             return;
        }
    }

    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Registrando...';
    try {
        const result = await fetchData('cuentas-corrientes', { method: 'POST', body: JSON.stringify(paymentData) });
        hideMovementModal();
        await refreshClientData(clientId);
        showNotification(result.message);
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Guardar Movimiento';
    }
}

function renderBalance(balance) {
    const saldoEl = document.getElementById('saldoFinal');
    if (!saldoEl) return;
    if (typeof balance !== 'number' || isNaN(balance)) {
        saldoEl.textContent = 'Error';
        saldoEl.style.color = 'var(--color-danger)';
    } else {
        saldoEl.textContent = `$${balance.toFixed(2)}`;
        saldoEl.style.color = balance > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)';
    }
}

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area-cc');
    if (!notificationArea) return;
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.style.display = 'block';
    setTimeout(() => {
        notificationArea.style.display = 'none';
    }, 4000);
}