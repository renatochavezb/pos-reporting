import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";
import { transcribir, costoUSD } from "@/libs/bitacora_ia";
import { contextoPrecios, costear } from "@/libs/costeo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const hoyMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

export async function POST(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, { status: 400 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }

  // La sucursal se toma del perfil si el usuario es de sucursal (no se puede falsear).
  const meta = session.user.user_metadata || {};
  const sucursal = (meta.role === "sucursal" ? String(meta.sucursal || "") : String(body?.sucursal || "")).toUpperCase().trim();
  const imagenes = Array.isArray(body?.imagenes) ? body.imagenes.slice(0, 6) : [];
  if (!sucursal) return NextResponse.json({ error: "Falta la sucursal" }, { status: 400 });
  if (!imagenes.length) return NextResponse.json({ error: "No se recibieron imágenes" }, { status: 400 });

  const supabase = await createClient();

  // La foto NO se guarda aquí: se archiva hasta que la persona presione
  // "Aceptar y guardar" (en /guardar). Así nunca queda una foto sin datos.

  // 1) Región + catálogo de precios.
  const { data: reg } = await supabase.from("sucursal_region").select("region").eq("sucursal", sucursal).maybeSingle();
  const region = reg?.region === "JUAREZ" ? "JUAREZ" : "CHIHUAHUA";
  const { data: precios } = await supabase.from("precios").select("producto,producto_norm,tamano,costo,precio_venta").eq("region", region);
  const ctx = contextoPrecios(precios || []);
  const catalogo = ctx.prods.slice().sort().join("\n");

  // 2) Transcribir con IA.
  const modelo = process.env.BITACORA_MODEL || "claude-sonnet-5";
  let filas, usage = null;
  try {
    const r = await transcribir({ imagenes, catalogo, modelo });
    filas = r.filas; usage = r.usage;
  } catch (e) {
    const esAuth = /authentication|api key|x-api-key|401/i.test(e?.message || "");
    return NextResponse.json({ error: esAuth ? "La API key de Anthropic es inválida." : "No se pudo transcribir la imagen: " + (e?.message || "error") }, { status: 500 });
  }

  // 3) Armar borrador costeado (SIN guardar todavía).
  const hoy = hoyMx();
  const rows = [];
  for (const f of filas) {
    const producto = String(f?.producto || "").trim();
    if (!producto) continue;
    let fe = String(f?.fecha || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fe)) fe = hoy;
    if (fe > hoy) { const corr = hoy.slice(0, 7) + fe.slice(7); fe = corr <= hoy ? corr : hoy; }
    const cantidad = Number(f?.cantidad) > 0 ? Number(f.cantidad) : 1;
    const motivo = f?.motivo === "daño" || f?.motivo === "dano" ? "daño" : "caducidad";
    const tam = f?.tamano === "CH" ? "CH" : "GD";
    const c = costear(f?.catalogo || producto, tam, ctx, f?.catalogo);
    rows.push({
      fecha: fe,
      cantidad,
      motivo,
      insumo: c.display,
      tam: c.tam,
      importe_costo: c.importe_unit != null ? c.importe_unit * cantidad : null,
      precio_publico: c.publico,
    });
  }

  // 4) Registrar el costo de la IA.
  try {
    await supabase.from("ia_uso").insert({
      sucursal, modelo,
      input_tokens: usage?.input_tokens || 0,
      output_tokens: usage?.output_tokens || 0,
      costo_usd: costoUSD(modelo, usage),
    });
  } catch {}

  return NextResponse.json({ ok: true, sucursal, rows });
}
