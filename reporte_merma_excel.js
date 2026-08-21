/**
 * REPORTE DE MERMA a partir del kardex exportado del POS
 * -----------------------------------------------------------
 * Uso:  node reporte_merma_excel.js "<ruta kardex.xlsx>" [salida.xlsx]
 *
 * OJO CON LAS FECHAS: el export del POS intercambia dia y mes cuando
 * el dia es <= 12 (el 1-ago lo escribe como 8-ene). Los dias 13+ los
 * escribe como texto. Aqui se reconstruyen ambos casos.
 * Ver corrigeFecha().
 */
const XLSX = require("xlsx");
const path = require("path");

const ENTRADA = process.argv[2] || "C:\\Users\\renat\\OneDrive\\Desktop\\Kardex 1-14 ago.xlsx";
const SALIDA = process.argv[3] || path.join(__dirname, "output", "Merma_FUENTES_MARES_1-14_ago.xlsx");

// Clasificacion de tipos (validada contra FUENTES MARES 1-14 ago 2026)
const ES_MERMA = new Set(["MERMAS EN PUNTO DE VENTA", "CANCELAR MERMAS PUNTO DE VENTA"]);
const ES_AJUSTE = new Set(["ALTAS DE INSUMOS DIRECTAS", "BAJAS DE INSUMOS DIRECTAS"]);
const ES_VENTA = (t) => t.startsWith("VENTA ") || t.startsWith("CANCELAR VENTA");

/**
 * El export escribe mal las fechas. Dos casos:
 *  - serial numerico: viene con dia y mes intercambiados
 *  - texto "13/8/2026 13:15": viene bien, formato d/M/yyyy
 */
function corrigeFecha(v) {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    // intercambio: el "mes" que escribio es el dia real, el "dia" es el mes real
    return { y: d.y, m: d.d, d: d.m, H: d.H, M: d.M };
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return { y: +m[3], m: +m[2], d: +m[1], H: +(m[4] || 0), M: +(m[5] || 0) };
}
const fISO = (f) => (f ? `${f.y}-${String(f.m).padStart(2, "0")}-${String(f.d).padStart(2, "0")}` : "");
const fHora = (f) => (f ? `${String(f.H).padStart(2, "0")}:${String(f.M).padStart(2, "0")}` : "");

// ---------- leer ----------
const wb = XLSX.readFile(ENTRADA);
const ws = wb.Sheets[wb.SheetNames[0]];
const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// sucursal viene en el encabezado del reporte, no en las filas
const sucursal = String(filas[1]?.[0] || "").trim() || "(sin sucursal)";
const marca = String(filas[0]?.[0] || "").trim();

const hIdx = filas.findIndex((r) => String(r[0]).trim() === "#TRANS");
const head = filas[hIdx].map((c) => String(c).trim());
const col = (n) => head.indexOf(n);

const movs = filas.slice(hIdx + 1)
  .filter((r) => r[col("#TRANS")] !== "" && !isNaN(Number(r[col("#TRANS")])))
  .map((r) => {
    const f = corrigeFecha(r[col("FECHA")]);
    return {
      trans: Number(r[col("#TRANS")]),
      noInsumo: String(r[col("NO. INSUMO")]).trim(),
      insumo: String(r[col("INSUMO")]).trim(),
      tipo: String(r[col("TRANSACCION")]).trim(),
      folio: String(r[col("#FOLIO")]).trim(),
      fecha: fISO(f),
      hora: fHora(f),
      cant: Number(r[col("CANTIDAD")]) || 0,
      existAct: Number(r[col("EXIST. ACT.")]) || 0,
      usuario: String(r[col("USUARIO")]).trim(),
      modulo: String(r[col("MODULO")]).trim(),
    };
  })
  .sort((a, b) => a.trans - b.trans);

const merma = movs.filter((m) => ES_MERMA.has(m.tipo));
const ajustes = movs.filter((m) => ES_AJUSTE.has(m.tipo));
const ventas = movs.filter((m) => ES_VENTA(m.tipo));

const uMerma = merma.reduce((s, m) => s - m.cant, 0);
const uVenta = ventas.reduce((s, m) => s - m.cant, 0);
const pct = (100 * uMerma) / (uVenta + uMerma);
const fechas = movs.map((m) => m.fecha).filter(Boolean).sort();
const periodo = `${fechas[0]} a ${fechas[fechas.length - 1]}`;

// ---------- hoja 1: resumen ----------
const hResumen = [
  [marca],
  [`REPORTE DE MERMA — ${sucursal}`],
  [`Periodo: ${periodo}`],
  [],
  ["INDICADOR", "VALOR", "NOTA"],
  ["Merma (piezas)", uMerma, "solo MERMAS EN PUNTO DE VENTA"],
  ["Vendidas (piezas)", uVenta, ""],
  ["% merma sobre consumo", Number(pct.toFixed(2)), "merma / (merma + vendidas)"],
  ["Productos distintos con merma", new Set(merma.map((m) => m.noInsumo)).size, ""],
  ["Movimientos de merma", merma.length, ""],
  ["Sesiones de captura", new Set(merma.map((m) => m.folio)).size, "cada folio = una captura"],
  ["Dias con captura", new Set(merma.map((m) => m.fecha)).size, `de ${new Set(movs.map((m) => m.fecha)).size} dias del periodo`],
  [],
  ["AJUSTES DE INVENTARIO (no son merma)", "", ""],
  ["Altas directas (piezas)", ajustes.filter((a) => a.cant > 0).reduce((s, a) => s + a.cant, 0), "correcciones hacia arriba"],
  ["Bajas directas (piezas)", -ajustes.filter((a) => a.cant < 0).reduce((s, a) => s + a.cant, 0), "correcciones hacia abajo"],
  [],
  ["NOTA: la merma esta en PIEZAS, no en pesos.", "", ""],
  ["El costo no viene en el export; vive en KardexInsumoCosto (base de datos).", "", ""],
];

// ---------- hoja 2: por insumo ----------
const porIns = {};
merma.forEach((m) => {
  const k = m.noInsumo;
  porIns[k] = porIns[k] || { noInsumo: m.noInsumo, insumo: m.insumo, pzs: 0, veces: 0 };
  porIns[k].pzs += -m.cant;
  porIns[k].veces++;
});
const vendPorIns = {};
ventas.forEach((v) => { vendPorIns[v.noInsumo] = (vendPorIns[v.noInsumo] || 0) - v.cant; });

const hInsumo = [["NO. INSUMO", "PRODUCTO", "MERMA (PZS)", "VECES", "VENDIDAS (PZS)", "% MERMA"]];
Object.values(porIns).sort((a, b) => b.pzs - a.pzs).forEach((r) => {
  const vend = vendPorIns[r.noInsumo] || 0;
  hInsumo.push([r.noInsumo, r.insumo, r.pzs, r.veces, vend,
    vend + r.pzs > 0 ? Number(((100 * r.pzs) / (vend + r.pzs)).toFixed(1)) : ""]);
});

// ---------- hoja 3: por sesion de captura ----------
const porFolio = {};
merma.forEach((m) => {
  porFolio[m.folio] = porFolio[m.folio] || { folio: m.folio, fecha: m.fecha, hora: m.hora, usuario: m.usuario, pzs: 0, items: 0 };
  porFolio[m.folio].pzs += -m.cant;
  porFolio[m.folio].items++;
});
const hSesion = [["FOLIO", "FECHA", "HORA", "CAPTURO", "PRODUCTOS", "PIEZAS"]];
Object.values(porFolio).sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((s) =>
  hSesion.push([s.folio, s.fecha, s.hora, s.usuario, s.items, s.pzs]));

// ---------- hoja 4: detalle ----------
const hDetalle = [["#TRANS", "FECHA", "HORA", "FOLIO", "NO. INSUMO", "PRODUCTO", "PIEZAS", "EXIST. DESPUES", "CAPTURO", "MODULO"]];
merma.forEach((m) => hDetalle.push([m.trans, m.fecha, m.hora, m.folio, m.noInsumo, m.insumo, -m.cant, m.existAct, m.usuario, m.modulo]));

// ---------- hoja 5: ajustes (para verificar la clasificacion) ----------
const hAjustes = [["#TRANS", "FECHA", "HORA", "TIPO", "FOLIO", "NO. INSUMO", "PRODUCTO", "PIEZAS", "CAPTURO"]];
ajustes.forEach((a) => hAjustes.push([a.trans, a.fecha, a.hora, a.tipo, a.folio, a.noInsumo, a.insumo, a.cant, a.usuario]));

// ---------- hoja 6: notas ----------
const hNotas = [
  ["NOTAS METODOLOGICAS"],
  [],
  ["1. QUE CUENTA COMO MERMA"],
  ["   Solo el tipo 'MERMAS EN PUNTO DE VENTA'."],
  ["   Las 'ALTAS/BAJAS DE INSUMOS DIRECTAS' se excluyeron: se capturan en la misma"],
  ["   sesion que la merma, con minutos de diferencia, y hubo mas altas que bajas."],
  ["   Son correcciones de inventario, no producto perdido. Ver hoja AJUSTES."],
  [],
  ["2. FECHAS CORREGIDAS"],
  ["   El export del POS intercambia dia y mes cuando el dia es <= 12."],
  ["   Ejemplo: el 1-ago lo escribe como 8-ene, el 2-ago como 8-feb."],
  ["   Los dias 13 y 14 los escribe como texto y esos si vienen bien."],
  ["   Aqui ya estan reconstruidas. El campo #TRANS confirma el orden cronologico."],
  [],
  ["3. LA MERMA ESTA EN PIEZAS, NO EN PESOS"],
  ["   El export no trae costo. Para valorizarla hace falta leer KardexInsumoCosto"],
  ["   directamente de la base de datos de la sucursal."],
  [],
  ["4. COBERTURA DE LA CAPTURA"],
  ["   Toda la merma del periodo la capturo un solo usuario desde un modulo remoto."],
  ["   Hay dias sin captura: eso no significa que no hubo merma, sino que no se"],
  ["   registro. Conviene leer el indicador por semana, no por dia."],
  [],
  ["5. PRODUCTOS CON EXISTENCIA NEGATIVA"],
  ["   Varios productos cierran en negativo (BENGALA llega a -122)."],
  ["   Sus existencias no son confiables, pero el % de merma si lo es: se calcula"],
  ["   con flujos (movimientos), no con saldos."],
];

// ---------- escribir ----------
const out = XLSX.utils.book_new();
const add = (nombre, aoa, anchos) => {
  const s = XLSX.utils.aoa_to_sheet(aoa);
  if (anchos) s["!cols"] = anchos.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(out, s, nombre);
};
add("Resumen", hResumen, [34, 14, 44]);
add("Por producto", hInsumo, [12, 34, 13, 8, 16, 10]);
add("Por sesion", hSesion, [9, 12, 8, 24, 11, 9]);
add("Detalle", hDetalle, [10, 12, 8, 8, 12, 34, 9, 15, 24, 18]);
add("Ajustes", hAjustes, [10, 12, 8, 30, 8, 12, 34, 9, 24]);
add("Notas", hNotas, [92]);

require("fs").mkdirSync(path.dirname(SALIDA), { recursive: true });
XLSX.writeFile(out, SALIDA);

console.log(`Sucursal: ${sucursal}`);
console.log(`Periodo : ${periodo}`);
console.log(`Merma   : ${uMerma} pzs en ${merma.length} movimientos / ${Object.keys(porFolio).length} sesiones`);
console.log(`Vendidas: ${uVenta} pzs`);
console.log(`% merma : ${pct.toFixed(2)}%`);
console.log(`Ajustes : ${ajustes.length} movimientos (excluidos de la merma)`);
console.log(`\nArchivo : ${SALIDA}`);
