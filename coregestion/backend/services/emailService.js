// backend/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Verificación de seguridad al iniciar
if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("[EMAIL-SERVICE] ERROR: Las credenciales EMAIL_USER y EMAIL_PASS no están definidas en el archivo .env. El servicio de correo no funcionará.");
}

// Configuración del "transportador" de nodemailer para usar Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
    tls: {
        // Esta opción es para entornos de desarrollo y evita errores de certificado.
        // En producción, se debería investigar la causa raíz (antivirus, proxy).
        rejectUnauthorized: false
    }
});

/**
 * Función genérica para enviar correos electrónicos.
 * @param {object} mailOptions - Un objeto con las opciones del correo (to, subject, html, attachments).
 * @returns {Promise<any>} - Una promesa que resuelve cuando el correo es enviado.
 */
async function sendEmail(mailOptions) {
    // Se establece el remitente por defecto para todos los correos.
    const optionsWithFrom = {
        ...mailOptions,
        from: `"CoreGestión" <${EMAIL_USER}>`,
    };

    try {
        console.log(`[EMAIL-SERVICE] Intentando enviar correo a: ${optionsWithFrom.to}`);
        const info = await transporter.sendMail(optionsWithFrom);
        console.log(`[EMAIL-SERVICE] Correo enviado exitosamente. Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[EMAIL-SERVICE] Error al enviar correo:`, error);
        // Relanzamos el error para que la ruta que lo llamó pueda manejarlo.
        throw new Error('Falló el envío del correo electrónico.');
    }
}

module.exports = { sendEmail };
