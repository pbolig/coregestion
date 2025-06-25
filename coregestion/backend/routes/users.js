// backend/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

/**
 * @route   GET /api/users
 * @desc    Obtener todos los usuarios con su lista de roles.
 * @access  Private (admin)
 */
router.get('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        // Consulta SQL para unir usuarios con sus roles a través de la tabla puente.
        // GROUP_CONCAT junta todos los nombres de los roles en un solo string separado por comas.
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
        const usersFromDb = await db.all(sql);
        
        // Convertimos el string de roles (ej: "admin,ventas") en un array.
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
    // Ahora esperamos un array 'roleIds' en lugar de un 'role' string.
    const { username, password, roleIds } = req.body;

    if (!username || !password || !Array.isArray(roleIds) || roleIds.length === 0) {
        return res.status(400).json({ message: 'Se requieren nombre de usuario, contraseña y al menos un rol.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const userResult = await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        const userId = userResult.lastID;

        // Insertar cada asociación en la tabla user_roles.
        const stmt = await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
        for (const roleId of roleIds) {
            await stmt.run(userId, roleId);
        }
        await stmt.finalize();

        await db.run('COMMIT');
        
        res.status(201).json({ id: userId, message: 'Usuario creado y roles asignados exitosamente.' });
    } catch (err) {
        await db.run('ROLLBACK');
        if (err.message.includes('UNIQUE constraint failed: users.username')) {
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
        await db.run('BEGIN TRANSACTION');
        
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await db.run('UPDATE users SET username = ?, password = ? WHERE id = ?', [username, hashedPassword, id]);
        } else {
            await db.run('UPDATE users SET username = ? WHERE id = ?', [username, id]);
        }

        // Proceso de actualización de roles: Borrar los antiguos e insertar los nuevos.
        await db.run('DELETE FROM user_roles WHERE user_id = ?', [id]);
        
        const stmt = await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
        for (const roleId of roleIds) {
            await stmt.run(id, roleId);
        }
        await stmt.finalize();

        await db.run('COMMIT');
        
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
        await db.run('ROLLBACK');
        if (err.message.includes('UNIQUE constraint failed: users.username')) {
            return res.status(409).json({ message: 'El nombre de usuario ya está en uso.' });
        }
        res.status(500).json({ message: 'Error al actualizar el usuario.', error: err.message });
    }
});


/**
 * @route   DELETE /api/users/:id
 * @desc    Eliminar un usuario. La DB se encarga de borrar las asociaciones en user_roles gracias a ON DELETE CASCADE.
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    if (parseInt(req.params.id, 10) === req.user.id) {
        return res.status(403).json({ message: 'Acción prohibida. No puede eliminar su propia cuenta.' });
    }
    
    try {
        const result = await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
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