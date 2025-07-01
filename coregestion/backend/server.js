// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const db = require('./db');
const scheduler = require('./scheduler');
const app = express();

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
const conceptosCCRoutes = require('./routes/conceptos_cc');
const facturacionRoutes = require('./routes/facturacion');
const abonosRoutes = require('./routes/abonos');
const reportesRoutes = require('./routes/reportes');

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
app.use('/api/conceptos-cc', conceptosCCRoutes);
app.use('/api/facturacion', facturacionRoutes);
app.use('/api/abonos', abonosRoutes);
app.use('/api/reportes', reportesRoutes);

// RUTA CATCH-ALL
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

// MANEJO DE ERRORES
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Algo salió mal en el servidor!', error: err.message });
});

// INICIO DEL SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
    console.log(`Accede a la aplicación en: http://localhost:${PORT}`);
    console.log(`====================================================`);
    
    // --- INICIAMOS EL PROGRAMADOR DE TAREAS ---
    scheduler.iniciarScheduler(); // <-- 2. LO PONEMOS EN MARCHA
});