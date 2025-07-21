// frontend/js/modules/dashboard.js
import { fetchData } from '../api.js';

let chartInstance = null;

export async function render(container) {
    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="kpi-card">
                <h3>Cuentas por Cobrar</h3>
                <p id="kpi-cobrar">$ 0.00</p>
                <i class="fas fa-hand-holding-dollar"></i>
            </div>
            <div class="kpi-card">
                <h3>Nuevos Prospectos</h3>
                <p id="kpi-prospectos">0</p>
                <i class="fas fa-user-plus"></i>
            </div>
            <div class="kpi-card">
                <h3>Presupuestos a Facturar</h3>
                <p id="kpi-facturar">0</p>
                <i class="fas fa-file-invoice"></i>
            </div>
        </div>
        <div class="chart-container">
            <h3>Ventas de los Últimos 30 Días</h3>
            <canvas id="salesChart"></canvas>
        </div>
        <style>
            .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
            .kpi-card { background: #fff; padding: 1.5rem; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); position: relative; overflow: hidden; }
            .kpi-card h3 { color: var(--color-text-secondary); font-size: 1rem; margin-bottom: 0.5rem; }
            .kpi-card p { font-size: 2.5rem; font-weight: 700; color: var(--color-text-dark); }
            .kpi-card i { position: absolute; right: 1rem; top: 1rem; font-size: 3rem; color: var(--color-primary); opacity: 0.1; }
            .chart-container { background: #fff; padding: 1.5rem; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); }
        </style>
    `;
    loadDashboardData();
}

async function loadDashboardData() {
    try {
        const data = await fetchData('dashboard/summary');
        
        document.getElementById('kpi-cobrar').textContent = `$${data.cuentasPorCobrar.toFixed(2)}`;
        document.getElementById('kpi-prospectos').textContent = data.nuevosProspectos;
        document.getElementById('kpi-facturar').textContent = data.presupuestosAFacturar;

        renderSalesChart(data.ventasUltimos30Dias);

    } catch (error) {
        console.error("Error al cargar datos del dashboard:", error);
    }
}

function renderSalesChart(salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = salesData.map(d => new Date(d.dia + 'T00:00:00').toLocaleDateString('es-AR'));
    const data = salesData.map(d => d.total);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Facturado',
                data: data,
                backgroundColor: 'rgba(37, 99, 235, 0.6)',
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('es-AR');
                        }
                    }
                }
            }
        }
    });
}