// backend/routes/roles.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Todas las rutas en este archivo requerirán permisos de administrador.
router.use(authenticateToken, authorizeRoles(['admin']));

/**
 * @route   GET /api/roles
 * @desc    Obtener una lista de todos los roles disponibles en el sistema.
 * @access  Private (admin)
 */
router.get('/', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM roles ORDER BY name');
        const roles = stmt.all();
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
router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'El nombre del rol es obligatorio.' });
    }

    try {
        const stmt = db.prepare('INSERT INTO roles (name) VALUES (?)');
        const result = stmt.run(name.trim());
        res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), message: 'Rol creado exitosamente.' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
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
router.put('/:id', (req, res) => {
    const { name } = req.body;
    const { id } = req.params;

    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'El nombre del rol es obligatorio.' });
    }

    try {
        const roleToEditStmt = db.prepare('SELECT name FROM roles WHERE id = ?');
        const roleToEdit = roleToEditStmt.get(id);
        if (roleToEdit && roleToEdit.name === 'admin') {
            return res.status(403).json({ message: 'El rol de administrador no puede ser modificado.' });
        }

        const updateStmt = db.prepare('UPDATE roles SET name = ? WHERE id = ?');
        const result = updateStmt.run(name.trim(), id);
        
        if (result.changes > 0) {
            res.status(200).json({ message: 'Rol actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Rol no encontrado.' });
        }
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
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
router.delete('/:id', (req, res) => {
    const { id } = req.params;

    try {
        const roleToDeleteStmt = db.prepare('SELECT name FROM roles WHERE id = ?');
        const roleToDelete = roleToDeleteStmt.get(id);
        if (roleToDelete && roleToDelete.name === 'admin') {
            return res.status(403).json({ message: 'El rol de administrador no puede ser eliminado.' });
        }

        const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?');
        const userCount = userCountStmt.get(id);
        if (userCount.count > 0) {
            return res.status(409).json({ message: `No se puede eliminar el rol porque está asignado a ${userCount.count} usuario(s).` });
        }

        const deleteStmt = db.prepare('DELETE FROM roles WHERE id = ?');
        const result = deleteStmt.run(id);
        
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
