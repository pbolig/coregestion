// backend/db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Conectado a la base de datos SQLite.');
});

// Crear tablas (solo si no existen)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        cuit TEXT UNIQUE,
        direccion TEXT,
        telefono TEXT,
        email TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS insumos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        stock INTEGER NOT NULL,
        unidad TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS presupuestos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        fecha TEXT,
        total REAL,
        estado TEXT,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS presupuesto_insumos (
        presupuesto_id INTEGER,
        insumo_id INTEGER,
        cantidad INTEGER,
        FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id),
        FOREIGN KEY (insumo_id) REFERENCES insumos(id),
        PRIMARY KEY (presupuesto_id, insumo_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS cuentas_corrientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        fecha TEXT,
        concepto TEXT,
        monto REAL,
        tipo TEXT, -- 'DEBE' o 'HABER'
        saldo_anterior REAL,
        saldo_actual REAL,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    )`);

    // Insertar usuario de prueba (solo si no existe)
    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('admin123', salt);
    db.get(`SELECT id FROM users WHERE username = ?`, ['admin'], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, ['admin', hashedPassword, 'admin'], (err) => {
                if (err) console.error(err.message);
                else console.log('Usuario admin creado.');
            });
        }
    });
});

module.exports = db;