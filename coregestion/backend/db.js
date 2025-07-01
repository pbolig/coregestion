// backend/db.js

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.db');

async function initializeDatabase() {
    try {
        const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
        console.log('Conectado a la base de datos SQLite.');
        await db.exec('PRAGMA foreign_keys = ON;');
        await createTables(db);
        await seedData(db);
        console.log('La base de datos ha sido inicializada correctamente.');
        return db;
    } catch (err) {
        console.error('Error al inicializar la base de datos:', err.message);
        process.exit(1);
    }
}

async function createTables(db) {
    return db.exec(`
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
        CREATE TABLE IF NOT EXISTS user_roles (user_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY (user_id, role_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, cuit TEXT UNIQUE, direccion TEXT, telefono TEXT, email TEXT);
        CREATE TABLE IF NOT EXISTS proveedores (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, cuit TEXT UNIQUE, telefono TEXT, email TEXT, direccion TEXT);
        
        CREATE TABLE IF NOT EXISTS insumos (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL,
            stock INTEGER NOT NULL,
            unidad TEXT,
            es_recurrente INTEGER DEFAULT 0, -- 0 para no, 1 para sí
            estado TEXT DEFAULT 'Disponible',
            precio_unitario REAL DEFAULT 0.0,
            cantidad_pendiente INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS presupuestos (id INTEGER PRIMARY KEY, cliente_id INTEGER, fecha TEXT, total REAL, estado TEXT, FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS presupuesto_insumos (presupuesto_id INTEGER NOT NULL, insumo_id INTEGER NOT NULL, cantidad INTEGER, PRIMARY KEY (presupuesto_id, insumo_id), FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE, FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT);
        CREATE TABLE IF NOT EXISTS presupuesto_pendientes (id INTEGER PRIMARY KEY, presupuesto_id INTEGER NOT NULL, insumo_id INTEGER NOT NULL, cantidad_necesaria INTEGER NOT NULL, estado TEXT DEFAULT 'Pendiente', FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE, FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS compras_insumos (id INTEGER PRIMARY KEY, fecha_comprobante TEXT NOT NULL, proveedor_id INTEGER NOT NULL, porcentaje_descuento REAL DEFAULT 0.0, total_compra REAL DEFAULT 0.0, FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT);
        CREATE TABLE IF NOT EXISTS detalle_compras_insumos (compra_id INTEGER NOT NULL, insumo_id INTEGER NOT NULL, cantidad INTEGER NOT NULL, precio_unitario_compra REAL NOT NULL, PRIMARY KEY (compra_id, insumo_id), FOREIGN KEY (compra_id) REFERENCES compras_insumos(id) ON DELETE CASCADE, FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT);
        CREATE TABLE IF NOT EXISTS prospectos (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, empresa TEXT, email TEXT UNIQUE NOT NULL, telefono TEXT, password TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'Pendiente', reset_token TEXT, reset_token_expires INTEGER);
        CREATE TABLE IF NOT EXISTS solicitudes_presupuesto (id INTEGER PRIMARY KEY, prospecto_id INTEGER NOT NULL, fecha_solicitud TEXT NOT NULL, descripcion_necesidad TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'Recibida', presupuesto_asociado_id INTEGER, FOREIGN KEY (prospecto_id) REFERENCES prospectos(id) ON DELETE CASCADE, FOREIGN KEY (presupuesto_asociado_id) REFERENCES presupuestos(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS conceptos_cc (id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL, tipo TEXT NOT NULL CHECK(tipo IN ('DEBE', 'HABER')), requiere_aplicacion INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS cuentas_corrientes (id INTEGER PRIMARY KEY, cliente_id INTEGER, fecha TEXT, concepto_id INTEGER, monto REAL, comprobante_origen_id INTEGER, saldo_anterior REAL, saldo_actual REAL, FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE, FOREIGN KEY (concepto_id) REFERENCES conceptos_cc(id));
        CREATE TABLE IF NOT EXISTS factura_gastos_adicionales (id INTEGER PRIMARY KEY, factura_id INTEGER NOT NULL, concepto TEXT NOT NULL, monto REAL NOT NULL, FOREIGN KEY (factura_id) REFERENCES facturas_venta(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS aplicaciones_pago (id INTEGER PRIMARY KEY, pago_id INTEGER NOT NULL, factura_id INTEGER NOT NULL, monto_aplicado REAL NOT NULL, FOREIGN KEY (pago_id) REFERENCES cuentas_corrientes(id) ON DELETE CASCADE, FOREIGN KEY (factura_id) REFERENCES facturas_venta(id) ON DELETE CASCADE);

        CREATE TABLE IF NOT EXISTS facturas_venta (
            id INTEGER PRIMARY KEY,
            presupuesto_id INTEGER,
            cliente_id INTEGER NOT NULL,
            fecha_emision TEXT NOT NULL,
            
            -- Numeración Interna/Remito
            punto_venta INTEGER,
            numero_comprobante INTEGER,

            -- Numeración Fiscal
            punto_venta_fiscal INTEGER,
            numero_comprobante_fiscal INTEGER,
            fecha_emision_fiscal TEXT,

            total_insumos REAL DEFAULT 0.0,
            total_gastos REAL DEFAULT 0.0,
            total_factura REAL NOT NULL,
            saldo_pendiente REAL NOT NULL,
            FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE SET NULL,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
        );

        --TABLA para gestionar los abonos/suscripciones
        CREATE TABLE IF NOT EXISTS abonos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            insumo_id INTEGER NOT NULL, -- El servicio recurrente que se contrató
            presupuesto_origen_id INTEGER, -- El presupuesto que generó este abono
            monto_recurrente REAL NOT NULL,
            frecuencia TEXT NOT NULL DEFAULT 'mensual', -- mensual, trimestral, anual
            proxima_fecha_facturacion TEXT NOT NULL,
            estado TEXT NOT NULL DEFAULT 'Activo', -- Activo, Cancelado
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
            FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT,
            FOREIGN KEY (presupuesto_origen_id) REFERENCES presupuestos(id) ON DELETE SET NULL
        );

    `);
}

/**
 * Inserta los datos de prueba en las tablas.
 * @param {object} db - La instancia de la base de datos.
 */
async function seedData(db) {
    const seedTableIfEmpty = async (tableName, data, columns) => {
        const countResult = await db.get(`SELECT COUNT(id) as count FROM ${tableName}`);
        if (countResult.count === 0) {
            console.log(`Tabla '${tableName}' está vacía. Precargando datos...`);
            const placeholders = columns.map(() => '?').join(',');
            const stmt = await db.prepare(`INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`);
            for (const item of data) {
                await stmt.run(columns.map(col => item[col]));
            }
            await stmt.finalize();
        }
    };
    
    // Roles
    const roles = ['admin', 'ventas', 'cobranzas', 'almacen', 'compras'];
    await seedTableIfEmpty('roles', roles.map(r => ({name: r})), ['name']);
    console.log('Roles por defecto asegurados.');

    // Admin User
    const adminExists = await db.get('SELECT id FROM users WHERE username = ?', 'admin');
    if (!adminExists) {
        const salt = await bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync('admin123', salt);
        const result = await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
        const adminId = result.lastID;
        const adminRole = await db.get("SELECT id FROM roles WHERE name = 'admin'");
        if (adminId && adminRole) {
            await db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [adminId, adminRole.id]);
        }
        console.log('Usuario admin creado y asignado rol.');
    }

    // Datos de prueba generales
    const clientesToInsert = [ { id: 1, nombre: 'Constructora del Litoral S.R.L.', cuit: '30-11223344-5', direccion: 'Av. Pellegrini 1234', telefono: '341-555-0101', email: 'pedro.bolig@valkimia.com' }, { id: 2, nombre: 'Juan Carlos Pérez (Consumidor Final)', cuit: '20-25678901-2', direccion: 'San Martín 567, Rosario', telefono: '341-555-0102', email: 'pedro.bolig@valkimia.com' }, { id: 3, nombre: 'Estudio de Arquitectura Moderno', cuit: '30-88776655-4', direccion: 'Córdoba 987, 5A', telefono: '341-555-0103', email: 'pedro.bolig@valkimia.com' } ];
    const proveedoresToInsert = [ { id: 1, nombre: 'Hierros Litoral', cuit: '33-55667788-9', telefono: '0341-455-8080', email: 'ventas@hierroslitoral.com', direccion: 'Uriburu 2500' }, { id: 2, nombre: 'Aberturas Rosario', cuit: '30-12312312-3', telefono: '0341-433-2020', email: 'info@aberturasrosario.com', direccion: 'Ov. Lagos 3100' }, { id: 3, nombre: 'El Tornillo de Oro', cuit: '20-99887766-5', telefono: '0341-466-1010', email: 'tornillos@oro.com', direccion: 'San Nicolás 1500' } ];
    const insumosToInsert = [
        { id: 1, nombre: 'Generador Diesel 5kW', stock: 10, unidad: 'unidad', es_recurrente: 0, precio_unitario: 1500000.00 },
        { id: 2, nombre: 'Cable Subterráneo 2x4mm', stock: 500, unidad: 'metro', es_recurrente: 0, precio_unitario: 1200.50 },
        { id: 5, nombre: 'Abono Mantenimiento Básico', stock: 1000, unidad: 'servicio', es_recurrente: 1, precio_unitario: 25000.00 },
        // ... otros insumos
    ];

    await seedTableIfEmpty('clientes', clientesToInsert, ['id', 'nombre', 'cuit', 'direccion', 'telefono', 'email']);
    await seedTableIfEmpty('proveedores', proveedoresToInsert, ['id', 'nombre', 'cuit', 'telefono', 'email', 'direccion']);
    await seedTableIfEmpty('insumos', insumosToInsert, ['id', 'nombre', 'stock', 'unidad', 'estado', 'es_recurrente','precio_unitario', 'cantidad_pendiente']);
    
    // Conceptos de C/C
    const conceptosCC = [ { nombre: 'Factura de Venta', tipo: 'DEBE', requiere_aplicacion: 0 }, { nombre: 'Nota de Débito (Servicios)', tipo: 'DEBE', requiere_aplicacion: 0 }, { nombre: 'Pago de Cliente', tipo: 'HABER', requiere_aplicacion: 1 }, { nombre: 'Nota de Crédito', tipo: 'HABER', requiere_aplicacion: 0 } ];
    await seedTableIfEmpty('conceptos_cc', conceptosCC, ['nombre', 'tipo', 'requiere_aplicacion']);
    
    // Prospectos
    const prospectosToInsert = [ { nombre: 'Ana García', empresa: 'Eventos del Sol', email: 'ana.garcia@eventos.com', telefono: '341-333-4444', password: 'password123' }, { nombre: 'Carlos Rodriguez', empresa: 'Fletes Express', email: 'carlos.r@fletes.com', telefono: '341-222-1111', password: 'password456' } ];
    const prospectoCount = await db.get('SELECT COUNT(id) as count FROM prospectos');
    if (prospectoCount.count === 0) {
        console.log("Tabla 'prospectos' vacía. Precargando datos...");
        const stmt = await db.prepare('INSERT INTO prospectos (nombre, empresa, email, telefono, password, estado) VALUES (?, ?, ?, ?, ?, ?)');
        for (const p of prospectosToInsert) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(p.password, salt);
            await stmt.run(p.nombre, p.empresa, p.email, p.telefono, hashedPassword, 'Pendiente');
        }
        await stmt.finalize();
    }
}

module.exports = initializeDatabase();