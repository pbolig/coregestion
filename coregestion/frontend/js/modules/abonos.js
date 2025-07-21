// frontend/js/modules/abonos.js
import { fetchData } from '../api.js';

let abonosCache = [];
let userRole = null;

const moduleHTML = `
    <div id="notification-area-abonos" class="notification-area"></div>
    <h2>Gestión de Abonos y Suscripciones</h2>
    
    <div class="table-container">
        <h3>Listado de Abonos Activos e Inactivos</h3>
        <table>
            <thead>
                <tr>
                    <th>Cliente</th>
                    <th>Servicio Contratado</th>
                    <th>Monto</th>
                    <th>Frecuencia</th>
                    <th>Próxima Facturación</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody id="abonosTableBody"></tbody>
        </table>
    </div>

    <!-- Modal para Editar Abono -->
    <div id="abonoEditModal" class="modal-overlay" style="display:none;">
        <div class="modal-content">
            <button id="closeAbonoModalBtn" class="modal-close-btn">&times;</button>
            <h3>Editar Abono</h3>
            <form id="abonoEditForm">
                <input type="hidden" id="abonoId">
                <div class="form-group">
                    <label for="abonoMonto">Monto Recurrente</label>
                    <input type="number" id="abonoMonto" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label for="abonoFrecuencia">Frecuencia</label>
                    <select id="abonoFrecuencia" required>
                        <option value="mensual">Mensual</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="semestral">Semestral</option>
                        <option value="anual">Anual</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="abonoProximaFecha">Próxima Fecha de Facturación</label>
                    <input type="date" id="abonoProximaFecha" required>
                </div>
                <div class="form-group">
                    <label for="abonoEstado">Estado</label>
                    <select id="abonoEstado" required>
                        <option value="Activo">Activo</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
                <div class="form-actions"><button type="submit" class="btn btn-primary">Guardar Cambios</button></div>
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
    await loadAbonos();
}

function setupEventListeners() {
    document.getElementById('abonosTableBody').addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            showEditModal(e.target.dataset.id);
        }
    });
    document.getElementById('closeAbonoModalBtn')?.addEventListener('click', () => document.getElementById('abonoEditModal').style.display = 'none');
    document.getElementById('abonoEditForm')?.addEventListener('submit', handleEditSubmit);
    document.getElementById('abonoFrecuencia')?.addEventListener('change', handleFrecuenciaChange);
}

async function loadAbonos() {
    const tableBody = document.getElementById('abonosTableBody');
    tableBody.innerHTML = '<tr><td colspan="7">Cargando abonos...</td></tr>';
    try {
        abonosCache = await fetchData('abonos');
        tableBody.innerHTML = '';
        if (abonosCache.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">No hay abonos registrados.</td></tr>';
            return;
        }
        abonosCache.forEach(abono => {
            const row = tableBody.insertRow();
            // --- CELDAS CON ALINEACIÓN APLICADA ---
            row.innerHTML = `
                <td class="text-left">${abono.cliente_nombre}</td>
                <td class="text-left">${abono.insumo_nombre}</td>
                <td class="text-right">$${abono.monto_recurrente.toFixed(2)}</td>
                <td class="text-left">${abono.frecuencia}</td>
                <td class="text-left">${new Date(abono.proxima_fecha_facturacion).toLocaleDateString('es-AR')}</td>
                <td class="text-center"><span class="status-badge ${abono.estado.toLowerCase()}">${abono.estado}</span></td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-warning edit-btn" data-id="${abono.id}">Editar</button>
                </td>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7">Error al cargar abonos: ${error.message}</td></tr>`;
    }
}

function showEditModal(abonoId) {
    const abono = abonosCache.find(a => a.id == abonoId);
    if (!abono) return;
    const form = document.getElementById('abonoEditForm');
    form.dataset.originalProximaFecha = abono.proxima_fecha_facturacion;
    form.dataset.originalFrecuencia = abono.frecuencia;
    document.getElementById('abonoId').value = abono.id;
    document.getElementById('abonoMonto').value = abono.monto_recurrente;
    document.getElementById('abonoFrecuencia').value = abono.frecuencia;
    document.getElementById('abonoProximaFecha').value = abono.proxima_fecha_facturacion.split('T')[0];
    document.getElementById('abonoEstado').value = abono.estado;
    document.getElementById('abonoEditModal').style.display = 'flex';
}

function handleFrecuenciaChange() {
    const form = document.getElementById('abonoEditForm');
    const fechaInput = document.getElementById('abonoProximaFecha');
    const frecuenciaSelect = document.getElementById('abonoFrecuencia');
    
    // Usamos la fecha que está actualmente en el campo como base.
    const fechaBase = new Date(fechaInput.value + 'T12:00:00Z'); // Usar T12:00:00Z para evitar problemas de zona horaria
    const nuevaFrecuencia = frecuenciaSelect.value;
    const frecuenciaOriginal = form.dataset.originalFrecuencia;

    if (isNaN(fechaBase.getTime())) {
        console.error("Fecha base inválida para el recálculo.");
        return;
    }
    
    console.log(`[RECALCULAR] Fecha base detectada: ${fechaBase.toLocaleDateString()}`);
    console.log(`[RECALCULAR] Frecuencia original: ${frecuenciaOriginal}, Nueva frecuencia: ${nuevaFrecuencia}`);

    const mesesPorFrecuencia = { 'mensual': 1, 'trimestral': 3, 'semestral': 6, 'anual': 12 };

    // Para evitar errores acumulativos, siempre recalculamos desde la fecha original guardada
    const fechaOriginalGuardada = new Date(form.dataset.originalProximaFecha);
    
    const nuevaProximaFecha = new Date(fechaOriginalGuardada);
    nuevaProximaFecha.setMonth(nuevaProximaFecha.getMonth() - mesesPorFrecuencia[frecuenciaOriginal]);
    nuevaProximaFecha.setMonth(nuevaProximaFecha.getMonth() + mesesPorFrecuencia[nuevaFrecuencia]);

    console.log(`[RECALCULAR] Nueva fecha calculada: ${nuevaProximaFecha.toLocaleDateString()}`);
    
    // Formatear a YYYY-MM-DD para el input type="date"
    const anio = nuevaProximaFecha.getFullYear();
    const mes = String(nuevaProximaFecha.getMonth() + 1).padStart(2, '0');
    const dia = String(nuevaProximaFecha.getDate()).padStart(2, '0');
    
    fechaInput.value = `${anio}-${mes}-${dia}`;
    console.log(`[RECALCULAR] Valor del input actualizado a: ${fechaInput.value}`);
}

async function handleEditSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('abonoId').value;
    const data = {
        monto_recurrente: document.getElementById('abonoMonto').value,
        frecuencia: document.getElementById('abonoFrecuencia').value,
        proxima_fecha_facturacion: document.getElementById('abonoProximaFecha').value,
        estado: document.getElementById('abonoEstado').value,
    };
    try {
        const result = await fetchData(`abonos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showNotification(result.message);
        document.getElementById('abonoEditModal').style.display = 'none';
        await loadAbonos();
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area-abonos');
    if (!notificationArea) return;
    notificationArea.textContent = message;
    notificationArea.className = `notification-area ${type}`;
    notificationArea.style.display = 'block';
    setTimeout(() => {
        notificationArea.style.display = 'none';
    }, 4000);
}