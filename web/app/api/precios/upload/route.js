import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";

export const dynamic = "force-dynamic";

const norm = (s) =>
  String(s || "").toUpperCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

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
    if (/COSTOS/i.test(String(h)))
      bloques.push({ col: c, region: /JUAREZ/i.test(String(h)) ? "JUAREZ" : "CHIHUAHUA" });
  });
  // sin encabezados "COSTOS" -> un solo bloque en las primeras 3 columnas
  if (bloques.length === 0) bloques = [{ col: 0, region: "CHIHUAHUA" }];

  const out = [];
  for (const b of bloques) {
    for (let r = 2; r < rows.length; r++) {
      const nombre = String(rows[r][b.col] || "").trim();
      if (!nombre) continue;
      const pn = norm(nombre);
      const ch = num(rows[r][b.col + 1]);
      const gd = num(rows[r][b.col + 2]);
      if (ch != null) out.push({ region: b.region, producto: nombre, producto_norm: pn, tamano: "CH", costo: ch });
      if (gd != null) out.push({ region: b.region, producto: nombre, producto_norm: pn, tamano: "GD", costo: gd });
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
  try {
    if (regionSel === "AMBAS") await supabase.from("precios").delete().neq("region", "__none__");
    else await supabase.from("precios").delete().eq("region", regionSel);

    for (let i = 0; i < filas.length; i += 500) {
      const lote = filas.slice(i, i + 500).map((f) => ({
        region: f.region, producto: f.producto, producto_norm: f.producto_norm,
        tamano: f.tamano, costo: f.costo,
      }));
      const { error } = await supabase.from("precios").insert(lote);
      if (error) throw new Error(error.message);
    }
    await supabase.from("precios_cargas").insert({
      archivo: `${file.name || "lista.xlsx"} (${regionSel.toLowerCase()})`,
      filas: filas.length,
      cargado_por: session.user.email || null,
    });

    const porRegion = {};
    filas.forEach((f) => (porRegion[f.region] = (porRegion[f.region] || 0) + 1));
    return NextResponse.json({ ok: true, filas: filas.length, region: regionSel, porRegion });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Error al procesar" }, { status: 500 });
  }
}
