import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "renato.chavezb@gmail.com";
const esAdmin = (u) => (u?.email || "").toLowerCase() === ADMIN_EMAIL || u?.user_metadata?.role === "admin";

export async function GET() {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esAdmin(s.user)) return NextResponse.json({ error: "Solo el administrador" }, { status: 403 });

  const supabase = await createClient();
  const { data: alias } = await supabase.from("alias_bitacora").select("id,texto,producto_norm,tamano,region").order("texto");
  const { data: precios } = await supabase.from("precios").select("producto,producto_norm,region");
  // catálogo distinto por producto_norm (para el selector)
  const vistos = new Set();
  const productos = [];
  for (const p of precios || []) {
    const k = p.region + "|" + p.producto_norm;
    if (vistos.has(k)) continue;
    vistos.add(k);
    productos.push({ producto: p.producto, producto_norm: p.producto_norm, region: p.region });
  }
  productos.sort((a, b) => a.region.localeCompare(b.region) || String(a.producto).localeCompare(String(b.producto)));
  return NextResponse.json({ alias: alias || [], productos });
}

export async function POST(req) {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esAdmin(s.user)) return NextResponse.json({ error: "Solo el administrador" }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const texto = String(body?.texto || "").trim();
  const producto_norm = String(body?.producto_norm || "").trim();
  const tamano = body?.tamano === "GD" || body?.tamano === "CH" ? body.tamano : null;
  const region = body?.region === "CHIHUAHUA" || body?.region === "JUAREZ" ? body.region : null;
  if (!texto || !producto_norm) return NextResponse.json({ error: "Falta el texto o el producto" }, { status: 400 });

  const supabase = await createClient();
  // Reemplaza el alias existente (mismo texto y misma región) e inserta el nuevo.
  let del = supabase.from("alias_bitacora").delete().ilike("texto", texto);
  del = region === null ? del.is("region", null) : del.eq("region", region);
  await del;
  const { error } = await supabase.from("alias_bitacora").insert({ texto, producto_norm, tamano, region });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esAdmin(s.user)) return NextResponse.json({ error: "Solo el administrador" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("alias_bitacora").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
