// backend/server.js
const express = require('express');
const app = express();
const cors = require('cors'); // Para permitir comunicación entre front y back en puertos diferentes
const path = require('path'); // Importa el módulo 'path' para trabajar con rutas de archivos
const db = require('./db'); // Importa la conexión a la DB

// Middleware generales que deben ir al principio
app.use(express.json()); // Para parsear JSON en las solicitudes
app.use(cors()); // Habilita CORS

// --- CONFIGURACIÓN PARA SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND ---
// La carpeta 'frontend' está en el mismo nivel que 'backend'
app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta principal del frontend (sirve index.html para la raíz del dominio)
// Si la dejas, colócala ANTES de app.get('*') para que tenga prioridad.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- Rutas de API ---
// Estas rutas deben ir ANTES de la ruta catch-all (app.get('*')) para que tengan prioridad
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clienteRoutes = require('./routes/clientes');
const insumoRoutes = require('./routes/insumos');
const presupuestoRoutes = require('./routes/presupuestos');
const cuentaCorrienteRoutes = require('./routes/cuentas_corrientes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/insumos', insumoRoutes);
app.use('/api/presupuestos', presupuestoRoutes);
app.use('/api/cuentas-corrientes', cuentaCorrienteRoutes);

// --- Ruta Catch-All para el Frontend (debe ir al final de todas las rutas de API) ---
// Sirve el index.html para cualquier ruta que no sea una API o un archivo estático conocido.
// Esto es importante para aplicaciones SPA y para manejar recargas en rutas como /dashboard.
app.get('*', (req, res, next) => {
    // Excluir rutas de API para que no intenten servir archivos estáticos del frontend
    // También se excluye favicon.ico que a veces el navegador pide automáticamente
    if (req.originalUrl.startsWith('/api/') || req.originalUrl === '/favicon.ico') {
        return next(); // Pasa al siguiente middleware/ruta
    }
    // Si la solicitud no es una API, sirve el index.html principal del frontend
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});


// Configuración del puerto y el inicio del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en el puerto ${PORT}`);
    console.log(`Accede a la aplicación en: http://localhost:${PORT}`);
});