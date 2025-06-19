// backend/db.js

// --- IMPORTACIONES ---
// Se usa 'sqlite' como una capa sobre 'sqlite3' para poder usar async/await
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite'); 
const bcrypt = require('bcryptjs');
const path = require('path');

// Constante para la ruta del archivo de la base de datos
const DB_PATH = path.join(__dirname, 'database.db');

/**
 * Función principal asíncrona para inicializar la base de datos.
 * Encapsula la apertura, creación de esquema y siembra de datos.
 */
async function initializeDatabase() {
    try {
        // Abre la conexión a la base de datos
        const db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        console.log('Conectado a la base de datos SQLite.');

        // Habilitar claves foráneas (muy importante para la integridad de datos)
        await db.exec('PRAGMA foreign_keys = ON;');

        // Ejecutar la creación de tablas
        await createTables(db);

        // Insertar datos iniciales (solo si es necesario)
        await seedData(db);

        console.log('La base de datos ha sido inicializada correctamente.');
        return db;

    } catch (err) {
        console.error('Error al inicializar la base de datos:', err.message);
        // Si hay un error crítico al iniciar, cerramos el proceso para evitar
        // que la aplicación corra en un estado inconsistente.
        process.exit(1);
    }
}

/**
 * Crea todas las tablas de la aplicación si no existen.
 * @param {object} db - La instancia de la base de datos.
 */
async function createTables(db) {
    // Usamos db.exec para ejecutar múltiples sentencias SQL
    return db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            cuit TEXT UNIQUE,
            direccion TEXT,
            telefono TEXT,
            email TEXT
        );
        CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            cuit TEXT UNIQUE,
            telefono TEXT,
            email TEXT,
            direccion TEXT
        );
        CREATE TABLE IF NOT EXISTS insumos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            stock INTEGER NOT NULL,
            unidad TEXT,
            estado TEXT DEFAULT 'Disponible',
            precio_unitario REAL DEFAULT 0.0,
            cantidad_pendiente INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS presupuestos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            fecha TEXT,
            total REAL,
            estado TEXT,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS presupuesto_insumos (
            presupuesto_id INTEGER,
            insumo_id INTEGER,
            cantidad INTEGER,
            FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE,
            FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT,
            PRIMARY KEY (presupuesto_id, insumo_id)
        );
        CREATE TABLE IF NOT EXISTS cuentas_corrientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            fecha TEXT,
            concepto TEXT,
            monto REAL,
            tipo TEXT,
            saldo_anterior REAL,
            saldo_actual REAL,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS compras_insumos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha_comprobante TEXT NOT NULL,
            proveedor_id INTEGER NOT NULL,
            porcentaje_descuento REAL DEFAULT 0.0,
            total_compra REAL DEFAULT 0.0,
            FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT
        );
        CREATE TABLE IF NOT EXISTS detalle_compras_insumos (
            compra_id INTEGER NOT NULL,
            insumo_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio_unitario_compra REAL NOT NULL,
            PRIMARY KEY (compra_id, insumo_id),
            FOREIGN KEY (compra_id) REFERENCES compras_insumos(id) ON DELETE CASCADE,
            FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT
        );
    `);
}

/**
 * Inserta los datos de prueba en las tablas.
 * @param {object} db - La instancia de la base de datos.
 */
async function seedData(db) {
    // --- Insertar usuario admin ---
    const adminExists = await db.get('SELECT id FROM users WHERE username = ?', 'admin');
    if (!adminExists) {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync('admin123', salt);
        await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin']);
        console.log('Usuario admin creado.');
    }

    // --- Datos de prueba ---
    const clientesToInsert = [
        { id: 1, nombre: 'Empresa Demo S.A.', cuit: '30-12345678-9', direccion: 'Calle Falsa 123', telefono: '3415551234', email: 'demo@empresa.com' },
        { id: 2, nombre: 'Juan Pérez', cuit: '20-98765432-1', direccion: 'Av. Siempre Viva 742', telefono: '3416665678', email: 'juan.perez@example.com' }
    ];
    const insumosToInsert = [
        { id: 1, nombre: 'Cable HDMI', stock: 100, unidad: 'unidad', estado: 'Disponible', precio_unitario: 15.50, cantidad_pendiente: 0 },
        { id: 2, nombre: 'Mouse Óptico', stock: 50, unidad: 'unidad', estado: 'Disponible', precio_unitario: 25.00, cantidad_pendiente: 0 },
        { id: 3, nombre: 'Disco SSD 1TB', stock: 20, unidad: 'unidad', estado: 'Disponible', precio_unitario: 80.00, cantidad_pendiente: 0 },
        { id: 4, nombre: 'Servicio de Instalacion', stock: 9999, unidad: 'servicio', estado: 'Disponible', precio_unitario: 45.00, cantidad_pendiente: 0 },
        { id: 5, nombre: 'Monitor 24"', stock: 0, unidad: 'unidad', estado: 'Pendiente de Compra', precio_unitario: 120.00, cantidad_pendiente: 5 }
    ];
    const proveedoresToInsert = [
        { id: 1, nombre: 'Proveedor A S.A.', cuit: '30-99887766-5', telefono: '341-1111111', email: 'contacto@proveedora.com', direccion: 'Calle Primera 100' },
        { id: 2, nombre: 'Distribuidora B', cuit: '20-11223344-9', telefono: '341-2222222', email: 'ventas@distribuidorab.com', direccion: 'Avenida Siempre 200' }
    ];

    // --- Función genérica para insertar datos ---
    const seedTable = async (tableName, data, columns) => {
        // Prepara la sentencia de inserción una sola vez
        const placeholders = columns.map(() => '?').join(',');
        const stmt = await db.prepare(`INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`);
        
        for (const item of data) {
            const exists = await db.get(`SELECT id FROM ${tableName} WHERE id = ?`, item.id);
            if (!exists) {
                const values = columns.map(col => item[col]);
                await stmt.run(values);
                console.log(`Registro insertado en ${tableName}: ${item.nombre || item.id}`);
            }
        }
        await stmt.finalize(); // Cierra la sentencia preparada
    };

    // --- Ejecutar la inserción para cada tabla ---
    await seedTable('clientes', clientesToInsert, ['id', 'nombre', 'cuit', 'direccion', 'telefono', 'email']);
    await seedTable('insumos', insumosToInsert, ['id', 'nombre', 'stock', 'unidad', 'estado', 'precio_unitario', 'cantidad_pendiente']);
    await seedTable('proveedores', proveedoresToInsert, ['id', 'nombre', 'cuit', 'telefono', 'email', 'direccion']);
}


// Exportamos la promesa que resuelve a la instancia de la base de datos.
// Otros archivos que importen 'db' esperarán a que la inicialización esté completa.
module.exports = initializeDatabase();