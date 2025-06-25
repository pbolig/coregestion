// backend/server.js

// --- IMPORTACIONES DE PAQUETES ---
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// --- CONEXIÓN A LA BASE DE DATOS ---
const db = require('./db');

// --- INICIALIZACIÓN DE EXPRESS ---
const app = express();

// --- MIDDLEWARES GENERALES ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "accounts.google.com"],
            "connect-src": ["'self'", "accounts.google.com"],
            "frame-src": ["'self'", "accounts.google.com"],
        },
    },
}));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// --- CONFIGURACIÓN PARA SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND ---
app.use(express.static(path.join(__dirname, '../frontend')));

// --- RUTAS DE API ---
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const portalRoutes = require('./routes/portal');
const userRoutes = require('./routes/users');
const clienteRoutes = require('./routes/clientes');
const insumoRoutes = require('./routes/insumos');
const presupuestoRoutes = require('./routes/presupuestos');
const cuentaCorrienteRoutes = require('./routes/cuentas_corrientes');
const proveedorRoutes = require('./routes/proveedores');
const roleRoutes = require('./routes/roles');
const compraRoutes = require('./routes/compras');
const prospectoRoutes = require('./routes/prospectos');
const solicitudRoutes = require('./routes/solicitudes');

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/insumos', insumoRoutes);
app.use('/api/presupuestos', presupuestoRoutes);
app.use('/api/cuentas-corrientes', cuentaCorrienteRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/prospectos', prospectoRoutes);
app.use('/api/solicitudes', solicitudRoutes);

// --- RUTA CATCH-ALL PARA EL FRONTEND (MANEJO DE SPA) ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- MIDDLEWARE DE MANEJO DE ERRORES ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Algo salió mal en el servidor!', error: err.message });
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
    console.log(`Accede a la aplicación en: http://localhost:${PORT}`);
});