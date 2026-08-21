import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";

export const dynamic = "force-dynamic";

const norm = (s) =>
  String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const num = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
};

// Excel de dos bloques (Chihuahua izq / Juarez der), tamaños CHICO y GD.
function parsear(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const head = rows[0] || [];
  const bloques = [];
  head.forEach((h, c) => {
    if (/COSTOS/i.test(String(h)))
      bloques.push({ col: c, region: /JUAREZ/i.test(String(h)) ? "JUAREZ" : "CHIHUAHUA" });
  });
  const mapa = new Map();
  for (const b of bloques) {
    for (let r = 2; r < rows.length; r++) {
      const nombre = String(rows[r][b.col] || "").trim();
      if (!nombre) continue;
      const pn = norm(nombre);
      const ch = num(rows[r][b.col + 1]);
      const gd = num(rows[r][b.col + 2]);
      if (ch != null) mapa.set(`${b.region}|${pn}|CH`, { region: b.region, producto: nombre, producto_norm: pn, tamano: "CH", costo: ch });
      if (gd != null) mapa.set(`${b.region}|${pn}|GD`, { region: b.region, producto: nombre, producto_norm: pn, tamano: "GD", costo: gd });
    }
  }
  return [...mapa.values()];
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string")
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

    const buf = new Uint8Array(await file.arrayBuffer());
    const registros = parsear(buf);
    if (!registros.length)
      return NextResponse.json(
        { error: "No encontré precios. El archivo debe tener bloques con encabezado 'COSTOS' y columnas CHICO/GD." },
        { status: 400 }
      );

    const supabase = await createClient();
    // reemplazo completo: borrar y volver a insertar
    await supabase.from("precios").delete().neq("region", "__none__");
    for (let i = 0; i < registros.length; i += 500) {
      const { error } = await supabase.from("precios").insert(registros.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    await supabase.from("precios_cargas").insert({
      archivo: file.name || "lista.xlsx",
      filas: registros.length,
      cargado_por: session.user.email || null,
    });

    const porRegion = {};
    registros.forEach((r) => (porRegion[r.region] = (porRegion[r.region] || 0) + 1));
    return NextResponse.json({ ok: true, filas: registros.length, porRegion });
  } catch (e) {
    console.error("upload precios:", e);
    return NextResponse.json({ error: e.message || "Error al procesar" }, { status: 500 });
  }
}
