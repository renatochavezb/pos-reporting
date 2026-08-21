/* Carga la lista de precios (Excel de dos bloques Chihuahua/Juarez) a Supabase.
   Uso: node cargar_precios.mjs "ruta\al\archivo.xlsx"   */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import pg from 'pg';

const ruta = process.argv[2];
if (!ruta) { console.error('Falta la ruta del Excel'); process.exit(1); }

const norm = (s) => String(s || '').toUpperCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? null : n;
};

export function parsear(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const head = rows[0] || [];
  // bloques: cualquier columna cuyo encabezado (fila 0) diga COSTOS
  const bloques = [];
  head.forEach((h, c) => {
    if (/COSTOS/i.test(String(h))) {
      bloques.push({ col: c, region: /JUAREZ/i.test(String(h)) ? 'JUAREZ' : 'CHIHUAHUA' });
    }
  });
  const out = [];
  for (const b of bloques) {
    for (let r = 2; r < rows.length; r++) {
      const nombre = String(rows[r][b.col] || '').trim();
      if (!nombre) continue;
      const ch = num(rows[r][b.col + 1]);
      const gd = num(rows[r][b.col + 2]);
      if (ch != null) out.push({ region: b.region, producto: nombre, producto_norm: norm(nombre), tamano: 'CH', costo: ch });
      if (gd != null) out.push({ region: b.region, producto: nombre, producto_norm: norm(nombre), tamano: 'GD', costo: gd });
    }
  }
  return out;
}

const registros = parsear(readFileSync(ruta));
console.log(`parseados ${registros.length} precios`);
const porRegion = {};
registros.forEach(r => { porRegion[r.region] = (porRegion[r.region] || 0) + 1; });
console.log('por region:', porRegion);

// dedupe por (region,producto_norm,tamano) - el archivo trae productos repetidos
const mapa = new Map();
const dups = [];
for (const r of registros) {
  const k = r.region + "|" + r.producto_norm + "|" + r.tamano;
  if (mapa.has(k)) dups.push(r.region + " " + r.producto + " " + r.tamano);
  mapa.set(k, r); // ultimo gana
}
const unicos = [...mapa.values()];
if (dups.length) console.log("DUPLICADOS (se quedo el ultimo):", [...new Set(dups)].join(", "));
console.log("unicos a cargar:", unicos.length);

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query('truncate precios');   // reemplazo completo con la lista nueva
  for (let i = 0; i < unicos.length; i += 200) {
    const lote = unicos.slice(i, i + 200);
    const vals = [];
    const grupos = lote.map((r, j) => {
      const b = j * 5;
      vals.push(r.region, r.producto, r.producto_norm, r.tamano, r.costo);
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},now())`;
    });
    await c.query(
      `insert into precios (region,producto,producto_norm,tamano,costo,actualizado_en) values ${grupos.join(',')}
       on conflict (region,producto_norm,tamano) do update set costo=excluded.costo, producto=excluded.producto, actualizado_en=now()`,
      vals);
  }
  const nombre = ruta.split(/[\/]/).pop();
  await c.query(`insert into precios_cargas (archivo, filas, cargado_por) values ($1,$2,'carga inicial')`, [nombre, unicos.length]);
  console.log('LISTO: cargado a Supabase');
} finally { await c.end(); }
