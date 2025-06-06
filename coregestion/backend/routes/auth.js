// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = 'tu_secreto_super_seguro_cambialo_en_produccion'; // �Cambiar en producci�n!

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Error del servidor.' });
        }
        if (!user) {
            return res.status(401).json({ message: 'Usuario o contrase�a incorrectos.' });
        }

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Usuario o contrase�a incorrectos.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expira en 1 hora
        );

        res.json({ token, role: user.role });
    });
});

module.exports = router;