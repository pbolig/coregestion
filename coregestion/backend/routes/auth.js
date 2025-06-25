// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbPromise = require('../db');
require('dotenv').config();

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

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
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Se requiere nombre de usuario y contraseña.' });
    }

    try {
        // 1. Buscar al usuario en la tabla 'users'.
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 2. Comparar la contraseña.
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 3. Obtener TODOS los roles del usuario desde la base de datos.
        const rolesRows = await db.all(`
            SELECT r.name FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = ?
        `, [user.id]);

        // Convertimos el array de objetos [{name: 'admin'}, {name: 'ventas'}] a un array de strings ['admin', 'ventas']
        const userRoles = rolesRows.map(row => row.name);

        // 4. Crear el payload para el token, incluyendo el array de roles.
        const payload = {
            id: user.id,
            username: user.username,
            roles: userRoles // El payload ahora contiene una lista de roles.
        };

        // 5. Firmar el token JWT.
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

        // 6. Enviar la respuesta con el token y la información del usuario (incluyendo sus roles).
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