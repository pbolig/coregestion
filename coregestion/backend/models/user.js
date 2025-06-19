// backend/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// Middleware de validación de datos de usuario
const validateUserData = (req, res, next) => {
    const { username, password, role } = req.body;
    if (!username || username.length < 3) {
        return res.status(400).json({ message: 'El nombre de usuario es obligatorio y debe tener al menos 3 caracteres.' });
    }
    // La validación de la contraseña solo se aplica si se está proporcionando (para creación o cambio)
    if (req.method === 'POST' && (!password || password.length < 6)) {
        return res.status(400).json({ message: 'La contraseña es obligatoria y debe tener al menos 6 caracteres.' });
    }
    if (password && password.length < 6) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }
    if (!role || !['admin', 'ventas', 'cobranzas'].includes(role)) {
        return res.status(400).json({ message: 'El rol no es válido. Roles permitidos: admin, ventas, cobranzas.' });
    }
    next();
};

/**
 * @route   GET /api/users
 * @desc    Obtener todos los usuarios (sin la contraseña)
 * @access  Private (admin)
 */
router.get('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        // Excluimos explícitamente el campo 'password' de la consulta
        const users = await db.all("SELECT id, username, role FROM users");
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener los usuarios.', error: err.message });
    }
});

/**
 * @route   POST /api/users
 * @desc    Crear un nuevo usuario
 * @access  Private (admin)
 */
router.post('/', authenticateToken, authorizeRoles(['admin']), validateUserData, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
        const result = await db.run(sql, [username, hashedPassword, role]);
        res.status(201).json({ id: result.lastID, message: 'Usuario creado exitosamente.' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed: users.username')) {
            return res.status(409).json({ message: 'El nombre de usuario ya está en uso.' });
        }
        res.status(500).json({ message: 'Error al crear el usuario.', error: err.message });
    }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Actualizar un usuario (rol y opcionalmente contraseña)
 * @access  Private (admin)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin']), validateUserData, async (req, res) => {
    const { username, password, role } = req.body;
    
    try {
        if (password) {
            // Si se proporciona una contraseña, se actualiza
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await db.run('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?', [username, hashedPassword, role, req.params.id]);
        } else {
            // Si no, solo se actualiza username y role
            await db.run('UPDATE users SET username = ?, role = ? WHERE id = ?', [username, role, req.params.id]);
        }
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (err) {
         if (err.message.includes('UNIQUE constraint failed: users.username')) {
            return res.status(409).json({ message: 'El nombre de usuario ya está en uso.' });
        }
        res.status(500).json({ message: 'Error al actualizar el usuario.', error: err.message });
    }
});


/**
 * @route   DELETE /api/users/:id
 * @desc    Eliminar un usuario
 * @access  Private (admin)
 */
router.delete('/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        // Medida de seguridad: impedir que un admin se elimine a sí mismo
        if (parseInt(req.params.id, 10) === req.user.id) {
            return res.status(403).json({ message: 'No puede eliminar su propia cuenta de administrador.' });
        }
        
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