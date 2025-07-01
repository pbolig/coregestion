// frontend/js/modules/portal_dashboard.js
import { fetchData } from '../api.js';

/**
 * Renderiza el dashboard del cliente/prospecto.
 * @param {HTMLElement} container - El elemento donde se renderizará la vista.
 */
export async function render(container) {
    const prospecto = JSON.parse(localStorage.getItem('portal_user'));
    
    container.innerHTML = `
        <h2>Bienvenido, ${prospecto.nombre}</h2>
        <p>Desde aquí puede solicitar nuevos presupuestos y ver el estado de sus solicitudes anteriores.</p>
        
        <!-- Formulario para Nueva Solicitud -->
        <div class="form-container">
            <h3>Nueva Solicitud de Presupuesto</h3>
            <form id="newSolicitudForm" style="width:100%; display:contents;">
                <div class="form-group" style="flex-basis: 100%;">
                    <label for="solicitudDescripcion">Describa su necesidad:</label>
                    <textarea id="solicitudDescripcion" rows="5" required placeholder="Ej: Necesito instalar un generador de 5kW en una casa de campo, incluyendo cableado subterráneo de 50 metros."></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Enviar Solicitud</button>
                </div>
            </form>
        </div>

        <!-- Tabla de Solicitudes Anteriores -->
        <div class="table-container">
            <h3>Historial de Solicitudes</h3>
            <table>
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Estado</th></tr></thead>
                <tbody id="solicitudesTableBody"></tbody>
            </table>
        </div>
    `;

    setupEventListeners();
    await loadMisSolicitudes();
}

function setupEventListeners() {
    document.getElementById('newSolicitudForm').addEventListener('submit', handleSolicitudSubmit);
}

async function loadMisSolicitudes() {
    const tableBody = document.getElementById('solicitudesTableBody');
    tableBody.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
    try {
        const solicitudes = await fetchData('portal/solicitudes'); // Llama a la nueva API
        tableBody.innerHTML = '';
        if (solicitudes.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3">Aún no ha realizado ninguna solicitud.</td></tr>';
        } else {
            solicitudes.forEach(s => {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td>${new Date(s.fecha_solicitud).toLocaleDateString('es-AR')}</td>
                    <td>${s.descripcion_necesidad}</td>
                    <td>${s.estado}</td>
                `;
            });
        }
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="3">Error al cargar solicitudes: ${error.message}</td></tr>`;
    }
}

async function handleSolicitudSubmit(e) {
    e.preventDefault();
    const descripcion = document.getElementById('solicitudDescripcion').value;
    try {
        const result = await fetchData('portal/solicitudes', {
            method: 'POST',
            body: JSON.stringify({ descripcion_necesidad: descripcion })
        });
        alert(result.message);
        document.getElementById('newSolicitudForm').reset();
        await loadMisSolicitudes();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}