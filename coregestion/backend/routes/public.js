// backend/routes/public.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const dbPromise = require('../db');
const { OAuth2Client } = require('google-auth-library'); // <-- Librería de Google
require('dotenv').config();

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // Guardaremos el ID en .env por seguridad

/**
 * @route   POST /api/public/register
 * @desc    Registro manual de un nuevo prospecto.
 * @access  Public
 */
router.post('/register', async (req, res) => {
    // ... (Esta ruta no cambia)
});


/**
 * @route   POST /api/public/login
 * @desc    Login manual de un prospecto.
 * @access  Public
 */
router.post('/login', async (req, res) => {
    // ... (Esta ruta no cambia)
});


/**
 * @route   POST /api/public/google-auth
 * @desc    NUEVA RUTA: Autentica a un usuario usando un token de ID de Google.
 * @access  Public
 */
router.post('/google-auth', async (req, res) => {
    const { token } = req.body;
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);

    try {
        // 1. Verificar el token de Google para asegurarse de que es válido.
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { name, email, picture } = payload; // Extraemos los datos del usuario de Google

        // 2. Buscar si el prospecto ya existe en nuestra base de datos.
        let prospecto = await db.get('SELECT * FROM prospectos WHERE email = ?', [email]);

        if (!prospecto) {
            // 3. Si no existe, lo creamos automáticamente.
            console.log(`Creando nuevo prospecto desde Google: ${email}`);
            // Se crea sin contraseña, ya que siempre se autenticará con Google.
            const sql = `INSERT INTO prospectos (nombre, email, password, estado) VALUES (?, ?, ?, ?)`;
            await db.run(sql, [name, email, 'google-authenticated', 'Pendiente']);
            prospecto = await db.get('SELECT * FROM prospectos WHERE email = ?', [email]);
        }

        // 4. Si el prospecto no está aprobado, no puede iniciar sesión.
        if (prospecto.estado !== 'Aprobado') {
            return res.status(403).json({ 
                message: `¡Hola ${name}! Tu registro fue exitoso. Tu cuenta está ahora en estado '${prospecto.estado}'. Un administrador la revisará a la brevedad.` 
            });
        }
        
        // 5. Si existe y está aprobado, creamos nuestro propio token de sesión (JWT).
        const appPayload = {
            prospectoId: prospecto.id,
            nombre: prospecto.nombre,
            type: 'prospecto'
        };
        const appToken = jwt.sign(appPayload, JWT_SECRET, { expiresIn: '8h' });

        res.status(200).json({
            message: 'Inicio de sesión con Google exitoso.',
            token: appToken,
            prospecto: {
                id: prospecto.id,
                nombre: prospecto.nombre,
                empresa: prospecto.empresa
            }
        });

    } catch (error) {
        console.error("Error en la autenticación con Google:", error);
        res.status(401).json({ message: 'Autenticación con Google fallida. Token inválido.' });
    }
});


module.exports = router;