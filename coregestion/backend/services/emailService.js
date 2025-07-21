// backend/services/emailService.js
const nodemailer = require('nodemailer');
const dbPromise = require('../db'); // Necesitamos acceso a la DB para la cola
require('dotenv').config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let db;
dbPromise.then(database => { db = database; }).catch(console.error);

// La configuración del transportador no cambia.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});

/**
 * Función de envío de correos mejorada con sistema de cola.
 * Intenta enviar un correo. Si falla, lo registra en la tabla 'email_queue'.
 * @param {object} mailOptions - Opciones del correo (to, subject, html, attachments).
 */
async function sendEmail(mailOptions) {
    const optionsWithFrom = {
        ...mailOptions,
        from: `"CoreGestión" <${EMAIL_USER}>`,
    };

    try {
        // --- INTENTO DE ENVÍO ---
        console.log(`[EMAIL-SERVICE] Intentando enviar correo a: ${optionsWithFrom.to}`);
        const info = await transporter.sendMail(optionsWithFrom);
        console.log(`[EMAIL-SERVICE] Correo enviado exitosamente. Message ID: ${info.messageId}`);
        return info;

    } catch (error) {
        // --- LÓGICA DE FALLO: REGISTRAR EN LA COLA ---
        console.error(`[EMAIL-SERVICE-ERROR] Falló el envío directo. Registrando en la cola de reintentos.`, error.message);
        
        try {
            if (!db) {
                db = await dbPromise; // Asegurarse de que la DB esté inicializada
            }
            
            // Convertimos los adjuntos a un string JSON para guardarlos en la DB.
            const attachmentsString = optionsWithFrom.attachments ? JSON.stringify(optionsWithFrom.attachments) : null;

            await db.run(
                `INSERT INTO email_queue (recipient, subject, body, attachments, status, error_message, retry_count) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    optionsWithFrom.to,
                    optionsWithFrom.subject,
                    optionsWithFrom.html,
                    attachmentsString,
                    'fallido', // Marcamos el estado como 'fallido'
                    error.message,
                    1 // Este es el primer intento (fallido)
                ]
            );
            console.log(`[EMAIL-SERVICE] Correo para ${optionsWithFrom.to} encolado exitosamente para reintento.`);

        } catch (dbError) {
            console.error(`[EMAIL-SERVICE-FATAL] Falló el envío Y TAMBIÉN falló el registro en la cola de emails.`, dbError);
        }
        
        // Importante: No relanzamos el error para que la aplicación principal no se detenga.
        // La notificación al usuario de que el email falló se manejará en la ruta que llamó a esta función.
    }
}

module.exports = { sendEmail };