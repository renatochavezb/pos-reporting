import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl:{rejectUnauthorized:false}});
await c.connect();
const norm = (s)=>String(s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();

// Correcciones manuales de nombres del POS con "error de dedo" que el
// emparejador automatico no atrapa. Clave = norm(insumo) -> [producto_norm, tamano].
// Se revisa PRIMERO en resolver(); asi quedan permanentes aunque se regenere.
const MANUAL = {
  'BLUBERRY 3L CH':       ['BLUEBERRY 3L', 'CH'],   // tres leches (no el cheesecake)
  'CAJA MACARRON 10 PZ':  ['CAJA MACARRONS', 'GD'],
  'FRESAS G':             ['FRESAS CON CREMA', 'GD'],
  'ICE NAPOLITANO':       ['PASTEL HELEADO NAPOLITANO', 'GD'],
  'ICE NUEZ':             ['PASTEL HELADO NUEZ', 'GD'],
  'MIL CREPAS CAJETA':    ['MILLE CREPE CAJETA', 'GD'],
  'MILL CREPAS NUTELLA':  ['MILLE CREPE NUTELLA', 'GD'],
  'PASTEL DE FRESAS CHICO': ['FRESAS CON CREMA', 'CH'],
  'MANGO 3 LECHES GDE':    ['TIRAMISU MANGO', 'GD'],   // confirmado por el usuario: es el mismo postre
  'MANGO 3 LECHES GRANDE': ['TIRAMISU MANGO', 'GD'],
  // Se dejan SIN costo a proposito:
  //   CHEES OREO  -> no hay cheesecake oreo entero de Juarez en la lista.
  //   PASTEL REESES -> producto descontinuado, ya no existe.
};
const SIZE=[' GDE',' GRANDE',' GRA',' CHICO',' CHICA',' CH',' INDIVIDUAL',' IND',' MINI'];
function parte(n){ let x=' '+norm(n)+' '; let size=null;
  if(/ (GDE|GRANDE|GRA) /.test(x)) size='GD'; else if(/ (CHICO|CHICA|CH) /.test(x)) size='CH';
  for(const s of SIZE) x=x.split(s+' ').join(' '); return {base:x.trim(), size}; }
const W=s=>new Set(s.split(' ').filter(Boolean));
const score=(a,b)=>{const A=W(a),B=W(b);let i=0;for(const w of A)if(B.has(w))i++;return i/(A.size+B.size-i||1)+((a.includes(b)||b.includes(a))?0.3:0);};
function repl(b){
  b=b.replace(/\bUBER\b/g,'').replace(/\bPASTEL\b/g,'').replace(/\bBRUELEE\b/,'BRULEE').replace(/\bBACKLABA\b/,'BAKLABA').replace(/\s+/g,' ').trim();
  if(/\bCHEES\b/.test(b) && !/CHEESECAKE/.test(b)) b=b.replace(/\bCHEES\b/,'CHEESECAKE');
  b=b.replace(/\bCHEESCAKE\b/g,'CHEESECAKE').replace('CREAM BRULEE','CREME BRULEE').replace('MY MONKEY','MJ MONKEY').replace(/\bMANZANELA\b/,'MANZANELLA');
  if(b==='MACARRONS') b='CAJA MACARRONS';
  if(b==='FRESAS') b='FRESAS CON CREMA';
  if(b==='ITALIANO') b='ITALIANO DE BODAS';
  if(b==='LOVERS') b='LOVER S CON FRESA';
  if(b==='ZANAHORIA') b='CHEESECAKE ZANAHORIA';
  if(b==='BAILEYS'||b==='BAILEY S') b='TIRAMISU CREMA IRLANDESA';
  if(b==='CUMPLEANOS') b='MINI CUMPLEANOS';
  if(b==='CHEESECAKE ROLES LOTUS'||b==='CHEESECAKE ROLES LOT') b='CHEESECAKE ROL DE CANELA LOT';
  if(b==='RED VELVET') b='REDVELVET';
  b=b.replace(/\bBLUBERRY\b/g,'BLUEBERRY'); // error de dedo (falta E), NO toca "BLUEBERRY 3L"
  if(b==='BLUE'||b==='BLUE BERRY') b='BLUEBERRY'; // solo el cheesecake suelto; "BLUEBERRY 3L" (tres leches) se queda aparte
  return b.replace(/\s+/g,' ').trim();
}
const precios=(await c.query("select distinct producto_norm, tamano from precios")).rows;
const setP=new Set(precios.map(r=>r.producto_norm+'|'+r.tamano));
const prods=[...new Set(precios.map(r=>r.producto_norm))];
const merma=(await c.query("select distinct insumo from merma where insumo is not null")).rows.map(r=>r.insumo);
function resolver(insumo){
  const n=norm(insumo);
  if(MANUAL[n]){ const [pn,t]=MANUAL[n]; if(setP.has(pn+'|'+t)) return {producto_norm:pn, tamano:t}; }
  const {base,size}=parte(insumo);
  if(/\b(INDIVIDUAL|MINI)\b/.test(n)){
    let b=repl(base.replace(/\b(INDIVIDUAL|MINI)\b/g,'').replace(/\s+/g,' ').trim());
    const t='MINI '+b;
    if(setP.has(t+'|GD')) return {producto_norm:t, tamano:'GD'};
    if(setP.has(t+'|CH')) return {producto_norm:t, tamano:'CH'};
  }
  let b=repl(base); const tam=size||'GD';
  for(const s of [tam,'GD','CH']) if(setP.has(b+'|'+s)) return {producto_norm:b, tamano:s};
  let best=null,bs=0; for(const p of prods){const sc=score(b,p); if(sc>bs){bs=sc;best=p;}}
  if(best && bs>=0.5){ for(const s of [tam,'GD','CH']) if(setP.has(best+'|'+s)) return {producto_norm:best, tamano:s}; }
  return {producto_norm:null, tamano:size};
}
let ok=0, sin=[];
await c.query('truncate equivalencias');
for(const insumo of merma){
  const {producto_norm,tamano}=resolver(insumo);
  if(producto_norm) ok++; else sin.push(insumo);
  await c.query(`insert into equivalencias (insumo_norm,insumo_ejemplo,producto_norm,tamano) values ($1,$2,$3,$4)
    on conflict (insumo_norm) do update set insumo_ejemplo=excluded.insumo_ejemplo, producto_norm=excluded.producto_norm, tamano=excluded.tamano, actualizado_en=now()`,
    [norm(insumo), insumo, producto_norm, tamano]);
}
console.log(`insumos: ${merma.length} | con equivalencia: ${ok} | sin: ${sin.length}`);
if(sin.length) console.log('SIN equivalencia:', sin.join(' | '));
await c.end();
