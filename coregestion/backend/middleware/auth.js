// backend/middleware/auth.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_dev';

/**
 * Middleware para verificar el Token JWT.
 * El funcionamiento no cambia, pero ahora el 'req.user' que genera
 * contendrá un array de roles: { id: 1, username: 'admin', roles: ['admin', 'ventas'] }
 */
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (!token) {
            return res.status(401).json({ message: 'Acceso denegado. Se requiere un token.' });
        }
        
        const decodedUser = jwt.verify(token, JWT_SECRET);
        req.user = decodedUser;
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Token expirado. Por favor, inicie sesión de nuevo.' });
        }
        return res.status(403).json({ message: 'Token inválido.' });
    }
};

/**
 * Middleware para autorizar el acceso basado en una lista de roles permitidos.
 * Ahora verifica si el usuario tiene AL MENOS UNO de los roles requeridos.
 * @param {string[]} allowedRoles - Un array de roles que tienen permiso (ej: ['admin', 'ventas']).
 */
const authorizeRoles = (allowedRoles) => {
    return (req, res, next) => {
        // Obtenemos el array de roles del usuario desde el token decodificado.
        const userRoles = req.user?.roles;

        if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
            return res.status(403).json({ message: 'Acción prohibida. No se pudieron determinar los roles del usuario.' });
        }

        // Verificamos si hay alguna coincidencia entre los roles del usuario y los roles permitidos.
        // El método .some() devuelve true si al menos un elemento del array cumple la condición.
        const hasPermission = userRoles.some(role => allowedRoles.includes(role));
        
        if (!hasPermission) {
            return res.status(403).json({ message: 'Acción prohibida. No tiene los permisos necesarios para este recurso.' });
        }

        // Si tiene permiso, continuamos.
        next();
    };
};

module.exports = { 
    authenticateToken, 
    authorizeRoles 
};