// backend/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db'); // Importa la conexión a better-sqlite3
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * @route   GET /api/users
 * @desc    Obtener todos los usuarios con su lista de roles.
 * @access  Private (admin)
 */
router.get('/', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    try {
        const sql = `
            SELECT
                u.id,
                u.username,
                GROUP_CONCAT(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id
            ORDER BY u.username;
        `;
        const usersFromDb = db.prepare(sql).all();
        
        const users = usersFromDb.map(user => ({
            ...user,
            roles: user.roles ? user.roles.split(',') : []
        }));
        
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los usuarios.', error: err.message });
    }
});

/**
 * @route   POST /api/users
 * @desc    Crear un nuevo usuario y asignarle roles.
 * @access  Private (admin)
 */
router.post('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { username, password, roleIds } = req.body;

    if (!username || !password || !Array.isArray(roleIds) || roleIds.length === 0) {
        return res.status(400).json({ message: 'Se requieren nombre de usuario, contraseña y al menos un rol.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const createUserTransaction = db.transaction((user, roles) => {
            const userResult = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(user.username, user.hashedPassword);
            const userId = userResult.lastInsertRowid;

            const stmt = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
            for (const roleId of roles) {
                stmt.run(userId, roleId);
            }
            return userId;
        });

        const newUserId = createUserTransaction({ username, hashedPassword }, roleIds);
        res.status(201).json({ id: newUserId, message: 'Usuario creado y roles asignados exitosamente.' });

    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'El nombre de usuario ya está en uso.' });
        }
        res.status(500).json({ message: 'Error al crear el usuario.', error: err.message });
    }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Actualizar un usuario y su asignación de roles.
 * @access  Private (admin)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { username, password, roleIds } = req.body;
    const { id } = req.params;

    if (!username || !Array.isArray(roleIds) || roleIds.length === 0) {
        return res.status(400).json({ message: 'Se requieren nombre de usuario y al menos un rol.' });
    }

    try {
        const updateUserTransaction = db.transaction(async (data) => {
            if (data.password) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(data.password, salt);
                db.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?').run(data.username, hashedPassword, data.id);
            } else {
                db.prepare('UPDATE users SET username = ? WHERE id = ?').run(data.username, data.id);
            }

            db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(data.id);
            
            const stmt = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
            for (const roleId of data.roleIds) {
                stmt.run(data.id, roleId);
            }
        });

        await updateUserTransaction({ id, username, password, roleIds });
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });

    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'El nombre de usuario ya está en uso.' });
        }
        res.status(500).json({ message: 'Error al actualizar el usuario.', error: err.message });
    }
});


/**
 * @route   DELETE /api/users/:id
 * @desc    Eliminar un usuario.
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    if (parseInt(req.params.id, 10) === req.user.id) {
        return res.status(403).json({ message: 'Acción prohibida. No puede eliminar su propia cuenta.' });
    }
    
    try {
        const stmt = db.prepare('DELETE FROM users WHERE id = ?');
        const result = stmt.run(req.params.id);
        if (result.changes > 0) {
            res.status(200).json({ message: 'Usuario eliminado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar el usuario.', error: err.message });
    }
});

module.exports = router;