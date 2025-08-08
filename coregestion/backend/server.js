// backend/server.js
const express = require('express');
const path = require('path');
// Le decimos a dotenv que busque el archivo .env en esta misma carpeta.
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./db');
const scheduler = require('./scheduler');

const app = express();

// Middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "accounts.google.com", "cdn.jsdelivr.net"],
        },
    },
}));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// --- RUTAS DE API ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/portal', require('./routes/portal'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/insumos', require('./routes/insumos'));
app.use('/api/presupuestos', require('./routes/presupuestos'));
app.use('/api/cuentas-corrientes', require('./routes/cuentas_corrientes'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/solicitudes', require('./routes/solicitudes'));
app.use('/api/conceptos-cc', require('./routes/conceptos_cc'));
app.use('/api/facturacion', require('./routes/facturacion'));
app.use('/api/abonos', require('./routes/abonos'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/ayuda', require('./routes/ayuda'));

// RUTA CATCH-ALL para la SPA
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Algo salió mal en el servidor!', error: err.message });
});

const PORT = process.env.PORT || 3000;

// --- ARRANQUE DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Servidor CoreGestión corriendo en http://localhost:${PORT}`);
    console.log(`====================================================`);
    scheduler.iniciarScheduler();
});