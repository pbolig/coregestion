// backend/services/emailService.js
const nodemailer = require('nodemailer');
const db = require('../db'); // Importa la conexión a better-sqlite3
require('dotenv').config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    tls: { rejectUnauthorized: false }
});

/**
 * Función de envío de correos mejorada con sistema de cola.
 * @param {object} mailOptions - Opciones del correo (to, subject, html, attachments).
 */
async function sendEmail(mailOptions) {
    const optionsWithFrom = { ...mailOptions, from: `"CoreGestión" <${EMAIL_USER}>` };

    try {
        const info = await transporter.sendMail(optionsWithFrom);
        console.log(`[EMAIL-SERVICE] Correo enviado a: ${optionsWithFrom.to}. Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[EMAIL-SERVICE-ERROR] Falló el envío a ${optionsWithFrom.to}. Encolando para reintento.`, error.message);
        try {
            const attachmentsString = optionsWithFrom.attachments ? JSON.stringify(optionsWithFrom.attachments) : null;
            const sql = `INSERT INTO email_queue (recipient, subject, body, attachments, status, error_message, retry_count) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const stmt = db.prepare(sql);
            stmt.run(
                optionsWithFrom.to,
                optionsWithFrom.subject,
                optionsWithFrom.html,
                attachmentsString,
                'fallido',
                error.message,
                1
            );
            console.log(`[EMAIL-SERVICE] Correo para ${optionsWithFrom.to} encolado exitosamente.`);
        } catch (dbError) {
            console.error(`[EMAIL-SERVICE-FATAL] Falló el envío Y TAMBIÉN falló el registro en la cola.`, dbError);
        }
    }
}

module.exports = { sendEmail };