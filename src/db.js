import pg from "pg";

let pool;
let _readOnly = true;

export function init({
  connectionString,
  readOnly = true,
  statementTimeout = 30000,
} = {}) {
  _readOnly = readOnly;

  const poolConfig = {
    statement_timeout: statementTimeout,
  };

  if (connectionString) {
    poolConfig.connectionString = connectionString;
  } else {
    poolConfig.host = process.env.PGHOST || "localhost";
    poolConfig.port = parseInt(process.env.PGPORT || "5432");
    poolConfig.user = process.env.PGUSER || "postgres";
    poolConfig.password = process.env.PGPASSWORD || "postgres";
    poolConfig.database = process.env.PGDATABASE || "postgres";
  }

  pool = new pg.Pool(poolConfig);
}

export function isReadOnly() {
  return _readOnly;
}

export async function query(sql, params = []) {
  if (_readOnly) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql, params);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
  return pool.query(sql, params);
}

export async function close() {
  await pool.end();
}
