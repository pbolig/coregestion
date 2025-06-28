// backend/routes/public.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const dbPromise = require('../db');
const { sendEmail } = require('../services/emailService'); // Se importa la función centralizada
require('dotenv').config();

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// Las credenciales de correo y el transporter ya no se definen aquí.

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = "336418262446-e7u9rdermb2f83m78pot0skmns5vq9g8.apps.googleusercontent.com";

router.post('/register', async (req, res) => {
    const { nombre, empresa, email, telefono, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ message: 'Nombre, email y contraseña son campos obligatorios.' });
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await db.run(`INSERT INTO prospectos (nombre, empresa, email, telefono, password) VALUES (?, ?, ?, ?, ?)`, [nombre, empresa, email, telefono, hashedPassword]);
        res.status(201).json({ message: 'Registro exitoso. Un representante se pondrá en contacto con usted.' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ message: 'El email ingresado ya se encuentra registrado.' });
        res.status(500).json({ message: 'Error en el servidor al intentar registrarse.', error: err.message });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Se requiere email y contraseña.' });
    try {
        const prospecto = await db.get('SELECT * FROM prospectos WHERE email = ?', [email]);
        if (!prospecto) return res.status(401).json({ message: 'Credenciales inválidas.' });
        if (prospecto.estado !== 'Aprobado') return res.status(403).json({ message: `Su cuenta está en estado '${prospecto.estado}'.` });
        const isMatch = await bcrypt.compare(password, prospecto.password);
        if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas.' });
        const payload = { prospectoId: prospecto.id, nombre: prospecto.nombre, type: 'prospecto' };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({ message: 'Inicio de sesión exitoso.', token, prospecto: { id: prospecto.id, nombre: prospecto.nombre, empresa: prospecto.empresa } });
    } catch (err) {
        res.status(500).json({ message: 'Error en el servidor al iniciar sesión.', error: err.message });
    }
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const prospecto = await db.get("SELECT * FROM prospectos WHERE email = ?", [email]);
        if (!prospecto) {
            return res.status(200).json({ message: "Si su correo electrónico está en nuestros registros, recibirá un enlace." });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = Date.now() + 3600000;
        await db.run("UPDATE prospectos SET reset_token = ?, reset_token_expires = ? WHERE id = ?", [resetToken, tokenExpires, prospecto.id]);
        
        const resetUrl = `http://localhost:3000/#/reset-password?token=${resetToken}`;
        
        await sendEmail({
            to: prospecto.email,
            subject: "Restablecimiento de Contraseña - CoreGestión",
            html: `<p>Hola ${prospecto.nombre},</p><p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p><a href="${resetUrl}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a><p>Este enlace expirará en 1 hora.</p>`,
        });

        res.status(200).json({ message: "Si su correo electrónico está en nuestros registros, recibirá un enlace." });
    } catch (error) {
        console.error("[FORGOT-PASS-ERROR] Falló el proceso de restablecimiento:", error);
        res.status(500).json({ message: "Ocurrió un error en el servidor." });
    }
});

router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token y nueva contraseña son requeridos." });
    try {
        const prospecto = await db.get("SELECT * FROM prospectos WHERE reset_token = ? AND reset_token_expires > ?", [token, Date.now()]);
        if (!prospecto) return res.status(400).json({ message: "El token es inválido o ha expirado." });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await db.run("UPDATE prospectos SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?", [hashedPassword, prospecto.id]);
        res.status(200).json({ message: "Contraseña actualizada exitosamente. Ya puedes iniciar sesión." });
    } catch (error) {
        console.error("Error en reset-password:", error);
        res.status(500).json({ message: "Ocurrió un error en el servidor." });
    }
});

router.post('/google-auth', async (req, res) => {
    const { token } = req.body;
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    try {
        const ticket = await client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        const { name, email } = payload;
        let prospecto = await db.get('SELECT * FROM prospectos WHERE email = ?', [email]);
        if (!prospecto) {
            await db.run(`INSERT INTO prospectos (nombre, email, password, estado) VALUES (?, ?, ?, ?)`, [name, email, 'google-authenticated', 'Pendiente']);
            prospecto = await db.get('SELECT * FROM prospectos WHERE email = ?', [email]);
        }
        if (prospecto.estado !== 'Aprobado') return res.status(403).json({ message: `¡Hola ${name}! Tu cuenta está en estado '${prospecto.estado}'.` });
        const appPayload = { prospectoId: prospecto.id, nombre: prospecto.nombre, type: 'prospecto' };
        const appToken = jwt.sign(appPayload, JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({ message: 'Inicio de sesión con Google exitoso.', token: appToken, prospecto: { id: prospecto.id, nombre: prospecto.nombre, empresa: prospecto.empresa } });
    } catch (error) {
        console.error("Error en la autenticación con Google:", error);
        res.status(401).json({ message: 'Autenticación con Google fallida. Token inválido.' });
    }
});


module.exports = router;