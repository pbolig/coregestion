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

    loadClients(); // Llama a la función para cargar los clientes al renderizar el módulo
}

// Función para cargar y mostrar los clientes en la tabla
async function loadClients() { // <-- Nombre de la función corregido
    const clientsTableBody = document.getElementById('clientsTableBody');
    clientsTableBody.innerHTML = '<tr><td colspan="3">Cargando clientes...</td></tr>';
    try {
        const clients = await fetchData('clientes'); // Llama al backend para obtener los clientes
        clientsTableBody.innerHTML = ''; // Limpia el mensaje de carga
        clients.forEach(client => {
            const row = clientsTableBody.insertRow(); // Crea una nueva fila en la tabla
            row.innerHTML = `
                <td>${client.nombre}</td>
                <td>${client.cuit}</td>
                <td>
                    <button onclick="editClient('${client.id}', '${client.nombre}')">Editar</button>
                    <button onclick="deleteClient('${client.id}', '${client.nombre}')">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        console.error('Error al cargar clientes para la grilla:', error); // DEBUG en consola
        clientsTableBody.innerHTML = `<tr><td colspan="3">Error: ${error.message}</td></tr>`; // Muestra error en la grilla
    }
}

function deleteClient(clientId, clientName) {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${clientName}?`)) {
        // Aquí iría tu lógica para enviar una solicitud DELETE a la API del backend
        alert(`Eliminar cliente: ${clientName} (ID: ${clientId})`);
    }
}

function editClient(clientId, clientName) {
    // En un sistema real, aquí cargarías un modal con los datos del cliente
    // y permitirías la edición. Por ahora, un simple alert/prompt para demostrar.

    // Simulación: Obtener datos del cliente (esto es lo que harías con fetchData)
    fetchData(`clientes/${clientId}`)
        .then(clientData => {
            alert(`Editar cliente: ${clientData.nombre} (CUIT: ${clientData.cuit})`);            

            // Para simular la edición con prompt:
            const newName = prompt(`Nuevo nombre para ${clientData.nombre}:`, clientData.nombre);
            if (newName !== null && newName !== clientData.nombre) {
                // Si el usuario ingresó un nuevo nombre, enviamos la actualización
                fetchData(`clientes/${clientId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        nombre: newName,
                        cuit: clientData.cuit, // Mantener los demás datos
                        direccion: clientData.direccion,
                        telefono: clientData.telefono,
                        email: clientData.email
                    })
                })
                .then(response => {
                    alert(response.message || `Cliente ${newName} actualizado exitosamente.`);
                    loadClients(); // Recargar la lista
                })
                .catch(error => {
                    alert(`Error al actualizar cliente: ${error.message}`);
                    console.error('Error al actualizar cliente:', error);
                });
            } else if (newName === null) {
                alert('Edición cancelada.');
            }
        })
        .catch(error => {
            alert(`Error al obtener datos del cliente para editar: ${error.message}`);
            console.error('Error al obtener cliente para edición:', error);
        });
}
