/* ============================================================
   EXTRACTOR DE MERMA  ·  multi-sucursal -> Supabase
   ------------------------------------------------------------
   Recorre las sucursales de sucursales.json, lee su merma
   (solo lectura) y hace UPSERT en Supabase. Si una esta caida,
   la marca y sigue con las demas.
   Correr:  npm run merma
   ============================================================ */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sql from 'mssql';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COLS = [
  'sucursal', 'no_transaccion', 'tipo', 'fecha', 'fecha_hora', 'folio',
  'no_insumo', 'insumo', 'categoria', 'unidad', 'cantidad', 'costo_unitario',
  'importe', 'costo_confiable', 'motivo', 'usuario', 'modulo',
];

const sucursales = JSON.parse(readFileSync(join(__dirname, 'sucursales.json'), 'utf8'));
const consulta = readFileSync(join(__dirname, '..', 'sql', 'extraccion_merma.sql'), 'utf8');

async function leer(b) {
  const cfg = {
    server: b.host, port: b.port || 1433, user: b.user, password: b.pass, database: b.db,
    options: { encrypt: false, trustServerCertificate: true, useUTC: false },
    connectionTimeout: 30000, requestTimeout: 120000,
  };
  const pool = await sql.connect(cfg);
  try { return (await pool.request().query(consulta)).recordset; }
  finally { await pool.close(); }
}

const limpiar = (v) => (typeof v === 'string' ? v.trim() : v);
const norm = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

async function upsert(cliente, filas) {
  const LOTE = 100;
  for (let i = 0; i < filas.length; i += LOTE) {
    const trozo = filas.slice(i, i + LOTE);
    const vals = [];
    const grupos = trozo.map((f, j) => {
      const base = j * COLS.length;
      COLS.forEach((c) => vals.push(limpiar(f[c] ?? null)));
      return '(' + COLS.map((_, k) => `$${base + k + 1}`).join(',') + ')';
    });
    const setCols = COLS.filter((c) => c !== 'sucursal' && c !== 'no_transaccion')
      .map((c) => `${c}=excluded.${c}`).concat('actualizado_en=now()').join(', ');
    await cliente.query(
      `insert into merma (${COLS.join(',')}) values ${grupos.join(',')} ` +
      `on conflict (sucursal, no_transaccion) do update set ${setCols}`, vals);
  }
}

(async () => {
  const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  const cliente = await pool.connect();
  try {
    for (const b of sucursales) {
      const t0 = Date.now();
      try {
        console.log(`\n[${b.alias}] leyendo...`);
        let filas = await leer(b);
        // BLINDAJE: tomar SOLO la sucursal canonica del servidor.
        // Evita arrastrar datos viejos de otra sucursal (ej. el servidor de
        // Misiones/JUAREZ 3 antes fue CANTERA y conserva datos de CANTERA que
        // NO son la CANTERA real). Sin esto, se mezclarian al conectar la
        // CANTERA verdadera.
        if (b.sucursal) {
          const antes = filas.length;
          filas = filas.filter((f) => f.sucursal === b.sucursal);
          if (antes !== filas.length) {
            console.log(`  (descartadas ${antes - filas.length} filas de otra sucursal)`);
          }
        }
        console.log(`  ${filas.length} movimientos de merma`);
        filas.forEach((f) => { f.insumo_norm = norm(f.insumo); });
        if (filas.length) await upsert(cliente, filas);
        const suc = filas[0]?.sucursal || b.sucursal || b.alias;
        await cliente.query(
          `insert into sync_estado (sucursal, tabla, ultima_corrida, filas, estatus, detalle)
           values ($1,'merma', now(), $2, 'ok', $3)
           on conflict (sucursal, tabla) do update set
             ultima_corrida=now(), filas=excluded.filas, estatus='ok', detalle=excluded.detalle`,
          [suc, filas.length, `${b.alias}: ${filas.length} movimientos`]);
        console.log(`  OK -> ${suc} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      } catch (e) {
        console.error(`  ERROR en ${b.alias}: ${e.message}`);
        try {
          await cliente.query(
            `insert into sync_estado (sucursal, tabla, ultima_corrida, filas, estatus, detalle)
             values ($1,'merma', now(), 0, 'error', $2)
             on conflict (sucursal, tabla) do update set ultima_corrida=now(), estatus='error', detalle=excluded.detalle`,
            [b.sucursal || b.alias, e.message.slice(0, 200)]);
        } catch {}
      }
    }
  } finally {
    cliente.release();
    await pool.end();
  }
  console.log('\nLISTO');
})().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
