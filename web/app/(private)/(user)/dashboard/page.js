import { createClient } from "@/libs/supabase/server";
import ButtonAccount from "@/components/ButtonAccount";
import BotonActualizar from "@/components/BotonActualizar";
import Sidebar from "@/components/Sidebar";
import GraficaSemanal from "@/components/GraficaSemanal";
import Barra from "@/components/Barra";
import PestanasSucursal from "@/components/PestanasSucursal";
import LineaCobertura from "@/components/consolidado/LineaCobertura";
import AportePorSucursal from "@/components/consolidado/AportePorSucursal";
import DesglosePorRegion from "@/components/consolidado/DesglosePorRegion";
import BandaAvisos from "@/components/consolidado/BandaAvisos";
import { pesos0, piezas, diaMes, fechaHora } from "@/libs/formato";
import {
  CENTINELA,
  resolverSucursal,
  datosCadena,
  datosSucursal,
  normalizarRanking,
  esAproximado,
  construirAvisos,
  limitesSemana,
} from "@/libs/consolidado";

export const dynamic = "force-dynamic";

export default async function DashboardMerma({ searchParams }) {
  const supabase = await createClient();

  const [{ data: sucursalesRows }, { data: catalogoRows }] = await Promise.all([
    supabase.from("v_sucursales_merma").select("sucursal"),
    supabase.from("sucursales").select("sucursal, nombre_display"),
  ]);
  const sucursales = (sucursalesRows || []).map((r) => r.sucursal);
  const mapaDisplay = Object.fromEntries((catalogoRows || []).map((r) => [r.sucursal, r.nombre_display]));

  const sp = (await searchParams) || {};
  const sucursal = resolverSucursal(sucursales, sp.sucursal);
  const esCadena = sucursal === CENTINELA;
  const nombreDisplay = mapaDisplay[sucursal] || sucursal;

  const d = esCadena ? await datosCadena(supabase) : await datosSucursal(supabase, sucursal);

  const filas = d.diaria || [];
  const ranking = normalizarRanking(d.productos || []);
  const sinPrecio = (d.productos || []).filter((p) => !p.tiene_costo);

  const maxProd = Math.max(1, ...ranking.map((p) => Number(p.pesos || 0)));
  const maxSem = Math.max(1, ...(d.semanas || []).map((s) => Number(s.pesos || 0)));
  const histChart = [...(d.semanas || [])].reverse(); // cronológico (viejo → nuevo)

  // ── Semana en curso (lunes a domingo de hoy) ──
  const isoWeek = (fecha) => {
    const t = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const dd = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - dd + 3);
    const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const fd = (f.getUTCDay() + 6) % 7;
    f.setUTCDate(f.getUTCDate() - fd + 3);
    return 1 + Math.round((t - f) / (7 * 864e5));
  };
  const hoy = new Date();
  // Mismos límites de semana que usa `datosCadena` para acotar v_consolidado_aporte_semanal
  // (hito 5): el periodo de Aporte por sucursal tiene que ser exactamente el del héroe, o el
  // indicador de cuadre no da.
  const { lunesActual: lunesActStr, domingoActual: domActStr, lunesPrevio: lunesPrevStr } = limitesSemana(hoy);

  const semActual =
    (d.semanas || []).find((s) => s.lunes === lunesActStr) ||
    { semana: isoWeek(hoy), lunes: lunesActStr, domingo: domActStr, pesos: 0, piezas: 0, dias_con_captura: 0 };
  const semPrev = (d.semanas || []).find((s) => s.lunes === lunesPrevStr);
  const deltaPct =
    semPrev && Number(semPrev.pesos) > 0
      ? ((Number(semActual.pesos || 0) - Number(semPrev.pesos)) / Number(semPrev.pesos)) * 100
      : null;

  // F8 — solo en modo cadena; la vista individual siempre da `aproximado: false`.
  const aprox = esCadena
    ? esAproximado({
        n: semActual.sucursales_aportantes,
        m: d.cadena.m,
        cobertura: d.cadena.cobertura,
        regiones: d.cadena.regiones,
        piezasSinValorizar: semActual.piezas_sin_valorizar,
      })
    : { aproximado: false, motivos: [] };

  // Hito 5 — banda de avisos y Aporte por sucursal, solo en modo cadena. El periodo de Aporte
  // es la misma semana en curso que el héroe (lunesActStr, calculado arriba con la misma
  // función que usó `datosCadena`).
  const avisos = esCadena
    ? construirAvisos({
        cobertura: d.cadena.cobertura,
        regiones: d.cadena.regiones,
        insumosHueco: d.cadena.insumosHueco,
        costoSospechoso: d.cadena.costoSospechoso,
      })
    : [];
  const aporteSemanaActual = esCadena
    ? (d.cadena.aporte || []).filter((a) => a.lunes === lunesActStr)
    : [];

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
                Merma <span className="text-[var(--on-surface-variant)]">— {esCadena ? "Toda la cadena" : nombreDisplay}</span>
              </h1>
              <div className="w-12 h-[3px] rounded-full bg-[var(--primary)] mt-3" />
              {esCadena ? (
                <LineaCobertura n={semActual.sucursales_aportantes} m={d.cadena.m} cobertura={d.cadena.cobertura} />
              ) : (
                <p className="text-sm text-[var(--on-surface-variant)] mt-4">
                  Actualizado {fechaHora(d.sync?.ultima_corrida)}{d.sync?.filas != null && ` · ${d.sync.filas} movimientos`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <BotonActualizar sucursal={esCadena ? null : sucursal} rotulo={esCadena ? "Actualizar todas" : undefined} />
              <ButtonAccount />
            </div>
          </div>

          {/* Pestañas de sucursal */}
          <PestanasSucursal sucursales={sucursales} mapaDisplay={mapaDisplay} actual={sucursal} />

          {/* Avisos de conciliación (hito 5) — solo modo cadena */}
          {esCadena && <BandaAvisos avisos={avisos} />}

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
              <p className="font-headline text-6xl md:text-7xl font-bold tnum mt-6 leading-none">
                {aprox.aproximado && "≈"}{pesos0(semActual.pesos)}
              </p>
              {aprox.aproximado && (
                <p className="text-xs text-white/70 mt-2">{aprox.motivos.join(" · ")}</p>
              )}
              <div className="flex items-center gap-4 mt-5 text-sm text-white/85">
                <span className="font-medium">{piezas(semActual.piezas)} piezas</span>
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
              <p className="text-sm text-white/80 mt-2">{semPrev ? `${piezas(semPrev.piezas)} piezas` : "sin registro"}</p>
            </div>
          </div>

          {/* Aporte por sucursal y desglose por región (hito 5) — solo modo cadena. Es la
              prueba de conciliación hecha pantalla: el indicador de cuadre al pie de Aporte
              compara centavos enteros contra el héroe de arriba. */}
          {esCadena && (
            <AportePorSucursal
              cobertura={d.cadena.cobertura}
              aporte={aporteSemanaActual}
              heroPesos={semActual.pesos}
              heroPiezas={semActual.piezas}
            />
          )}
          {esCadena && <DesglosePorRegion regiones={d.cadena.regiones} />}

          {/* Clasificación por motivo */}
          <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] px-5 py-4">
            <p className="eyebrow mb-3">Clasificación de la merma · todo el periodo</p>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              {[
                { k: "caducidad", icon: "⏳" },
                { k: "daño", icon: "💥" },
                { k: "sin clasificar", icon: "❓" },
              ].map(({ k, icon }) => {
                const row = (d.tipos || []).find((t) => t.tipo === k) || { piezas: 0, pesos: 0 };
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
              {ranking.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-[var(--on-surface-variant)]">Sin datos</p>
              ) : (
                <div>
                  {ranking.map((p, i) => {
                    const pct = p.tiene_costo ? (Number(p.pesos || 0) / maxProd) * 100 : 0;
                    return (
                      <div key={p.id} className="flex items-center gap-4 px-5 py-3 border-t border-[var(--outline-variant)]/70">
                        <span className="w-4 text-[var(--muted-soft)] font-label text-sm">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${!p.tiene_costo ? "text-[var(--error)]" : "text-[var(--on-surface)]"}`}>{p.insumo}</p>
                          <p className="text-xs text-[var(--primary)] mt-0.5">{piezas(p.piezas)} pz · costo {p.costo_texto}</p>
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
              {(d.semanas || []).length === 0 ? (
                <p className="px-5 pb-6 text-sm text-[var(--on-surface-variant)]">Sin datos</p>
              ) : (
                <div>
                  {(d.semanas || []).slice(0, 8).map((s) => {
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
                            <span className="text-xs text-[var(--on-surface-variant)] ml-2">{piezas(s.piezas)} pz</span>
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
                  {filas.map((fila) => (
                    <tr key={fila.fecha} className="border-t border-[var(--outline-variant)]/70">
                      <td className="px-5 py-3 text-sm">{fila.fecha}</td>
                      <td className="px-5 py-3 text-sm text-right tnum text-[var(--on-surface-variant)]">{piezas(fila.piezas)} pz</td>
                      <td className="px-5 py-3 text-right font-headline text-base tnum w-32">{pesos0(fila.pesos)}</td>
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
