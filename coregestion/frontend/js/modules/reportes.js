// frontend/js/modules/reportes.js
import { fetchData } from '../api.js';

const moduleHTML = `
    <div id="notification-area-reportes" class="notification-area"></div>
    <h2>Módulo de Reportes</h2>
    
    <div class="form-container" style="align-items: flex-end;">
        <div class="form-group">
            <label for="reportSelector">Seleccionar Reporte</label>
            <select id="reportSelector">
                <option value="">-- Elija un reporte --</option>
                <option value="ventas_por_cliente">Ventas por Cliente</option>
                <option value="cuentas_por_cobrar">Cuentas por Cobrar</option>
                <option value="estado_presupuestos">Estado de Presupuestos</option>
            </select>
        </div>
        <div id="filtersContainer" style="display:contents;"></div>
        <div class="form-actions">
            <button id="generateReportBtn" class="btn btn-primary">Generar Reporte</button>
        </div>
    </div>

    <div id="reportResultContainer" class="table-container" style="margin-top: 2rem; display:none;">
        <h3 id="reportTitle"></h3>
        <div id="chartContainer" style="width: 100%; max-width: 700px; margin: 1rem auto; display: none;">
            <canvas id="reportChart"></canvas>
        </div>
        <table>
            <thead id="reportTableHead"></thead>
            <tbody id="reportTableBody"></tbody>
            <tfoot id="reportTableFoot" style="border-top: 2px solid var(--color-text-primary); font-weight: bold;"></tfoot>
        </table>
    </div>
    <style> /* ... estilos de notificación ... */ </style>
`;

let chartInstance = null;

export async function render(container) {
    container.innerHTML = moduleHTML;
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('reportSelector').addEventListener('change', handleReportSelection);
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
}

function handleReportSelection() {
    const reportName = document.getElementById('reportSelector').value;
    const filtersContainer = document.getElementById('filtersContainer');
    filtersContainer.innerHTML = ''; // Limpiar filtros anteriores

    if (reportName === 'ventas_por_cliente' || reportName === 'estado_presupuestos') {
        filtersContainer.innerHTML = `
            <div class="form-group"><label for="filterDesde">Desde</label><input type="date" id="filterDesde"></div>
            <div class="form-group"><label for="filterHasta">Hasta</label><input type="date" id="filterHasta"></div>
        `;
    }
    if (reportName === 'estado_presupuestos') {
        const estados = ['Todos', 'En Espera de Cotización', 'Aprobado por Cliente', 'Rechazado', 'En Ejecución', 'Facturado', 'Fac. Fiscal', 'Pendiente de Insumos', 'Cancelado'];
        let optionsHtml = estados.map(e => `<option value="${e}">${e}</option>`).join('');
        filtersContainer.innerHTML += `<div class="form-group"><label for="filterEstado">Estado</label><select id="filterEstado">${optionsHtml}</select></div>`;
    }
}

async function generateReport() {
    const reportName = document.getElementById('reportSelector').value;
    if (!reportName) {
        alert('Por favor, seleccione un tipo de reporte.');
        return;
    }

    const desde = document.getElementById('filterDesde')?.value;
    const hasta = document.getElementById('filterHasta')?.value;
    const estado = document.getElementById('filterEstado')?.value;

    let queryString = `?name=${reportName}`;
    if (desde) queryString += `&desde=${desde}`;
    if (hasta) queryString += `&hasta=${hasta}`;
    if (estado) queryString += `&estado=${estado}`;

    const resultContainer = document.getElementById('reportResultContainer');
    const tableHead = document.getElementById('reportTableHead');
    const tableBody = document.getElementById('reportTableBody');
    const tableFoot = document.getElementById('reportTableFoot');
    const reportTitle = document.getElementById('reportTitle');
    
    resultContainer.style.display = 'block';
    reportTitle.textContent = `Reporte: ${document.getElementById('reportSelector').options[document.getElementById('reportSelector').selectedIndex].text}`;
    tableBody.innerHTML = '<tr><td colspan="10">Generando reporte...</td></tr>';
    tableFoot.innerHTML = ''; // Limpiar pie de tabla

    try {
        const data = await fetchData(`reportes${queryString}`);
        renderReportTable(reportName, data);
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="10">Error al generar el reporte: ${error.message}</td></tr>`;
    }
}

function renderReportTable(reportName, data) {
    const tableHead = document.getElementById('reportTableHead');
    const tableBody = document.getElementById('reportTableBody');
    const tableFoot = document.getElementById('reportTableFoot');
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    tableFoot.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10">No se encontraron datos para los filtros seleccionados.</td></tr>';
        return;
    }

    const headers = Object.keys(data[0]);
    const totals = {};

    // --- LÓGICA MEJORADA PARA LA CABECERA ---
    let headerHtml = '<tr>';
    headers.forEach(header => {
        // Determinamos la alineación basada en el tipo de dato de la primera fila
        const isNumeric = typeof data[0][header] === 'number';
        const alignClass = isNumeric ? 'text-right' : 'text-left';
        headerHtml += `<th class="${alignClass}">${header.replace(/_/g, ' ').toUpperCase()}</th>`;
        
        if (isNumeric && !header.toLowerCase().includes('id')) {
            totals[header] = 0;
        }
    });
    headerHtml += '</tr>';
    tableHead.innerHTML = headerHtml;

    data.forEach(row => {
        const tr = tableBody.insertRow();
        headers.forEach(header => {
            const cell = tr.insertCell();
            const isNumeric = typeof row[header] === 'number';
            cell.className = isNumeric ? 'text-right' : 'text-left';

            let value = row[header];
            if (totals[header] !== undefined) {
                totals[header] += value;
            }

            if (typeof value === 'number' && (header.includes('total') || header.includes('deuda'))) {
                value = `$${value.toFixed(2)}`;
            }
            if (typeof value === 'string' && header.toLowerCase().includes('fecha')) {
                value = new Date(value).toLocaleDateString('es-AR');
            }
            cell.textContent = value;
        });
    });

    // --- NUEVA LÓGICA: RENDERIZAR EL FOOTER CON TOTALES ---
    if (Object.keys(totals).length > 0) {
        const footerRow = tableFoot.insertRow();
        headers.forEach((header, index) => {
            const cell = footerRow.insertCell();
            const isNumeric = typeof data[0][header] === 'number';
            cell.className = isNumeric ? 'text-right' : 'text-left';

            if (index === 0) {
                cell.textContent = 'TOTALES';
            } else if (totals[header] !== undefined) {
                let totalValue = totals[header];
                if (header.includes('total') || header.includes('deuda')) {
                    cell.textContent = `$${totalValue.toFixed(2)}`;
                } else {
                    cell.textContent = totalValue;
                }
            }
        });
    }
}