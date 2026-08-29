import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";

export const dynamic = "force-dynamic";

const norm = (s) =>
  String(s || "").toUpperCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Corrige errores de dedo comunes en nombres (para alinear con costos).
const limpiaTypo = (pn) =>
  String(pn || "")
    .replace(/\bCHEES\b/g, "CHEESECAKE")
    .replace(/\bCHEESCAKE\b/g, "CHEESECAKE")
    .replace(/\bCHESECAKE\b/g, "CHEESECAKE")
    .replace(/\bHELASO\b/g, "HELADO")
    .replace(/\s+/g, " ")
    .trim();

const num = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
};

// Lee bloques "COSTOS" (Chihuahua izq / Juarez der), tamaños CHICO/GD.
function parsear(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const head = rows[0] || [];
  let bloques = [];
  head.forEach((h, c) => {
    if (/COSTOS|P[UÚ]BLICO|PRECIO/i.test(String(h)))
      bloques.push({ col: c, region: /JUAREZ/i.test(String(h)) ? "JUAREZ" : "CHIHUAHUA" });
  });
  // sin encabezados "COSTOS" -> un solo bloque en las primeras 3 columnas
  if (bloques.length === 0) bloques = [{ col: 0, region: "CHIHUAHUA" }];

  const out = [];
  for (const b of bloques) {
    for (let r = 2; r < rows.length; r++) {
      const nombre = String(rows[r][b.col] || "").trim();
      if (!nombre) continue;
      // Formato B: el tamaño va PEGADO al nombre (ej. "ALEMAN CH") + un solo valor.
      const mSize = nombre.match(/\s+(CH|CHICO|CHICA|GDE?|GRANDE|GRA)$/i);
      if (mSize) {
        const base = nombre.slice(0, mSize.index).trim();
        const tam = /^(GDE?|GRANDE|GRA)$/i.test(mSize[1]) ? "GD" : "CH";
        const val = num(rows[r][b.col + 1]);
        if (val != null) out.push({ region: b.region, producto: base, producto_norm: norm(base), tamano: tam, valor: val });
        continue;
      }
      // Formato A: producto | chico | grande (dos columnas de valor).
      const pn = norm(nombre);
      const ch = num(rows[r][b.col + 1]);
      const gd = num(rows[r][b.col + 2]);
      if (ch != null) out.push({ region: b.region, producto: nombre, producto_norm: pn, tamano: "CH", valor: ch });
      if (gd != null) out.push({ region: b.region, producto: nombre, producto_norm: pn, tamano: "GD", valor: gd });
    }
  }
  return out;
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const regionSel = String(form.get("region") || "AMBAS").toUpperCase(); // AMBAS | CHIHUAHUA | JUAREZ
  const tipo = String(form.get("tipo") || "costos").toLowerCase();       // costos | publico
  const campo = tipo === "publico" ? "precio_venta" : "costo";           // columna destino
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  const buf = new Uint8Array(await file.arrayBuffer());
  let filas = parsear(buf);

  // Filtrar/forzar por región seleccionada
  if (regionSel !== "AMBAS") {
    const match = filas.filter((f) => f.region === regionSel);
    filas = (match.length ? match : filas).map((f) => ({ ...f, region: regionSel }));
  }
  // dedup
  const mapa = new Map();
  filas.forEach((f) => mapa.set(`${f.region}|${f.producto_norm}|${f.tamano}`, f));
  filas = [...mapa.values()];

  if (!filas.length)
    return NextResponse.json({ error: "No encontré precios en el archivo (¿columnas CHICO/GD?)" }, { status: 400 });

  const supabase = await createClient();

  // Público: alinear nombres con la tabla de COSTOS, pero SOLO por coincidencia
  // exacta tras corregir typos claros (no fusiona líneas distintas: MINI, helados,
  // keto, 3L quedan como productos aparte con su nombre ya corregido).
  if (tipo === "publico") {
    const { data: cat } = await supabase.from("precios").select("region,producto,producto_norm").not("costo", "is", null);
    const byReg = {};
    (cat || []).forEach((x) => {
      (byReg[x.region] = byReg[x.region] || new Map()).set(x.producto_norm, x.producto);
    });
    filas = filas.map((f) => {
      const cleaned = limpiaTypo(f.producto_norm);
      const m = byReg[f.region];
      if (m && m.has(cleaned)) return { ...f, producto_norm: cleaned, producto: m.get(cleaned) };
      return cleaned !== f.producto_norm ? { ...f, producto_norm: cleaned } : f;
    });
    const mm = new Map();
    filas.forEach((f) => mm.set(`${f.region}|${f.producto_norm}|${f.tamano}`, f));
    filas = [...mm.values()];
  }

  try {
    // UPSERT por (region, producto_norm, tamano): solo toca la columna del tipo
    // elegido (costo o precio_venta), sin borrar la otra lista.
    for (let i = 0; i < filas.length; i += 500) {
      const lote = filas.slice(i, i + 500).map((f) => ({
        region: f.region, producto: f.producto, producto_norm: f.producto_norm,
        tamano: f.tamano, [campo]: f.valor,
      }));
      const { error } = await supabase
        .from("precios")
        .upsert(lote, { onConflict: "region,producto_norm,tamano" });
      if (error) throw new Error(error.message);
    }
    await supabase.from("precios_cargas").insert({
      archivo: `${file.name || "lista.xlsx"} · ${tipo === "publico" ? "público" : "costos"} (${regionSel.toLowerCase()})`,
      filas: filas.length,
      cargado_por: session.user.email || null,
    });

    const porRegion = {};
    filas.forEach((f) => (porRegion[f.region] = (porRegion[f.region] || 0) + 1));
    return NextResponse.json({ ok: true, filas: filas.length, region: regionSel, tipo, porRegion });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Error al procesar" }, { status: 500 });
  }
}
