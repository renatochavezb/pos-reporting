import { createClient } from "@/libs/supabase/server";
import Sidebar from "@/components/Sidebar";
import ButtonAccount from "@/components/ButtonAccount";
import BotonActualizar from "@/components/BotonActualizar";
import MermaNvo from "@/components/MermaNvo";
import BitacoraUpload from "@/components/BitacoraUpload";
import GraficaSemanal from "@/components/GraficaSemanal";

export const dynamic = "force-dynamic";

const pesos0 = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

function Barra({ pct }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--bar-track)] w-full overflow-hidden">
      <div className="h-full rounded-full bg-[var(--bar-fill)]" style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}

export default async function FuentesMaresNvoPage() {
  const supabase = await createClient();

  const [{ data: rows }, { data: bitacora }, { data: semanas }, { data: productos }] = await Promise.all([
    supabase
      .from("merma_costeada")
      .select("fecha,insumo,cantidad,motivo_tipo,costo_unit,precio_publico,importe_costo")
      .eq("sucursal", "FUENTES MARES"),
    supabase
      .from("bitacora_merma")
      .select("fecha,insumo,cantidad,motivo_tipo,precio_publico,importe_costo")
      .eq("sucursal", "FUENTES MARES"),
    supabase
      .from("v_merma_semanal")
      .select("lunes,pesos,piezas")
      .eq("sucursal", "FUENTES MARES")
      .order("lunes", { ascending: false })
      .limit(16),
    supabase
      .from("v_merma_por_producto")
      .select("*")
      .eq("sucursal", "FUENTES MARES")
      .order("pesos", { ascending: false, nullsFirst: false })
      .limit(8),
  ]);

  const histChart = [...(semanas || [])].reverse(); // cronológico (viejo → nuevo)
  const maxProd = Math.max(1, ...(productos || []).map((p) => Number(p.pesos || 0)));

  return (
    <div className="dn-brand flex min-h-screen">
      <Sidebar />

      <main className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        <div className="px-6 md:px-12 py-8 max-w-[1280px] mx-auto w-full flex flex-col gap-8">
          {/* Encabezado */}
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <p className="eyebrow">Vista nueva · prototipo</p>
              <h1 className="font-headline text-4xl md:text-[42px] leading-tight text-[var(--on-surface)] mt-2">
                Merma <span className="text-[var(--on-surface-variant)]">— Fuentes Mares</span>
              </h1>
              <div className="w-12 h-[3px] rounded-full bg-[var(--primary)] mt-3" />
              <div className="flex items-center gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] border border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" /> Zona Chihuahua
                </span>
                <span className="text-sm text-[var(--on-surface-variant)]">
                  Por semana → día, clasificada en caducidad / daño (fecha real del comentario)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BotonActualizar sucursal="FUENTES MARES" />
              <ButtonAccount />
            </div>
          </div>

          {/* ── Bitácora de la sucursal (primero) ── */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
              <h2 className="font-headline text-2xl text-[var(--on-surface)]">Bitácora de la sucursal</h2>
            </div>
            <p className="text-sm text-[var(--on-surface-variant)] -mt-1">
              Sube la foto de la libreta donde el personal anota la merma a mano. De esa imagen se transcribe la tabla
              de abajo, idéntica a la del sistema, para poder compararlas.
            </p>

            <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
              <BitacoraUpload sucursal="FUENTES MARES" />
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

          {/* ── Según el sistema (POS) (después) ── */}
          <section className="flex flex-col gap-4 border-t border-[var(--outline-variant)] pt-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[var(--on-surface-variant)]" />
              <h2 className="font-headline text-2xl text-[var(--on-surface)]">Según el sistema (POS)</h2>
            </div>
            <MermaNvo rows={rows || []} />
          </section>

          {/* ── Histórico semanal (al final) ── */}
          <section className="flex flex-col gap-4 border-t border-[var(--outline-variant)] pt-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
              <h2 className="font-headline text-2xl text-[var(--on-surface)]">Histórico semanal</h2>
            </div>
            <GraficaSemanal data={histChart} />
          </section>

          {/* ── Productos con más merma ── */}
          <section className="flex flex-col gap-4 border-t border-[var(--outline-variant)] pt-8">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
              <h2 className="font-headline text-2xl text-[var(--on-surface)]">Productos con más merma</h2>
            </div>
            <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
              {(productos || []).length === 0 ? (
                <p className="px-5 py-6 text-sm text-[var(--on-surface-variant)]">Sin datos</p>
              ) : (
                (productos || []).map((p, i) => {
                  const pct = p.tiene_costo ? (Number(p.pesos || 0) / maxProd) * 100 : 0;
                  return (
                    <div key={p.no_insumo} className="flex items-center gap-4 px-5 py-3 border-t border-[var(--outline-variant)]/70 first:border-t-0">
                      <span className="w-4 text-[var(--muted-soft)] font-label text-sm">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${!p.tiene_costo ? "text-[var(--error)]" : "text-[var(--on-surface)]"}`}>{p.insumo}</p>
                        <p className="text-xs text-[var(--primary)] mt-0.5">{p.piezas} pz · costo {p.costo_unit != null ? pesos0(p.costo_unit) : "—"}</p>
                      </div>
                      <div className="w-24 hidden sm:block"><Barra pct={pct} /></div>
                      <span className="w-20 text-right font-headline text-lg tnum">{p.tiene_costo ? pesos0(p.pesos) : "s/p"}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <p className="text-xs text-[var(--on-surface-variant)] border-t border-[var(--outline-variant)] pt-4">
            Prototipo del nuevo acomodo (solo Fuentes Mares). La columna <b>Público</b> se llena al cargar la lista con
            precio de menú. El costo usado es el vigente al momento; los cambios de precio aplican de ahí en adelante.
          </p>
        </div>
      </main>
    </div>
  );
}
