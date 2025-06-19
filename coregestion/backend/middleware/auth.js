// backend/middleware/auth.js

const jwt = require('jsonwebtoken');
require('dotenv').config(); // Carga las variables de entorno

// Obtenemos la clave secreta desde las variables de entorno para mayor seguridad.
// Si no está definida, usamos una clave por defecto (NO RECOMENDADO PARA PRODUCCIÓN).
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_dev';

/**
 * Middleware para verificar el Token JWT.
 * Este middleware se asegura de que la petición tenga un token válido y activo.
 */
const authenticateToken = (req, res, next) => {
    try {
        // 1. Obtener el encabezado de autorización
        const authHeader = req.headers['authorization'];

        // 2. Extraer el token (formato esperado: "Bearer TOKEN")
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        // 3. Validar si el token existe
        if (!token) {
            return res.status(401).json({ message: 'Acceso denegado. Se requiere un token de autenticación.' });
        }

        // 4. Verificar el token usando la clave secreta
        const decodedUser = jwt.verify(token, JWT_SECRET);

        // 5. Adjuntar la información del usuario decodificada al objeto 'req'
        // Esto permite que las siguientes rutas/middlewares accedan a los datos del usuario.
        req.user = decodedUser;
        
        // 6. Si todo es correcto, pasar al siguiente middleware/ruta
        next();

    } catch (error) {
        // Manejo de errores de JWT (ej: token inválido, expirado)
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Token expirado. Por favor, inicie sesión de nuevo.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ message: 'Token inválido.' });
        }
        // Para cualquier otro error inesperado
        return res.status(500).json({ message: 'Error interno del servidor al validar el token.' });
    }
};

/**
 * Middleware para autorizar el acceso basado en roles de usuario.
 * @param {string[]} allowedRoles - Un array de roles permitidos para acceder al recurso.
 * Ejemplo de uso: authorizeRoles(['admin']) o authorizeRoles(['admin', 'vendedor'])
 */
const authorizeRoles = (allowedRoles) => {
    return (req, res, next) => {
        // Se asume que authenticateToken ya se ejecutó y 'req.user' está disponible
        const userRole = req.user?.role;

        // 1. Verificar si el usuario tiene un rol
        if (!userRole) {
            return res.status(403).json({ message: 'Acción prohibida. No se pudo determinar el rol del usuario.' });
        }
        
        // 2. Verificar si el rol del usuario está en la lista de roles permitidos
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: 'Acción prohibida. No tiene los permisos necesarios para este recurso.' });
        }

        // 3. Si tiene el rol correcto, permitir el acceso
        next();
    };
};

module.exports = { 
    authenticateToken, 
    authorizeRoles 
};