import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";
import { descargarDeDrive } from "@/libs/drive";

export const dynamic = "force-dynamic";

// Sirve una foto guardada en Google Drive, pero solo a usuarios con sesión y
// solo si el id corresponde a una foto de bitácora real (no cualquier archivo).
export async function GET(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const supabase = await createClient();
  const { data: foto } = await supabase.from("bitacora_fotos").select("sucursal").eq("drive_id", id).maybeSingle();
  if (!foto) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  // Si es usuario de sucursal, solo puede ver fotos de SU sucursal.
  const meta = session.user.user_metadata || {};
  if (meta.role === "sucursal" && String(meta.sucursal || "").toUpperCase() !== String(foto.sucursal).toUpperCase())
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { buf, mime } = await descargarDeDrive(id);
    return new NextResponse(buf, { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo obtener la foto: " + (e?.message || "error") }, { status: 502 });
  }
}
