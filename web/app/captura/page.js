import { redirect } from "next/navigation";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";
import CapturaBitacora from "@/components/CapturaBitacora";

export const dynamic = "force-dynamic";

export default async function CapturaPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const meta = session.user.user_metadata || {};
  // Solo usuarios de sucursal usan esta pantalla; el admin va al dashboard.
  if (meta.role !== "sucursal" || !meta.sucursal) redirect("/dashboard");

  const sucursal = String(meta.sucursal).toUpperCase();
  const nombre = meta.nombre || sucursal;
  const supabase = await createClient();

  // Fotos subidas (recientes) + URLs firmadas para poder verlas.
  const { data: fotosRaw } = await supabase
    .from("bitacora_fotos").select("id,fecha,storage_path,drive_id,origen,creado_en")
    .eq("sucursal", sucursal).order("creado_en", { ascending: false }).limit(60);
  const fotos = [];
  for (const f of fotosRaw || []) {
    let url = null;
    if (f.origen === "drive" && f.drive_id) {
      url = `/api/foto?id=${encodeURIComponent(f.drive_id)}`;
    } else if (f.storage_path) {
      const { data: signed } = await supabase.storage.from("bitacoras").createSignedUrl(f.storage_path, 3600);
      url = signed?.signedUrl || null;
    }
    fotos.push({ id: f.id, fecha: f.fecha, url });
  }

  // Transcripciones registradas (conceptos de la bitácora).
  const { data: conceptos } = await supabase
    .from("bitacora_merma").select("id,fecha,insumo,cantidad,motivo_tipo,importe_costo")
    .eq("sucursal", sucursal).order("fecha", { ascending: false }).limit(200);

  return (
    <CapturaBitacora
      sucursal={sucursal}
      nombre={nombre}
      correo={session.user.email}
      fotos={fotos}
      conceptos={conceptos || []}
    />
  );
}
