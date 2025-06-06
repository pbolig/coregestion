// backend/routes/clientes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Obtener todos los clientes (solo admin y ventas)
router.get('/', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
    db.all(`SELECT * FROM clientes`, [], (err, rows) => { 
        if (err) {
            console.error('ERROR BACKEND: Error al obtener clientes de la DB:', err.message);
            return res.status(500).json({ message: 'Error interno del servidor al obtener clientes.' });
        }
        console.log('DEBUG BACKEND: Clientes obtenidos de la DB:', rows); // <-- ¡Verifica este log en la terminal!
        res.json(rows); // <-- Esto DEBE enviar un array (incluso si está vacío)
    });
});

// Crear un nuevo cliente (solo admin y ventas)
router.post('/', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const { nombre, cuit, direccion, telefono, email } = req.body;
    db.run(`INSERT INTO clientes (nombre, cuit, direccion, telefono, email) VALUES (?, ?, ?, ?, ?)`,
        [nombre, cuit, direccion, telefono, email],
        function(err) {
            if (err) {
                console.error('Error al insertar cliente en la DB:', err.message); // DEBUG EN BACKEND
                return res.status(500).json({ message: err.message });
            }
            res.status(201).json({ id: this.lastID, message: 'Cliente creado exitosamente.' });
        }
    );
});

// Eliminar un cliente por ID (solo admin)
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    const clientId = req.params.id; // Obtiene el ID del cliente de la URL

    db.run(`DELETE FROM clientes WHERE id = ?`, clientId, function(err) {
        if (err) {
            console.error('ERROR BACKEND: Error al eliminar cliente de la DB:', err.message);
            return res.status(500).json({ message: 'Error interno del servidor al eliminar cliente.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }
        res.json({ message: 'Cliente eliminado exitosamente.' });
    });
});

function deleteClient(clientId, clientName) {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${clientName}?`)) {
        // Lógica para enviar la solicitud DELETE a la API del backend
        try {
            // Usamos fetchData, que ya maneja los tokens y errores
            fetchData(`clientes/${clientId}`, { method: 'DELETE' })
                .then(response => {
                    alert(response.message || `Cliente ${clientName} eliminado exitosamente.`);
                    loadClients(); // Recargar la lista después de eliminar
                })
                .catch(error => {
                    alert(`Error al eliminar cliente: ${error.message}`);
                    console.error('Error al eliminar cliente:', error);
                });
        } catch (error) {
            alert(`Error al iniciar la eliminación: ${error.message}`);
            console.error('Error en deleteClient:', error);
        }
    }
}

// Obtener un cliente por ID (solo admin y ventas)
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'ventas', 'cobranzas']), (req, res) => {
    const clientId = req.params.id;
    db.get(`SELECT * FROM clientes WHERE id = ?`, clientId, (err, row) => {
        if (err) {
            console.error('ERROR BACKEND: Error al obtener cliente por ID:', err.message);
            return res.status(500).json({ message: 'Error interno del servidor al obtener cliente.' });
        }
        if (!row) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }
        res.json(row);
    });
});

// Actualizar un cliente por ID (solo admin y ventas)
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'ventas']), (req, res) => {
    const clientId = req.params.id;
    const { nombre, cuit, direccion, telefono, email } = req.body;

    db.run(`UPDATE clientes SET nombre = ?, cuit = ?, direccion = ?, telefono = ?, email = ? WHERE id = ?`,
        [nombre, cuit, direccion, telefono, email, clientId],
        function(err) {
            if (err) {
                console.error('ERROR BACKEND: Error al actualizar cliente en la DB:', err.message);
                return res.status(500).json({ message: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'Cliente no encontrado o sin cambios.' });
            }
            res.json({ message: 'Cliente actualizado exitosamente.' });
        }
    );
});

module.exports = router;