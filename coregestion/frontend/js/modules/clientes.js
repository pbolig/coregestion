// frontend/js/modules/clientes.js
import { fetchData } from '../api.js';

export async function render(container) {
    container.innerHTML = `
        <h2>Gestión de Clientes</h2>
        <button id="addClientBtn">Agregar Cliente</button>
        <div id="clientFormContainer" style="display:none;">
            <h3>Nuevo Cliente</h3>
            <form id="newClientForm">
                <input type="text" id="clientName" placeholder="Nombre" required><br>
                <input type="text" id="clientCuit" placeholder="CUIT" required><br>
                <input type="text" id="clientAddress" placeholder="Dirección"><br>
                <input type="text" id="clientPhone" placeholder="Teléfono"><br>
                <input type="email" id="clientEmail" placeholder="Email"><br>
                <button type="submit">Guardar Cliente</button>
                <button type="button" id="cancelAddClient">Cancelar</button>
            </form>
        </div>
        <div id="clientList">
            <h3>Listado de Clientes</h3>
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>CUIT</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="clientsTableBody">
                    </tbody>
            </table>
        </div>
    `;

    const addClientBtn = document.getElementById('addClientBtn');
    const clientFormContainer = document.getElementById('clientFormContainer');
    const newClientForm = document.getElementById('newClientForm');
    const cancelAddClient = document.getElementById('cancelAddClient');

    addClientBtn.onclick = () => clientFormContainer.style.display = 'block';
    cancelAddClient.onclick = () => clientFormContainer.style.display = 'none';

    newClientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newClient = {
            nombre: document.getElementById('clientName').value,
            cuit: document.getElementById('clientCuit').value,
            direccion: document.getElementById('clientAddress').value,
            telefono: document.getElementById('clientPhone').value,
            email: document.getElementById('clientEmail').value,
        };
        try {
            await fetchData('clientes', { method: 'POST', body: JSON.stringify(newClient) });
            alert('Cliente agregado!');
            clientFormContainer.style.display = 'none';
            loadClients(); // Recargar la lista de clientes
        } catch (error) {
            alert('Error al agregar cliente: ' + error.message);
        }
    });

    loadClients();
}

// ... (código anterior de clientes.js)

async function loadClients() {
    const clientsTableBody = document.getElementById('clientsTableBody');
    clientsTableBody.innerHTML = '<tr><td colspan="3">Cargando clientes...</td></tr>';
    try {
        const clients = await fetchData('clientes');
        clientsTableBody.innerHTML = '';
        clients.forEach(client => { // <-- Aquí comienza el bucle para cada cliente
            const row = clientsTableBody.insertRow(); // Crea una nueva fila en la tabla
            row.innerHTML = `  // <-- Aquí se asigna el HTML a la fila usando un template literal
                <td>${client.nombre}</td>
                <td>${client.cuit}</td>
                <td>
                    <button onclick="alert('Editar ${client.nombre}')">Editar</button>
                    <button onclick="alert('Eliminar ${client.nombre}')">Eliminar</button>
                </td>
            `; // <-- CIERRE CORRECTO DEL TEMPLATE LITERAL
        }); // <-- CIERRE CORRECTO DEL forEach
    } catch (error) {
        clientsTableBody.innerHTML = `<tr><td colspan="3">Error: ${error.message}</td></tr>`; // <-- CIERRE CORRECTO DEL TEMPLATE LITERAL
    }
}

// **Funciones de ejemplo para editar y eliminar (deberás implementarlas)**
// Es una buena práctica separar la lógica de los event handlers
function editClient(clientId, clientName) {
    alert(`Editar cliente: ${clientName} (ID: ${clientId})`);
    // Aquí iría tu lógica para abrir un modal de edición o navegar a una página de edición
}

function deleteClient(clientId, clientName) {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${clientName}?`)) {
        alert(`Eliminar cliente: ${clientName} (ID: ${clientId})`);
        // Aquí iría tu lógica para enviar una solicitud DELETE a la API
    }
}