// backend/routes/roles.js
const express = require('express');
const router = express.Router();
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// Todas las rutas en este archivo requerirán permisos de administrador.

/**
 * @route   GET /api/roles
 * @desc    Obtener una lista de todos los roles disponibles en el sistema.
 * @access  Private (admin)
 */
router.get('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const roles = await db.all('SELECT * FROM roles ORDER BY name');
        res.status(200).json(roles);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los roles.', error: err.message });
    }
});

/**
 * @route   POST /api/roles
 * @desc    Crear un nuevo rol.
 * @access  Private (admin)
 */
router.post('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'El nombre del rol es obligatorio.' });
    }

    try {
        const result = await db.run('INSERT INTO roles (name) VALUES (?)', [name.trim()]);
        res.status(201).json({ id: result.lastID, name: name.trim(), message: 'Rol creado exitosamente.' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ message: 'El rol ya existe.' });
        }
        res.status(500).json({ message: 'Error al crear el rol.', error: err.message });
    }
});

/**
 * @route   PUT /api/roles/:id
 * @desc    Actualizar el nombre de un rol existente.
 * @access  Private (admin)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { name } = req.body;
    const { id } = req.params;

    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'El nombre del rol es obligatorio.' });
    }

    try {
        // No se puede renombrar el rol de 'admin' por seguridad.
        const roleToEdit = await db.get('SELECT name FROM roles WHERE id = ?', [id]);
        if (roleToEdit && roleToEdit.name === 'admin') {
            return res.status(403).json({ message: 'El rol de administrador no puede ser modificado.' });
        }

        const result = await db.run('UPDATE roles SET name = ? WHERE id = ?', [name.trim(), id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Rol actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Rol no encontrado.' });
        }
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ message: 'El nuevo nombre del rol ya está en uso.' });
        }
        res.status(500).json({ message: 'Error al actualizar el rol.', error: err.message });
    }
});

/**
 * @route   DELETE /api/roles/:id
 * @desc    Eliminar un rol.
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { id } = req.params;

    try {
        // Medida de seguridad: No permitir la eliminación del rol de 'admin'.
        const roleToDelete = await db.get('SELECT name FROM roles WHERE id = ?', [id]);
        if (roleToDelete && roleToDelete.name === 'admin') {
            return res.status(403).json({ message: 'El rol de administrador no puede ser eliminado.' });
        }

        // Medida de seguridad: Verificar si el rol está asignado a algún usuario.
        const userCount = await db.get('SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?', [id]);
        if (userCount.count > 0) {
            return res.status(409).json({ message: `No se puede eliminar el rol porque está asignado a ${userCount.count} usuario(s).` });
        }

        const result = await db.run('DELETE FROM roles WHERE id = ?', [id]);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Rol eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Rol no encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar el rol.', error: err.message });
    }
});

module.exports = router;