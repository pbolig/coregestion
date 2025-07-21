// backend/routes/ayuda.js
const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const { authenticateToken } = require('../middleware/auth');

console.log("[AYUDA-DEBUG] Archivo de rutas de ayuda cargado por el servidor.");

/**
 * @route   GET /api/ayuda/manual
 * @desc    Lee el archivo manual.md, lo convierte a HTML y lo devuelve.
 * @access  Private
 */
router.get('/manual', authenticateToken, async (req, res) => {
    console.log("[AYUDA-DEBUG] Petición recibida en /api/ayuda/manual.");
    try {
        // Se construye la ruta absoluta al archivo del manual
        const markdownPath = path.join(__dirname, '..', '..', 'frontend', 'ayuda', 'manual.md');

        console.log(`[AYUDA-DEBUG] Intentando leer archivo desde la ruta absoluta: ${markdownPath}`);

        // Verificamos si el archivo realmente existe en esa ruta
        const fileExists = await fs.pathExists(markdownPath);
        if (!fileExists) {
            console.error(`[AYUDA-ERROR] ¡Archivo no encontrado! La ruta ${markdownPath} no es correcta. Verifique la estructura de carpetas: el archivo 'manual.md' debe estar dentro de 'frontend/ayuda/'.`);
            throw new Error('El archivo del manual (manual.md) no se encontró en el servidor.');
        }
        
        console.log("[AYUDA-DEBUG] Archivo encontrado. Leyendo contenido...");
        const markdownText = await fs.readFile(markdownPath, 'utf8');
        
        console.log("[AYUDA-DEBUG] Contenido leído. Convirtiendo a HTML...");
        const htmlContent = marked.parse(markdownText);
        
        console.log("[AYUDA-DEBUG] Conversión a HTML exitosa. Enviando respuesta.");
        res.status(200).json({ html: htmlContent });

    } catch (err) {
        console.error("[AYUDA-ERROR-FATAL] Falló el proceso en la ruta /manual:", err.message);
        res.status(500).json({ message: 'No se pudo cargar el contenido de la ayuda.', error: err.message });
    }
});

module.exports = router;
