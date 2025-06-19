// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbPromise = require('../db');
require('dotenv').config(); // Asegurarnos de que las variables de entorno estén cargadas

// Obtenemos la instancia de la base de datos una vez que esté lista
let db;
dbPromise.then(database => {
    db = database;
}).catch(err => {
    console.error("Error al inicializar la base de datos para las rutas de autenticación:", err);
});

// Clave secreta para JWT, obtenida desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET no está definida en las variables de entorno.");
    process.exit(1); // Detiene la aplicación si la clave no está configurada
}

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar un usuario y devolver un token JWT
 * @access  Public
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Validación básica de entrada
    if (!username || !password) {
        return res.status(400).json({ message: 'Se requiere nombre de usuario y contraseña.' });
    }

    try {
        // 1. Buscar al usuario en la base de datos
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

        // Si el usuario no existe, enviamos una respuesta genérica para no dar pistas a atacantes
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 2. Comparar la contraseña proporcionada con la hasheada en la DB
        const isMatch = await bcrypt.compare(password, user.password);

        // Si las contraseñas no coinciden, misma respuesta genérica
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 3. Si todo es correcto, crear el payload para el token
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        // 4. Firmar el token JWT
        const token = jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '8h' } // Se recomienda una expiración razonable (ej: 8 horas)
        );

        // 5. Enviar la respuesta con el token y datos útiles para el frontend
        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (err) {
        console.error('Error en el proceso de login:', err);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;