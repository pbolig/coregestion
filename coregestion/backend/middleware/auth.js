// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'tu_secreto_super_seguro_cambialo_en_produccion';

const authenticateToken = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1]; // Espera "Bearer TOKEN"

	if (!token) {
		return res.status(401).json({ message: 'Token de autenticación requerido.' });
	}

	jwt.verify(token, JWT_SECRET, (err, user) => {
		if (err) {
			return res.status(403).json({ message: 'Token inválido o expirado.' });
		}
		req.user = user; // Guarda la información del usuario en la solicitud
		next();
	});
};

const authorizeRoles = (roles) => {
	return (req, res, next) => {
		if (!req.user || !roles.includes(req.user.role)) {
			return res.status(403).json({ message: 'No tiene permisos para acceder a este recurso.' });
		}
		next();
	};
};

module.exports = { authenticateToken, authorizeRoles };