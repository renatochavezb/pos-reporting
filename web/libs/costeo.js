// Motor de costeo compartido: mapea un nombre escrito en la bitácora al
// producto del catálogo de precios y devuelve su costo/precio público.

export const norm = (s) =>
  String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const SIZE = [" GDE", " GRANDE", " GRA", " CHICO", " CHICA", " CH", " INDIVIDUAL", " IND", " MINI"];
function parte(n) {
  let x = " " + norm(n) + " ";
  let size = null;
  if (/ (GDE|GRANDE|GRA) /.test(x)) size = "GD";
  else if (/ (CHICO|CHICA|CH) /.test(x)) size = "CH";
  for (const s of SIZE) x = x.split(s + " ").join(" ");
  return { base: x.trim(), size };
}
const W = (s) => new Set(s.split(" ").filter(Boolean));
const score = (a, b) => {
  const A = W(a), B = W(b);
  let i = 0;
  for (const w of A) if (B.has(w)) i++;
  return i / (A.size + B.size - i || 1) + ((a.includes(b) || b.includes(a)) ? 0.3 : 0);
};

// Prepara índices a partir de la lista de precios de una región.
export function contextoPrecios(lista) {
  const setP = new Set((lista || []).map((x) => x.producto_norm + "|" + x.tamano));
  const prods = [...new Set((lista || []).map((x) => x.producto_norm))];
  const cost = {}, pub = {}, disp = {};
  for (const x of lista || []) {
    const k = x.producto_norm + "|" + x.tamano;
    cost[k] = x.costo != null ? Number(x.costo) : null;
    pub[k] = x.precio_venta != null ? Number(x.precio_venta) : null;
    if (!disp[x.producto_norm]) disp[x.producto_norm] = x.producto;
  }
  return { setP, prods, cost, pub, disp };
}

function porCatalogo(cat, tam, ctx) {
  const pn = norm(cat);
  if (!pn) return null;
  for (const s of [tam, "GD", "CH"]) if (ctx.setP.has(pn + "|" + s)) return { pn, t: s };
  return null;
}
function fallback(nombre, tam, ctx) {
  const raw = norm(nombre);
  const esMini = /\b(INDIVIDUAL|IND|MINI)\b/.test(raw);
  const { base, size } = parte(nombre);
  const t = size || tam || "GD";
  if (esMini) { const mb = "MINI " + base; for (const s of ["CH", "GD"]) if (ctx.setP.has(mb + "|" + s)) return { pn: mb, t: s }; }
  for (const s of [t, "GD", "CH"]) if (ctx.setP.has(base + "|" + s)) return { pn: base, t: s };
  let best = null, bs = 0;
  for (const p of ctx.prods) { const sc = score(base, p); if (sc > bs) { bs = sc; best = p; } }
  if (best && bs >= 0.5) for (const s of [t, "GD", "CH"]) if (ctx.setP.has(best + "|" + s)) return { pn: best, t: s };
  return null;
}

// Costea un renglón. `catalogo` es la pista opcional de la IA.
// Devuelve { display, importe_unit, publico, tam } — importe_unit/publico null si no hay precio.
export function costear(nombre, tam, ctx, catalogo) {
  const t = tam === "CH" ? "CH" : "GD";
  const hit = (catalogo ? porCatalogo(catalogo, t, ctx) : null) || fallback(nombre, t, ctx);
  if (!hit) return { display: nombre, importe_unit: null, publico: null, tam: t };
  const k = hit.pn + "|" + hit.t;
  return { display: ctx.disp[hit.pn] || nombre, importe_unit: ctx.cost[k], publico: ctx.pub[k], tam: hit.t };
}
