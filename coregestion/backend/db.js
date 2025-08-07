// backend/db.js
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'database.db');
let db;

try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('Conectado a la base de datos con better-sqlite3.');
    
    createTables(db);
    seedData(db); // Se llama a la función de seeding completa
    
    console.log('La base de datos ha sido inicializada correctamente.');
} catch (err) {
    console.error('Error al inicializar la base de datos:', err.message);
    process.exit(1);
}

function createTables(db) {
    // Esta función ya estaba correcta, la mantenemos.
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
        CREATE TABLE IF NOT EXISTS user_roles (user_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY (user_id, role_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, cuit TEXT UNIQUE, direccion TEXT, telefono TEXT, email TEXT);
        CREATE TABLE IF NOT EXISTS proveedores (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, cuit TEXT UNIQUE, telefono TEXT, email TEXT, direccion TEXT);
        CREATE TABLE IF NOT EXISTS insumos (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, stock INTEGER NOT NULL, unidad TEXT, es_recurrente INTEGER DEFAULT 0, estado TEXT DEFAULT 'Disponible', precio_unitario REAL DEFAULT 0.0, cantidad_pendiente INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS presupuestos (id INTEGER PRIMARY KEY, cliente_id INTEGER, fecha TEXT, total REAL, estado TEXT, FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS presupuesto_insumos (presupuesto_id INTEGER NOT NULL, insumo_id INTEGER NOT NULL, cantidad INTEGER, PRIMARY KEY (presupuesto_id, insumo_id), FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE, FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT);
        CREATE TABLE IF NOT EXISTS presupuesto_pendientes (id INTEGER PRIMARY KEY, presupuesto_id INTEGER NOT NULL, insumo_id INTEGER NOT NULL, cantidad_necesaria INTEGER NOT NULL, estado TEXT DEFAULT 'Pendiente', FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE, FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS compras_insumos (id INTEGER PRIMARY KEY, fecha_comprobante TEXT NOT NULL, proveedor_id INTEGER NOT NULL, porcentaje_descuento REAL DEFAULT 0.0, total_compra REAL DEFAULT 0.0, FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT);
        CREATE TABLE IF NOT EXISTS detalle_compras_insumos (compra_id INTEGER NOT NULL, insumo_id INTEGER NOT NULL, cantidad INTEGER NOT NULL, precio_unitario_compra REAL NOT NULL, PRIMARY KEY (compra_id, insumo_id), FOREIGN KEY (compra_id) REFERENCES compras_insumos(id) ON DELETE CASCADE, FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT);
        CREATE TABLE IF NOT EXISTS prospectos (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, empresa TEXT, email TEXT UNIQUE NOT NULL, telefono TEXT, password TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'Pendiente', reset_token TEXT, reset_token_expires INTEGER);
        CREATE TABLE IF NOT EXISTS solicitudes_presupuesto (id INTEGER PRIMARY KEY, prospecto_id INTEGER NOT NULL, fecha_solicitud TEXT NOT NULL, descripcion_necesidad TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'Recibida', presupuesto_asociado_id INTEGER, FOREIGN KEY (prospecto_id) REFERENCES prospectos(id) ON DELETE CASCADE, FOREIGN KEY (presupuesto_asociado_id) REFERENCES presupuestos(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS conceptos_cc (id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL, tipo TEXT NOT NULL CHECK(tipo IN ('DEBE', 'HABER')), requiere_aplicacion INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS cuentas_corrientes (id INTEGER PRIMARY KEY, cliente_id INTEGER, fecha TEXT, concepto_id INTEGER, monto REAL, comprobante_origen_id INTEGER, saldo_anterior REAL, saldo_actual REAL, FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE, FOREIGN KEY (concepto_id) REFERENCES conceptos_cc(id));
        CREATE TABLE IF NOT EXISTS facturas_venta (id INTEGER PRIMARY KEY, presupuesto_id INTEGER, cliente_id INTEGER NOT NULL, fecha_emision TEXT NOT NULL, punto_venta INTEGER, numero_comprobante INTEGER, punto_venta_fiscal INTEGER, numero_comprobante_fiscal INTEGER, fecha_emision_fiscal TEXT, total_insumos REAL DEFAULT 0.0, total_gastos REAL DEFAULT 0.0, total_factura REAL NOT NULL, saldo_pendiente REAL NOT NULL, FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE SET NULL, FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS factura_gastos_adicionales (id INTEGER PRIMARY KEY, factura_id INTEGER NOT NULL, concepto TEXT NOT NULL, monto REAL NOT NULL, FOREIGN KEY (factura_id) REFERENCES facturas_venta(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS aplicaciones_pago (id INTEGER PRIMARY KEY, pago_id INTEGER NOT NULL, factura_id INTEGER NOT NULL, monto_aplicado REAL NOT NULL, FOREIGN KEY (pago_id) REFERENCES cuentas_corrientes(id) ON DELETE CASCADE, FOREIGN KEY (factura_id) REFERENCES facturas_venta(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS abonos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, insumo_id INTEGER NOT NULL, presupuesto_origen_id INTEGER, monto_recurrente REAL NOT NULL, frecuencia TEXT NOT NULL DEFAULT 'mensual', proxima_fecha_facturacion TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'Activo', FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE, FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT, FOREIGN KEY (presupuesto_origen_id) REFERENCES presupuestos(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS email_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, attachments TEXT, status TEXT NOT NULL DEFAULT 'pendiente', retry_count INTEGER DEFAULT 0, last_attempt TEXT, error_message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    `);
}

/**
 * Inserta los datos de prueba en las tablas.
 * @param {Database} db - La instancia de la base de datos.
 */
function seedData(db) {
    const seed = db.transaction(() => {
        // Helper para no repetir código
        const seedTable = (tableName, data, columns) => {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
            if (count === 0) {
                console.log(`Tabla '${tableName}' vacía. Precargando datos...`);
                const placeholders = columns.map(() => '?').join(',');
                const stmt = db.prepare(`INSERT OR IGNORE INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`);
                data.forEach(item => stmt.run(columns.map(col => item[col])));
            }
        };

        // Roles
        const roles = ['admin', 'ventas', 'cobranzas', 'almacen', 'compras'];
        seedTable('roles', roles.map(r => ({name: r})), ['name']);

        // Admin User
        const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        if (!adminExists) {
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync('admin123', salt);
            const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hashedPassword);
            const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();
            if (lastInsertRowid && adminRole) {
                db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(lastInsertRowid, adminRole.id);
            }
            console.log('Usuario admin creado y asignado rol.');
        }

        // Datos de prueba
        const clientes = [ { id: 1, nombre: 'Constructora del Litoral S.R.L.', cuit: '30-11223344-5', direccion: 'Av. Pellegrini 1234', telefono: '341-555-0101', email: 'pedro.bolig@valkimia.com' }, { id: 2, nombre: 'Juan Carlos Pérez (Consumidor Final)', cuit: '20-25678901-2', direccion: 'San Martín 567, Rosario', telefono: '341-555-0102', email: 'pedro.bolig@valkimia.com' }, { id: 3, nombre: 'Estudio de Arquitectura Moderno', cuit: '30-88776655-4', direccion: 'Córdoba 987, 5A', telefono: '341-555-0103', email: 'pedro.bolig@valkimia.com' } ];
        const proveedores = [ { id: 1, nombre: 'Hierros Litoral', cuit: '33-55667788-9', telefono: '0341-455-8080', email: 'ventas@hierroslitoral.com', direccion: 'Uriburu 2500' }, { id: 2, nombre: 'Aberturas Rosario', cuit: '30-12312312-3', telefono: '0341-433-2020', email: 'info@aberturasrosario.com', direccion: 'Ov. Lagos 3100' }, { id: 3, nombre: 'El Tornillo de Oro', cuit: '20-99887766-5', telefono: '0341-466-1010', email: 'tornillos@oro.com', direccion: 'San Nicolás 1500' } ];
        const insumos = [
            { id: 1, nombre: 'Generador Diesel 5kW', stock: 10, unidad: 'unidad', es_recurrente: 0, precio_unitario: 1500000.00 },
            { id: 2, nombre: 'Cable Subterráneo 2x4mm', stock: 500, unidad: 'metro', es_recurrente: 0, precio_unitario: 1200.50 },
            { id: 5, nombre: 'Abono Mantenimiento Básico', stock: 1000, unidad: 'servicio', es_recurrente: 1, precio_unitario: 25000.00 },
        ];
        const conceptosCC = [ { nombre: 'Factura de Venta', tipo: 'DEBE', requiere_aplicacion: 0 }, { nombre: 'Nota de Débito (Servicios)', tipo: 'DEBE', requiere_aplicacion: 0 }, { nombre: 'Pago de Cliente', tipo: 'HABER', requiere_aplicacion: 1 }, { nombre: 'Nota de Crédito', tipo: 'HABER', requiere_aplicacion: 0 } ];

        seedTable('clientes', clientes, ['id', 'nombre', 'cuit', 'direccion', 'telefono', 'email']);
        seedTable('proveedores', proveedores, ['id', 'nombre', 'cuit', 'telefono', 'email', 'direccion']);
        seedTable('insumos', insumos.map(i => ({...i, estado: 'Disponible', cantidad_pendiente: 0})), ['id', 'nombre', 'stock', 'unidad', 'es_recurrente', 'precio_unitario', 'estado', 'cantidad_pendiente']);
        seedTable('conceptos_cc', conceptosCC, ['nombre', 'tipo', 'requiere_aplicacion']);

        // System Config
        const stmtConfig = db.prepare("INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)");
        stmtConfig.run('backup_enabled', 'true');
        stmtConfig.run('backup_frequency', 'diario');
        stmtConfig.run('backup_notification_email', 'pedro.bolig@gmail.com');
        stmtConfig.run('backup_retention_count', '7');
        stmtConfig.run('backup_hour', '03');
    });

    seed();
}

module.exports = db;