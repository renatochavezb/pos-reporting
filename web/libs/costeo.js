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

// ¿El texto escrito puede corresponder a VARIOS productos del catálogo?
// (p. ej. "Lotus" existe como cheesecake, flan, galleta, tarta…). Se usa para
// marcar el renglón como "verifica" en la revisión.
function esAmbiguo(nombre, ctx) {
  const { base } = parte(nombre);
  const toks = base.split(" ").filter((w) => w.length >= 4);
  if (!toks.length) return false;
  let n = 0;
  for (const p of ctx.prods) { if (toks.every((w) => p.includes(w))) { n++; if (n > 1) return true; } }
  return false;
}

// Costea un renglón. `catalogo` = pista de la IA; `aliasMap` = diccionario
// { textoNorm: {producto_norm, tamano} }. Devuelve { display, importe_unit,
// publico, tam, ambiguo }.
export function costear(nombre, tam, ctx, catalogo, aliasMap) {
  const t = tam === "CH" ? "CH" : "GD";

  // 1) Diccionario de alias (lo definido por el admin manda y NO es ambiguo).
  if (aliasMap) {
    for (const cl of [norm(nombre), norm(catalogo || ""), parte(nombre).base]) {
      const a = cl && aliasMap[cl];
      if (a) {
        for (const s of [a.tamano || t, "GD", "CH"]) {
          const k = a.producto_norm + "|" + s;
          if (ctx.setP.has(k)) return { display: ctx.disp[a.producto_norm] || a.producto_norm, importe_unit: ctx.cost[k], publico: ctx.pub[k], tam: s, ambiguo: false };
        }
      }
    }
  }

  // 2) Costeo normal (catálogo de la IA o difuso) + señal de ambigüedad.
  const amb = esAmbiguo(nombre, ctx);
  const hit = (catalogo ? porCatalogo(catalogo, t, ctx) : null) || fallback(nombre, t, ctx);
  if (!hit) return { display: nombre, importe_unit: null, publico: null, tam: t, ambiguo: amb };
  const k = hit.pn + "|" + hit.t;
  return { display: ctx.disp[hit.pn] || nombre, importe_unit: ctx.cost[k], publico: ctx.pub[k], tam: hit.t, ambiguo: amb };
}

// Carga el diccionario de alias de una región como mapa { textoNorm: {producto_norm, tamano} }.
export function mapaAlias(filas, region) {
  const m = {};
  for (const a of filas || []) {
    if (a.region && a.region !== region) continue;
    m[norm(a.texto)] = { producto_norm: a.producto_norm, tamano: a.tamano || null };
  }
  return m;
}
