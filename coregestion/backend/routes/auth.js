// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db'); // Importa la conexión a better-sqlite3
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET no está definida.");
    process.exit(1);
}

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar un usuario, obtener su lista de roles y devolver un token JWT.
 * @access  Public
 */
router.post('/login', async (req, res) => { // Mantenemos async por bcrypt
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Se requiere nombre de usuario y contraseña.' });
    }

    try {
        // 1. Buscar al usuario en la tabla 'users'.
        const userStmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const user = userStmt.get(username);
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 2. Comparar la contraseña (bcrypt es asíncrono, por eso mantenemos async).
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 3. Obtener TODOS los roles del usuario desde la base de datos.
        const rolesSql = `
            SELECT r.name FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = ?
        `;
        const rolesStmt = db.prepare(rolesSql);
        const rolesRows = rolesStmt.all(user.id);
        const userRoles = rolesRows.map(row => row.name);

        // 4. Crear el payload para el token.
        const payload = {
            id: user.id,
            username: user.username,
            roles: userRoles
        };

        // 5. Firmar el token JWT.
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

        // 6. Enviar la respuesta.
        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                id: user.id,
                username: user.username,
                roles: userRoles
            }
        });

    } catch (err) {
        console.error('Error en el proceso de login:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;