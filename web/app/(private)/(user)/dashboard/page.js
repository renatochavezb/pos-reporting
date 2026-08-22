import Link from "next/link";
import { createClient } from "@/libs/supabase/server";
import ButtonAccount from "@/components/ButtonAccount";
import BotonActualizar from "@/components/BotonActualizar";
import Sidebar from "@/components/Sidebar";
import GraficaSemanal from "@/components/GraficaSemanal";

export const dynamic = "force-dynamic";

const pesos = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
const pesos0 = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaMes = (s) => {
  if (!s) return "";
  const [, m, d] = s.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]}`;
};
const fechaHora = (iso) =>
  !iso ? "—" : new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso));

// barra de progreso (estética Programa DN)
function Barra({ pct }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--bar-track)] w-full overflow-hidden">
      <div className="h-full rounded-full bg-[var(--bar-fill)]" style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}

export default async function DashboardMerma({ searchParams }) {
  const supabase = await createClient();

  const { data: sucursalesRows } = await supabase.from("v_sucursales_merma").select("sucursal");
  const sucursales = (sucursalesRows || []).map((r) => r.sucursal);
  const sp = (await searchParams) || {};
  const sucursal =
    sp.sucursal && sucursales.includes(sp.sucursal) ? sp.sucursal : sucursales[0] || "FUENTES MARES";

  const [{ data: diaria }, { data: productos }, { data: semanas }, { data: sync }, { data: ultimaCarga }, { data: tipos }] =
    await Promise.all([
      supabase.from("v_merma_diaria").select("*").eq("sucursal", sucursal).order("fecha", { ascending: false }).limit(12),
      supabase.from("v_merma_por_producto").select("*").eq("sucursal", sucursal).order("pesos", { ascending: false, nullsFirst: false }).limit(8),
      supabase.from("v_merma_semanal").select("*").eq("sucursal", sucursal).order("lunes", { ascending: false }).limit(16),
      supabase.from("sync_estado").select("*").eq("sucursal", sucursal).eq("tabla", "merma").maybeSingle(),
      supabase.from("precios_cargas").select("*").order("cargado_en", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("v_merma_por_tipo").select("*").eq("sucursal", sucursal),
    ]);

  const filas = diaria || [];
  const totalPiezas = filas.reduce((s, r) => s + Number(r.piezas || 0), 0);
  const totalPesos = filas.reduce((s, r) => s + Number(r.pesos || 0), 0);
  const diasConCaptura = filas.filter((r) => Number(r.piezas || 0) !== 0).length;
  const sinPrecio = (productos || []).filter((p) => !p.tiene_costo);

  const maxProd = Math.max(1, ...(productos || []).map((p) => Number(p.pesos || 0)));
  const maxSem = Math.max(1, ...(semanas || []).map((s) => Number(s.pesos || 0)));
  const histChart = [...(semanas || [])].reverse(); // cronológico (viejo → nuevo)

  // ── Semana en curso (lunes a domingo de hoy) ──
  const fmtD = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const isoWeek = (d) => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dd = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - dd + 3);
    const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const fd = (f.getUTCDay() + 6) % 7;
    f.setUTCDate(f.getUTCDate() - fd + 3);
    return 1 + Math.round((t - f) / (7 * 864e5));
  };
  const hoy = new Date();
  const dow = (hoy.getDay() + 6) % 7; // 0 = lunes
  const lunesAct = new Date(hoy); lunesAct.setDate(hoy.getDate() - dow);
  const domAct = new Date(lunesAct); domAct.setDate(lunesAct.getDate() + 6);
  const lunesPrev = new Date(lunesAct); lunesPrev.setDate(lunesAct.getDate() - 7);
  const lunesActStr = fmtD(lunesAct);
  const lunesPrevStr = fmtD(lunesPrev);

  const semActual =
    (semanas || []).find((s) => s.lunes === lunesActStr) ||
    { semana: isoWeek(hoy), lunes: lunesActStr, domingo: fmtD(domAct), pesos: 0, piezas: 0, dias_con_captura: 0 };
  const semPrev = (semanas || []).find((s) => s.lunes === lunesPrevStr);
  const deltaPct =
    semPrev && Number(semPrev.pesos) > 0
      ? ((Number(semActual.pesos || 0) - Number(semPrev.pesos)) / Number(semPrev.pesos)) * 100
      : null;

  return (
    <div className="dn-brand flex min-h-screen">
      <Sidebar />

      {/* ── Main ── */}
      <main className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        <div className="px-6 md:px-12 py-8 max-w-[1200px] mx-auto w-full flex flex-col gap-8">
          {/* Encabezado */}
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <p className="eyebrow">Reportes internos</p>
              <h1 className="font-headline text-4xl md:text-[42px] leading-tight text-[var(--on-surface)] mt-2">
                Merma <span className="text-[var(--on-surface-variant)]">— {sucursal}</span>
              </h1>
              <div className="w-12 h-[3px] rounded-full bg-[var(--primary)] mt-3" />
              <p className="text-sm text-[var(--on-surface-variant)] mt-4">
                Actualizado {fechaHora(sync?.ultima_corrida)}{sync?.filas != null && ` · ${sync.filas} movimientos`}
              </p>
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
                href={`/dashboard?sucursal=${encodeURIComponent(s)}`}
                className={`px-4 py-1.5 rounded-full font-label text-[12px] whitespace-nowrap transition-colors ${
                  s === sucursal
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>

          {/* Aviso: productos sin precio en la lista */}
          {sinPrecio.length > 0 && (
            <p className="text-sm text-[var(--on-surface-variant)]">
              <span className="text-[var(--primary)]">Sin precio en tu lista:</span>{" "}
              {sinPrecio.map((p) => p.insumo).join(", ")}. Agrégalos en la sección <b>Precios</b> para que se valoricen.
            </p>
          )}

          {/* ★ SEMANA EN CURSO — lo principal ★ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Semana en curso (grande) */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-3xl p-8 text-white" style={{ background: "var(--rose-hero)" }}>
              <div className="absolute -right-12 -bottom-14 w-60 h-60 rounded-full bg-white/10" />
              <div className="flex items-center justify-between gap-3">
                <p className="font-label text-[11px] tracking-[0.14em] uppercase text-white/85">
                  Semana en curso · Sem {semActual.semana}
                </p>
                {deltaPct != null && (
                  <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 font-label text-[11px]">
                    {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(0)}% vs sem. pasada
                  </span>
                )}
              </div>
              <p className="text-sm text-white/80 mt-1">{diaMes(semActual.lunes)} — {diaMes(semActual.domingo)}</p>
              <p className="font-headline text-6xl md:text-7xl font-bold tnum mt-6 leading-none">{pesos0(semActual.pesos)}</p>
              <div className="flex items-center gap-4 mt-5 text-sm text-white/85">
                <span className="font-medium">{semActual.piezas} piezas</span>
                <span className="opacity-50">·</span>
                <span>{semActual.dias_con_captura} días con captura</span>
              </div>
            </div>

            {/* Semana pasada (referencia) */}
            <div className="relative overflow-hidden rounded-3xl p-7 text-white flex flex-col justify-center" style={{ background: "var(--mauve-hero)" }}>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
              <p className="font-label text-[11px] tracking-[0.14em] uppercase text-white/85">
                Semana pasada{semPrev ? ` · Sem ${semPrev.semana}` : ""}
              </p>
              <p className="font-headline text-4xl md:text-5xl font-bold tnum mt-4">{semPrev ? pesos0(semPrev.pesos) : "—"}</p>
              <p className="text-sm text-white/80 mt-2">{semPrev ? `${semPrev.piezas} piezas` : "sin registro"}</p>
            </div>
          </div>

          {/* Clasificación por motivo */}
          <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] px-5 py-4">
            <p className="eyebrow mb-3">Clasificación de la merma · todo el periodo</p>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              {[
                { k: "caducidad", icon: "⏳" },
                { k: "daño", icon: "💥" },
                { k: "sin clasificar", icon: "❓" },
              ].map(({ k, icon }) => {
                const row = (tipos || []).find((t) => t.tipo === k) || { piezas: 0, pesos: 0 };
                return (
                  <div key={k} className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className="eyebrow">{k}</p>
                      <p className="font-headline text-2xl text-[var(--on-surface)] leading-none mt-1">
                        {Number(row.piezas || 0)} <span className="text-sm text-[var(--on-surface-variant)]">pz</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[var(--on-surface-variant)] mt-4">
              Se toma del comentario del POS. Si trae fecha (ej. &quot;DAÑO 21/08/2026&quot;), la merma se asigna a ese día.
            </p>
          </div>

          {/* Gráfica histórico semanal */}
          <GraficaSemanal data={histChart} />

          {/* Productos (ranking) + Merma por semana (zonas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Productos con más merma */}
            <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <p className="eyebrow">Productos con más merma</p>
              </div>
              {(productos || []).length === 0 ? (
                <p className="px-5 pb-6 text-sm text-[var(--on-surface-variant)]">Sin datos</p>
              ) : (
                <div>
                  {(productos || []).map((p, i) => {
                    const pct = p.tiene_costo ? (Number(p.pesos || 0) / maxProd) * 100 : 0;
                    return (
                      <div key={p.no_insumo} className="flex items-center gap-4 px-5 py-3 border-t border-[var(--outline-variant)]/70">
                        <span className="w-4 text-[var(--muted-soft)] font-label text-sm">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${!p.tiene_costo ? "text-[var(--error)]" : "text-[var(--on-surface)]"}`}>{p.insumo}</p>
                          <p className="text-xs text-[var(--primary)] mt-0.5">{p.piezas} pz · costo {p.costo_unit != null ? pesos0(p.costo_unit) : "—"}</p>
                        </div>
                        <div className="w-24 hidden sm:block"><Barra pct={pct} /></div>
                        <span className="w-20 text-right font-headline text-lg tnum">{p.tiene_costo ? pesos0(p.pesos) : "s/p"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Merma por semana */}
            <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <p className="eyebrow">Merma por semana</p>
              </div>
              {(semanas || []).length === 0 ? (
                <p className="px-5 pb-6 text-sm text-[var(--on-surface-variant)]">Sin datos</p>
              ) : (
                <div>
                  {(semanas || []).slice(0, 8).map((s) => {
                    const pct = (Number(s.pesos || 0) / maxSem) * 100;
                    return (
                      <div key={`${s.anio}-${s.semana}`} className="px-5 py-3 border-t border-[var(--outline-variant)]/70">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-label text-[13px] text-[var(--on-surface)]">Sem {s.semana}</span>
                            <span className="text-xs text-[var(--on-surface-variant)] ml-2">{diaMes(s.lunes)} — {diaMes(s.domingo)}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-headline text-base tnum">{pesos0(s.pesos)}</span>
                            <span className="text-xs text-[var(--on-surface-variant)] ml-2">{s.piezas} pz</span>
                          </div>
                        </div>
                        <Barra pct={pct} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Merma por día */}
          <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="eyebrow">Merma por día · últimos registros</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody className="text-[var(--on-surface)]">
                  {filas.map((d) => (
                    <tr key={d.fecha} className="border-t border-[var(--outline-variant)]/70">
                      <td className="px-5 py-3 text-sm">{d.fecha}</td>
                      <td className="px-5 py-3 text-sm text-right tnum text-[var(--on-surface-variant)]">{d.piezas} pz</td>
                      <td className="px-5 py-3 text-right font-headline text-base tnum w-32">{pesos0(d.pesos)}</td>
                    </tr>
                  ))}
                  {filas.length === 0 && (
                    <tr><td className="px-5 py-6 text-sm text-[var(--on-surface-variant)]">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="h-4" />
        </div>
      </main>
    </div>
  );
}
