import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query('select count(*)::int as n from auth.users');
const e = await c.query('select email from auth.users limit 5');
console.log('USUARIOS EN AUTH:', r.rows[0].n);
e.rows.forEach(x => console.log('  -', x.email));
await c.end();
