'use strict';
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('./env');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

// Executa uma consulta (usa a conexao da transacao quando fornecida).
async function query(sql, params = [], conn = null) {
  const [rows] = await (conn || getPool()).query(sql, params);
  return rows;
}

async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Cria o schema (database/schema.sql). O script usa IF NOT EXISTS, entao pode rodar sempre.
async function migrate() {
  const arquivo = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(arquivo, 'utf8').replace(/rpg_gemini/g, config.db.name);
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  try {
    await conn.query(sql);
  } finally {
    await conn.end();
  }
}

async function fechar() {
  if (pool) await pool.end();
  pool = null;
}

module.exports = { getPool, query, withTransaction, migrate, fechar };
