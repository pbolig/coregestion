// backend/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const dbPromise = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

let db;
dbPromise.then(database => {
    db = database;
}).catch(err => {
    console.error("Error al inicializar la base de datos para las rutas de usuarios:", err);
});

// Middleware para validar los datos de entrada de un usuario
const validateUserData = (req, res, next) => {
    const { username, role } = req.body;
    const password = req.body.password || ''; // Acepta contraseña vacía para actualizaciones sin cambio de clave

    if (!username || username.trim().length < 3) {
        return res.status(400).json({ message: 'El nombre de usuario es obligatorio y debe tener al menos 3 caracteres.' });
    }
    // La contraseña es obligatoria solo al crear un usuario (POST)
    if (req.method === 'POST' && (!password || password.length < 6)) {
        return res.status(400).json({ message: 'La contraseña es obligatoria y debe tener al menos 6 caracteres.' });
    }
    // Si se provee una contraseña (para actualizar), también debe ser válida
    if (req.method === 'PUT' && password && password.length < 6) {
         return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }
    if (!role || !['admin', 'ventas', 'cobranzas', 'almacen', 'compras'].includes(role)) {
        return res.status(400).json({ message: 'El rol proporcionado no es válido.' });
    }
    next();
};

// --- RUTAS DEL CRUD PARA USUARIOS (Solo Admin) ---

/**
 * @route   GET /api/users
 * @desc    Obtener todos los usuarios (sin contraseñas)
 * @access  Private (admin)
 */
router.get('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        // NUNCA devolver el campo de la contraseña, ni siquiera hasheada.
        const users = await db.all("SELECT id, username, role FROM users ORDER BY username");
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
 * @desc    Actualizar un usuario (rol y, opcionalmente, contraseña)
 * @access  Private (admin)
 */
router.put('/:id', authenticateToken, authorizeRoles(['admin']), validateUserData, async (req, res) => {
    const { username, password, role } = req.body;
    
    try {
        let result;
        if (password) {
            // Si se proporciona una nueva contraseña, se hashea y se actualiza
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            result = await db.run(
                'UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?', 
                [username, hashedPassword, role, req.params.id]
            );
        } else {
            // Si no se proporciona contraseña, solo se actualiza username y role
            result = await db.run(
                'UPDATE users SET username = ?, role = ? WHERE id = ?', 
                [username, role, req.params.id]
            );
        }

        if (result.changes > 0) {
            res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado.' });
        }
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
        // MEDIDA DE SEGURIDAD CRÍTICA: Un admin no puede eliminarse a sí mismo.
        // El ID del admin que hace la petición está en req.user.id (del token).
        if (parseInt(req.params.id, 10) === req.user.id) {
            return res.status(403).json({ message: 'Acción prohibida. No puede eliminar su propia cuenta de administrador.' });
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