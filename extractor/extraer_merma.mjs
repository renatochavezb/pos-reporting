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
import { clasificarMotivo } from './motivo.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COLS = [
  'sucursal', 'no_transaccion', 'tipo', 'fecha', 'fecha_hora', 'folio',
  'no_insumo', 'insumo', 'categoria', 'unidad', 'cantidad', 'costo_unitario',
  'importe', 'costo_confiable', 'motivo', 'usuario', 'modulo', 'insumo_norm',
  'motivo_tipo', 'fecha_merma',
];

const sucursales = JSON.parse(readFileSync(join(__dirname, 'sucursales.json'), 'utf8'));
const consulta = readFileSync(join(__dirname, '..', 'sql', 'extraccion_merma.sql'), 'utf8');

async function leer(b, desde) {
  const cfg = {
    server: b.host, port: b.port || 1433, user: b.user, password: b.pass, database: b.db,
    options: {
      encrypt: false, trustServerCertificate: true, useUTC: false,
      /* COMPATIBILIDAD SEATTLEPOS (SQL Server 2008 R2): el POS solo habla TLS 1.0 con
         cifrados viejos y Node 24 ya no. Sin esto, ECONNRESET en todas las sucursales.
         Aplica SOLO a la conexion al POS: solo lectura, dentro de la VPN de Hamachi.
         Pendiente de fondo: actualizar los SQL Server de las sucursales. */
      cryptoCredentialsDetails: { minVersion: 'TLSv1', ciphers: 'DEFAULT@SECLEVEL=0' },
    },
    connectionTimeout: 30000, requestTimeout: 120000,
  };
  const pool = await sql.connect(cfg);
  try {
    return (await pool.request()
      .input('desde', sql.DateTime, new Date(`${desde}T00:00:00`))
      .query(consulta)).recordset;
  }
  finally { await pool.close(); }
}

const limpiar = (v) => (typeof v === 'string' ? v.trim() : v);
const norm = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* Piso historico: no se extrae nada anterior a esta fecha. */
const PISO = '2026-07-01';

/* Ventana de extraccion de UNA sucursal.
   - Sin datos en Supabase -> backfill completo desde el piso.
   - Con datos             -> solo el incremento: la ultima fecha ya extraida
     menos un dia de traslape, para alcanzar capturas tardias y cancelaciones
     (tipo 19). Releer es seguro: el UPSERT va por (sucursal, no_transaccion),
     asi que actualiza en vez de duplicar.
   Derivarlo de max(fecha) lo hace autocurable: si falla una noche, la corrida
   siguiente cubre el hueco sola, sin intervencion. */
async function ventanaDe(cliente, b, override) {
  if (override) return { desde: override, modo: 'manual' };
  const suc = b.sucursal || b.alias;
  const r = await cliente.query(
    'select max(fecha)::text as ultima from merma where sucursal = $1', [suc]);
  const ultima = r.rows[0]?.ultima;
  if (!ultima) return { desde: PISO, modo: 'BACKFILL' };
  const d = new Date(`${ultima}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const desde = d.toISOString().slice(0, 10);
  return { desde: desde < PISO ? PISO : desde, modo: 'incremental' };
}

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
    // Argumentos: [sucursal] [--desde YYYY-MM-DD]
    // Sin sucursal -> todas (así corre el automatico de las 9pm).
    // --desde fuerza la ventana; sirve para rehacer un backfill a mano.
    const args = process.argv.slice(2);
    const iDesde = args.indexOf('--desde');
    const override = iDesde >= 0 ? (args[iDesde + 1] || '').trim() : '';
    if (iDesde >= 0 && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(override)) {
      console.error('--desde requiere una fecha YYYY-MM-DD');
      process.exit(1);
    }
    const filtro = (args.filter((a) => !a.startsWith('--') && a !== override)[0] || "").trim().toUpperCase();
    const lista = filtro
      ? sucursales.filter((b) => (b.sucursal || "").toUpperCase() === filtro || (b.alias || "").toUpperCase() === filtro)
      : sucursales;
    if (filtro && lista.length === 0) console.log(`(ninguna sucursal coincide con "${filtro}")`);
    for (const b of lista) {
      const t0 = Date.now();
      try {
        console.log(`\n[${b.alias}] leyendo...`);
        const v = await ventanaDe(cliente, b, override);
        console.log(`  ventana: ${v.modo} desde ${v.desde}`);
        let filas = await leer(b, v.desde);
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
        filas.forEach((f) => {
          f.insumo_norm = norm(f.insumo);
          const cl = clasificarMotivo(f.motivo, f.fecha);
          f.motivo_tipo = cl.tipo;
          f.fecha_merma = cl.fecha_merma;
        });
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
