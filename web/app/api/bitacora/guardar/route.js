import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";
import { contextoPrecios, costear, mapaAlias } from "@/libs/costeo";
import { driveConfigurado, subirADrive } from "@/libs/drive";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const okFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const hoyMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

export async function POST(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }

  const meta = session.user.user_metadata || {};
  const sucursal = (meta.role === "sucursal" ? String(meta.sucursal || "") : String(body?.sucursal || "")).toUpperCase().trim();
  const entrada = Array.isArray(body?.rows) ? body.rows : [];
  const imagenes = Array.isArray(body?.imagenes) ? body.imagenes.slice(0, 6) : [];
  if (!sucursal) return NextResponse.json({ error: "Falta la sucursal" }, { status: 400 });
  if (!entrada.length) return NextResponse.json({ error: "No hay renglones para guardar" }, { status: 400 });

  const supabase = await createClient();

  // Región + catálogo para re-costear (nunca confiamos en el costo del cliente).
  const { data: reg } = await supabase.from("sucursal_region").select("region").eq("sucursal", sucursal).maybeSingle();
  const region = reg?.region === "JUAREZ" ? "JUAREZ" : "CHIHUAHUA";
  const { data: precios } = await supabase.from("precios").select("producto,producto_norm,tamano,costo,precio_venta").eq("region", region);
  const ctx = contextoPrecios(precios || []);
  const { data: aliasRows } = await supabase.from("alias_bitacora").select("texto,producto_norm,tamano,region");
  const aliasMap = mapaAlias(aliasRows, region);

  const registros = [];
  const fechas = new Set();
  for (const f of entrada) {
    const insumo = String(f?.insumo || "").trim();
    const fecha = String(f?.fecha || "").slice(0, 10);
    if (!insumo || !okFecha(fecha)) continue;
    const cantidad = Number(f?.cantidad) > 0 ? Number(f.cantidad) : 1;
    const motivo = f?.motivo === "daño" || f?.motivo === "dano" ? "daño" : "caducidad";
    const tam = f?.tam === "CH" ? "CH" : "GD";
    const c = costear(insumo, tam, ctx, null, aliasMap);
    fechas.add(fecha);
    registros.push({
      sucursal, fecha, insumo: c.display, cantidad, motivo_tipo: motivo,
      importe_costo: c.importe_unit != null ? c.importe_unit * cantidad : null,
      precio_publico: c.publico,
    });
  }
  if (!registros.length) return NextResponse.json({ error: "No se detectaron renglones válidos" }, { status: 422 });

  // Reemplaza solo los días presentes en esta carga (no borra otros días).
  const { error: delErr } = await supabase.from("bitacora_merma").delete().eq("sucursal", sucursal).in("fecha", [...fechas]);
  if (delErr) return NextResponse.json({ error: "Error al reemplazar: " + delErr.message }, { status: 500 });
  const { error: insErr } = await supabase.from("bitacora_merma").insert(registros);
  if (insErr) return NextResponse.json({ error: "Error al guardar: " + insErr.message }, { status: 500 });

  // Ya que se guardaron los datos, archivamos la(s) foto(s): en Drive si está
  // configurado; si no, en Supabase Storage. Un fallo aquí no tira el guardado.
  const fecha = hoyMx();
  const folder = sucursal.replace(/\s+/g, "_");
  const usarDrive = driveConfigurado();
  let fotosGuardadas = 0;
  for (let i = 0; i < imagenes.length; i++) {
    const m = /^data:(image\/[a-zA-Z]+);base64,(.+)$/s.exec(String(imagenes[i]));
    if (!m) continue;
    const buf = Buffer.from(m[2], "base64");
    const ext = m[1].split("/")[1] || "jpg";
    try {
      if (usarDrive) {
        const filename = `${fecha} ${sucursal} ${i + 1}.${ext}`;
        const id = await subirADrive({ buffer: buf, filename, mime: m[1], sucursal });
        await supabase.from("bitacora_fotos").insert({ sucursal, fecha, drive_id: id, origen: "drive", subido_por: session.user.email, leida: true, renglones: registros.length });
      } else {
        const path = `${folder}/${fecha}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("bitacoras").upload(path, buf, { contentType: m[1], upsert: true });
        if (upErr) throw upErr;
        await supabase.from("bitacora_fotos").insert({ sucursal, fecha, storage_path: path, origen: "supabase", subido_por: session.user.email, leida: true, renglones: registros.length });
      }
      fotosGuardadas++;
    } catch (e) {
      console.error("guardar foto:", e?.message);
    }
  }

  const totCosto = registros.reduce((a, x) => a + (x.importe_costo || 0), 0);
  const sinCosto = registros.filter((x) => x.importe_costo == null).length;
  return NextResponse.json({ ok: true, sucursal, renglones: registros.length, totCosto, sinCosto, fotos: fotosGuardadas });
}
