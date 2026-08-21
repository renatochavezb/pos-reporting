import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const tot = await c.query(
  'select count(*) n, sum(cantidad) piezas, sum(importe) filter (where costo_confiable) pesos from merma',
);
console.log('TOTAL EN SUPABASE (pesos = solo costo confiable):', tot.rows[0]);

const sosp = await c.query('select insumo, costo_capturado, piezas_mermadas from v_merma_costo_sospechoso');
console.log('\nCOSTO MAL CAPTURADO (excluido de pesos, corregir en el POS):');
for (const r of sosp.rows) console.log(`  ${r.insumo} | costo capturado $${r.costo_capturado} | ${r.piezas_mermadas} pzs mermadas`);

console.log('\nMERMA POR DIA (esta semana):');
const sem = await c.query(
  "select fecha::text as fecha, piezas, pesos, productos from v_merma_diaria where fecha >= '2026-08-10' order by fecha",
);
for (const r of sem.rows) console.log(`  ${r.fecha} | piezas ${r.piezas} | $${r.pesos} | ${r.productos} productos`);

console.log('\nTOP 5 PRODUCTOS (todo el periodo):');
const top = await c.query('select insumo, piezas, pesos from v_merma_por_producto order by pesos desc nulls last limit 5');
for (const r of top.rows) console.log(`  ${r.insumo} | ${r.piezas} pzs | $${r.pesos}`);

await c.end();
