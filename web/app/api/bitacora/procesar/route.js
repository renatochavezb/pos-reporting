import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const norm = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Tarifas de la API (USD por 1M tokens). Sonnet 5 tiene precio intro hasta 31-ago-2026.
const TARIFAS = {
  "claude-sonnet-5": { in: 3.0, out: 15.0, introIn: 2.0, introOut: 10.0, introHasta: "2026-08-31" },
  "claude-opus-5": { in: 5.0, out: 25.0 },
  "claude-opus-4-8": { in: 5.0, out: 25.0 },
  "claude-haiku-4-5": { in: 1.0, out: 5.0 },
};
function costoUSD(modelo, u) {
  const t = TARIFAS[modelo] || { in: 3, out: 15 };
  const hoy = new Date().toISOString().slice(0, 10);
  const intro = t.introHasta && hoy <= t.introHasta;
  const rin = intro ? t.introIn : t.in;
  const rout = intro ? t.introOut : t.out;
  const inp = (u?.input_tokens || 0) + (u?.cache_read_input_tokens || 0) + (u?.cache_creation_input_tokens || 0);
  return (inp * rin + (u?.output_tokens || 0) * rout) / 1e6;
}

// Fallback difuso por si la IA no devuelve un nombre del catálogo.
const SIZE = [" GDE", " GRANDE", " GRA", " CHICO", " CHICA", " CH", " INDIVIDUAL", " IND", " MINI"];
function parte(n) { let x = " " + norm(n) + " "; let size = null; if (/ (GDE|GRANDE|GRA) /.test(x)) size = "GD"; else if (/ (CHICO|CHICA|CH) /.test(x)) size = "CH"; for (const s of SIZE) x = x.split(s + " ").join(" "); return { base: x.trim(), size }; }
const W = (s) => new Set(s.split(" ").filter(Boolean));
const score = (a, b) => { const A = W(a), B = W(b); let i = 0; for (const w of A) if (B.has(w)) i++; return i / (A.size + B.size - i || 1) + ((a.includes(b) || b.includes(a)) ? 0.3 : 0); };

// Alias/abreviaturas que la IA no puede adivinar sola (marca -> nombre del catálogo).
const ALIAS_HINTS = `- "Brownie" (a secas) = BROWNIE (el postre). SOLO si dice "galleta brownie" = GALLETA BROWNIE. Son productos distintos, no los confundas.
- "Oreo" (a secas) = COOKIES AND CREAM (el pastel). Si dice "Chees Oreo"/"Cheesecake Oreo" = CHEESECAKE COOKIES AND CREAM.
- "Baileys" = TIRAMISU CREMA IRLANDESA
- "Monkey" / "MJ Monkey" / "My Monkey" = MJ MONKEY
- "Selva" = SELVA NEGRA
- "Dubai" = PASTEL DUBAI
- "Italiano" = ITALIANO DE BODAS
- "Lovers" = LOVER S CON FRESA
- "Crepas" / "Mil Crepas" / "Mille Crepe" = MILLE CREPE (Cajeta o Nutella según el sabor)
- "Fresas" (a secas) = FRESAS CON CREMA
- "Chees" o "Cheescake" = CHEESECAKE ; "F." = FLAN ; "M." o "Most." = MOSTACHON ; "G." o "Galleta" = GALLETA
- "Ind." / "Individual" / "Mini" = versión MINI del producto (usa el nombre MINI del catálogo si existe)
- Corrige errores de dedo (ej. "Tortoja"->"Tortuga", "Manzanela"->"Manzanella", "Heleaso"->"Heleado").`;

export async function POST(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor (web/.env.local)." }, { status: 400 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const sucursal = String(body?.sucursal || "").toUpperCase().trim();
  const imagenes = Array.isArray(body?.imagenes) ? body.imagenes.slice(0, 6) : [];
  if (!sucursal) return NextResponse.json({ error: "Falta la sucursal" }, { status: 400 });
  if (!imagenes.length) return NextResponse.json({ error: "No se recibieron imágenes" }, { status: 400 });

  // Región + catálogo de precios (para que la IA mapee al nombre correcto)
  const supabase = await createClient();
  const { data: reg } = await supabase.from("sucursal_region").select("region").eq("sucursal", sucursal).maybeSingle();
  const region = reg?.region === "JUAREZ" ? "JUAREZ" : "CHIHUAHUA";
  const { data: precios } = await supabase.from("precios").select("producto,producto_norm,tamano,costo,precio_venta").eq("region", region);
  const listaPrecios = precios || [];
  const setP = new Set(listaPrecios.map((x) => x.producto_norm + "|" + x.tamano));
  const prods = [...new Set(listaPrecios.map((x) => x.producto_norm))];
  const cost = {}, pub = {}, disp = {};
  for (const x of listaPrecios) { const k = x.producto_norm + "|" + x.tamano; cost[k] = x.costo != null ? Number(x.costo) : null; pub[k] = x.precio_venta != null ? Number(x.precio_venta) : null; if (!disp[x.producto_norm]) disp[x.producto_norm] = x.producto; }

  const catalogo = prods.slice().sort().join("\n");

  const PROMPT = `Esta es la foto de una hoja "CONTROL DE MERMA" de una pastelería (Dulce Noviembre).
Columnas: FECHA, CANTIDAD, CAUSA DE LA MERMA, PRODUCTO, RESPONSABLE.
Transcribe TODOS los renglones con datos (ignora los vacíos).

CATÁLOGO de productos válidos (para el campo "catalogo" usa EXACTAMENTE uno de estos, tal cual está escrito, o "" si de verdad ninguno corresponde):
${catalogo}

ALIAS y abreviaturas (bitácora -> catálogo):
${ALIAS_HINTS}

Devuelve ÚNICAMENTE un arreglo JSON (sin texto ni markdown), objetos:
{"fecha":"YYYY-MM-DD","cantidad":<numero>,"motivo":"caducidad"|"daño","producto":"<texto leído>","catalogo":"<nombre EXACTO del catálogo o vacío>","tamano":"CH"|"GD"}
Reglas:
- fecha: año 2026. "DD-08"/"DD/08"/"DD-Ago" = 2026-08-DD; si el mes no está claro asume 08. NUNCA uses una fecha futura (posterior a hoy): si te sale futura casi siempre es un error de mes en la libreta, usa 08.
- motivo: "cad"/"caducidad"->"caducidad"; "daño"/"dano"/"merma x daño"->"daño"; si dice ambos usa "daño".
- cantidad: número; si está vacío usa 1.
- tamano: "GD" si dice G/Gde/Grande, "CH" si dice CH/Chico; si no se indica, "GD".
- "catalogo": el nombre del catálogo que corresponde (aplicando los alias y corrigiendo errores de dedo). Muy importante para que se pueda costear.`;

  // Contenido con imágenes
  const content = [];
  for (const url of imagenes) {
    const m = /^data:(image\/[a-zA-Z]+);base64,(.+)$/s.exec(String(url));
    if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (!content.length) return NextResponse.json({ error: "Las imágenes no tienen un formato válido" }, { status: 400 });
  content.push({ type: "text", text: PROMPT });

  // Llamar a Claude
  const modelo = process.env.BITACORA_MODEL || "claude-sonnet-5";
  let filas, usage = null;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: modelo,
      max_tokens: 8000,
      messages: [{ role: "user", content }],
    });
    usage = msg.usage;
    const texto = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const limpio = texto.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const ini = limpio.indexOf("["), fin = limpio.lastIndexOf("]");
    filas = JSON.parse(ini >= 0 && fin > ini ? limpio.slice(ini, fin + 1) : limpio);
    if (!Array.isArray(filas)) throw new Error("respuesta no es un arreglo");
  } catch (e) {
    const esAuth = /authentication|api key|x-api-key|401/i.test(e?.message || "");
    return NextResponse.json({ error: esAuth ? "La API key de Anthropic es inválida." : "No se pudo transcribir la imagen: " + (e?.message || "error") }, { status: 500 });
  }

  // Costear: primero por el nombre de catálogo que dio la IA; si no, fallback difuso.
  function porCatalogo(cat, tam) {
    const pn = norm(cat);
    if (!pn) return null;
    for (const s of [tam, "GD", "CH"]) if (setP.has(pn + "|" + s)) return { pn, t: s };
    return null;
  }
  function fallback(nombre) {
    const raw = norm(nombre); const esMini = /\b(INDIVIDUAL|IND|MINI)\b/.test(raw);
    const { base, size } = parte(nombre); const tam = size || "GD";
    if (esMini) { const mb = "MINI " + base; for (const s of ["CH", "GD"]) if (setP.has(mb + "|" + s)) return { pn: mb, t: s }; }
    for (const s of [tam, "GD", "CH"]) if (setP.has(base + "|" + s)) return { pn: base, t: s };
    let best = null, bs = 0; for (const p of prods) { const s = score(base, p); if (s > bs) { bs = s; best = p; } }
    if (best && bs >= 0.5) for (const s of [tam, "GD", "CH"]) if (setP.has(best + "|" + s)) return { pn: best, t: s };
    return null;
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const registros = [];
  for (const f of filas) {
    const producto = String(f?.producto || "").trim();
    if (!producto) continue;
    let fecha = String(f?.fecha || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    // Una merma no puede ser en el futuro: si sale futura (error de mes en la
    // libreta), se corrige al mes en curso; si aún queda futura, se usa hoy.
    if (fecha > hoy) {
      const corr = hoy.slice(0, 7) + fecha.slice(7);
      fecha = corr <= hoy ? corr : hoy;
    }
    const cantidad = Number(f?.cantidad) > 0 ? Number(f.cantidad) : 1;
    const motivo = f?.motivo === "daño" || f?.motivo === "dano" ? "daño" : "caducidad";
    const tam = f?.tamano === "CH" ? "CH" : "GD";
    const hit = porCatalogo(f?.catalogo, tam) || fallback(f?.catalogo || producto);
    const key = hit ? hit.pn + "|" + hit.t : null;
    const cu = key ? cost[key] : null;
    const pu = key ? pub[key] : null;
    registros.push({
      sucursal, fecha,
      insumo: hit ? (disp[hit.pn] || producto) : producto,
      cantidad, motivo_tipo: motivo,
      importe_costo: cu != null ? cu * cantidad : null,
      precio_publico: pu,
    });
  }
  if (!registros.length) return NextResponse.json({ error: "No se detectaron renglones en la imagen." }, { status: 422 });

  await supabase.from("bitacora_merma").delete().eq("sucursal", sucursal);
  const { error: insErr } = await supabase.from("bitacora_merma").insert(registros);
  if (insErr) return NextResponse.json({ error: "Error al guardar: " + insErr.message }, { status: 500 });

  // Registrar el costo del uso de la IA (best-effort)
  const costoIA = costoUSD(modelo, usage);
  try {
    await supabase.from("ia_uso").insert({
      sucursal, modelo,
      input_tokens: usage?.input_tokens || 0,
      output_tokens: usage?.output_tokens || 0,
      costo_usd: costoIA,
    });
  } catch {}

  const totCosto = registros.reduce((a, x) => a + (x.importe_costo || 0), 0);
  const sinCosto = registros.filter((x) => x.importe_costo == null).length;
  return NextResponse.json({ ok: true, sucursal, renglones: registros.length, totCosto, sinCosto, costoIA });
}
