import "dotenv/config";
import { createPool, type Pool } from "mysql2/promise";

const port = Number(process.env.MYSQL_PORT ?? 3306);

export const pool: Pool = createPool({
  host: process.env.MYSQL_HOST ?? "localhost",
  port,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

let poolClosed = false;

export async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function closePool(): Promise<void> {
  if (poolClosed) return;
  poolClosed = true;
  await pool.end();
}
