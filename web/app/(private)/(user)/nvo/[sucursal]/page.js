import Link from "next/link";
import { createClient } from "@/libs/supabase/server";
import Sidebar from "@/components/Sidebar";
import ButtonAccount from "@/components/ButtonAccount";
import BotonActualizar from "@/components/BotonActualizar";
import MermaNvo from "@/components/MermaNvo";
import BitacoraUpload from "@/components/BitacoraUpload";
import HistorialFotos from "@/components/HistorialFotos";
import GraficaSemanal from "@/components/GraficaSemanal";
import TopProductos from "@/components/TopProductos";

export const dynamic = "force-dynamic";

const titulo = (s) => String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default async function NvoPage({ params }) {
  const supabase = await createClient();
  const { sucursal: raw } = await params;
  const pedida = decodeURIComponent(raw || "").toUpperCase();

  const { data: sucursalesRows } = await supabase.from("v_sucursales_merma").select("sucursal");
  const sucursales = (sucursalesRows || []).map((r) => r.sucursal).sort();
  const sucursal = sucursales.includes(pedida) ? pedida : sucursales[0] || "FUENTES MARES";

  const [{ data: rows }, { data: bitacora }, { data: semanas }, { data: reg }] = await Promise.all([
    supabase.from("merma_costeada").select("fecha,insumo,cantidad,motivo_tipo,costo_unit,precio_publico,importe_costo").eq("sucursal", sucursal),
    supabase.from("bitacora_merma").select("fecha,insumo,cantidad,motivo_tipo,precio_publico,importe_costo").eq("sucursal", sucursal),
    supabase.from("v_merma_semanal").select("lunes,pesos,piezas").eq("sucursal", sucursal).order("lunes", { ascending: false }).limit(16),
    supabase.from("sucursal_region").select("region").eq("sucursal", sucursal).maybeSingle(),
  ]);

  const histChart = [...(semanas || [])].reverse();
  const zona = reg?.region === "JUAREZ" ? "Juárez" : "Chihuahua";

  // Historial de fotos subidas: fecha, hora y quién la subió.
  const { data: fotosRaw } = await supabase
    .from("bitacora_fotos").select("id,subido_por,creado_en")
    .eq("sucursal", sucursal).order("creado_en", { ascending: false }).limit(60);
  const fotos = (fotosRaw || []).map((f) => ({ id: f.id, creado_en: f.creado_en, subido_por: f.subido_por }));

  return (
    <div className="dn-brand flex min-h-screen">
      <Sidebar />

      <main className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        <div className="px-6 md:px-12 py-8 max-w-[1280px] mx-auto w-full flex flex-col gap-8">
          {/* Encabezado */}
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <p className="eyebrow">Vista nueva</p>
              <h1 className="font-headline text-4xl md:text-[42px] leading-tight text-[var(--on-surface)] mt-2">
                Merma <span className="text-[var(--on-surface-variant)]">— {titulo(sucursal)}</span>
              </h1>
              <div className="w-12 h-[3px] rounded-full bg-[var(--primary)] mt-3" />
              <div className="flex items-center gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] border border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" /> Zona {zona}
                </span>
                <span className="text-sm text-[var(--on-surface-variant)]">
                  Por semana → día, clasificada en caducidad / daño (fecha real del comentario)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BotonActualizar sucursal={sucursal} />
              <ButtonAccount />
            </div>
          </div>

          {/* Pestañas de sucursal */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mt-2">
            {sucursales.map((s) => (
              <Link
                key={s}
                href={`/nvo/${encodeURIComponent(s)}`}
                className={`px-4 py-1.5 rounded-full font-label text-[12px] whitespace-nowrap transition-colors ${
                  s === sucursal
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
                }`}
              >
                {titulo(s)}
              </Link>
            ))}
          </div>

          {/* ── Bitácora de la sucursal ── */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
              <h2 className="font-headline text-2xl text-[var(--on-surface)]">Bitácora de la sucursal</h2>
            </div>
            <p className="text-sm text-[var(--on-surface-variant)] -mt-1">
              Sube la foto de la libreta donde el personal anota la merma a mano. De esa imagen se transcribe la tabla
              de abajo, idéntica a la del sistema, para poder compararlas.
            </p>
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Izquierda: subir / procesar foto */}
              <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
                <p className="eyebrow mb-3">Subir bitácora</p>
                <BitacoraUpload sucursal={sucursal} />
              </div>
              {/* Derecha: historial de fotos subidas */}
              <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
                <p className="eyebrow mb-3">Historial de fotos subidas</p>
                <HistorialFotos fotos={fotos} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-1.5 h-3.5 rounded-full bg-[var(--on-surface-variant)]" />
              <h3 className="font-label text-sm tracking-wide text-[var(--on-surface-variant)] uppercase">Según la bitácora</h3>
            </div>
            {bitacora && bitacora.length ? (
              <MermaNvo rows={bitacora} />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--outline-variant)] p-6 text-center text-sm text-[var(--on-surface-variant)]">
                Aún no hay bitácora transcrita. Sube la foto y la convertimos en esta tabla.
              </div>
            )}
          </section>

          {/* ── Según el sistema (POS) ── */}
          <section className="flex flex-col gap-4 border-t border-[var(--outline-variant)] pt-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[var(--on-surface-variant)]" />
              <h2 className="font-headline text-2xl text-[var(--on-surface)]">Según el sistema (POS)</h2>
            </div>
            <MermaNvo rows={rows || []} />
          </section>

          {/* ── Histórico semanal ── */}
          <section className="flex flex-col gap-4 border-t border-[var(--outline-variant)] pt-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
              <h2 className="font-headline text-2xl text-[var(--on-surface)]">Histórico semanal</h2>
            </div>
            <GraficaSemanal data={histChart} />
          </section>

          {/* ── Productos por motivo (con selector de semanas) ── */}
          <section className="border-t border-[var(--outline-variant)] pt-8">
            <TopProductos rows={rows || []} />
          </section>

          <p className="text-xs text-[var(--on-surface-variant)] border-t border-[var(--outline-variant)] pt-4">
            La columna <b>Público</b> se llena al cargar la lista con precio de menú. El costo usado es el vigente al
            momento; los cambios de precio aplican de ahí en adelante.
          </p>
        </div>
      </main>
    </div>
  );
}
