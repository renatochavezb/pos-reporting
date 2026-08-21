/* Aplica un archivo .sql contra Supabase.  Uso: node aplicar_sql.mjs <ruta.sql> */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const ruta = process.argv[2];
if (!ruta) { console.error('Falta la ruta del .sql'); process.exit(1); }

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query(readFileSync(ruta, 'utf8'));
  console.log(`OK: aplicado ${ruta}`);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
