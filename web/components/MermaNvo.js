"use client";

import { useMemo, useState } from "react";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const peso0 = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

// --- utilidades de fecha (usa solo la parte YYYY-MM-DD, sin líos de zona) ---
function parts(dstr) {
  const [y, m, d] = dstr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { y, m, d, dt, dow: (dt.getUTCDay() + 6) % 7 }; // dow: 0=Lun … 6=Dom
}
function mondayOf(dstr) {
  const { dt, dow } = parts(dstr);
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}
function isoWeek(dstr) {
  const { dt } = parts(dstr);
  const t = new Date(dt);
  const dn = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dn + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}
function addDays(dstr, n) {
  const { dt } = parts(dstr);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
const etiqueta = (dstr) => {
  const { d, m } = parts(dstr);
  return `${d} ${MESES[m - 1]}`;
};

const bucketOf = (m) => (m === "caducidad" ? "caducidad" : m === "daño" || m === "dano" ? "daño" : "otros");
const MOT = {
  caducidad: { lab: "Caducidad", color: "var(--primary)" },
  daño: { lab: "Daño", color: "var(--error)" },
  otros: { lab: "Sin clasificar", color: "var(--on-surface-variant)" },
};

const hoyStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const semanaVacia = (monday, day) => ({
  monday,
  num: isoWeek(day),
  days: Array.from({ length: 7 }, () => []),
  tot: { costo: 0, publico: 0, pz: 0, byb: { caducidad: 0, daño: 0, otros: 0 } },
});

export default function MermaNvo({ rows }) {
  const curMon = useMemo(() => mondayOf(hoyStr()), []);

  const weeks = useMemo(() => {
    const map = {};
    for (const r of rows || []) {
      const day = (r.fecha || "").slice(0, 10);
      if (!day) continue;
      const wk = mondayOf(day);
      const w =
        map[wk] ||
        (map[wk] = {
          monday: wk,
          num: isoWeek(day),
          days: Array.from({ length: 7 }, () => []),
          tot: { costo: 0, publico: 0, pz: 0, byb: { caducidad: 0, daño: 0, otros: 0 } },
        });
      const { dow } = parts(day);
      const b = bucketOf(r.motivo_tipo);
      const costo = Number(r.importe_costo || 0);
      const publico = Number(r.precio_publico || 0) * Number(r.cantidad || 0);
      w.days[dow].push({ insumo: r.insumo, cant: Number(r.cantidad || 0), b, costo, publico });
      w.tot.costo += costo;
      w.tot.publico += publico;
      w.tot.pz += Number(r.cantidad || 0);
      w.tot.byb[b] += costo;
    }
    // Asegurar que la SEMANA EN CURSO siempre aparezca (aunque no tenga merma).
    if (!map[curMon]) map[curMon] = semanaVacia(curMon, hoyStr());
    return map;
  }, [rows, curMon]);

  const keys = Object.keys(weeks).sort();
  const [sel, setSel] = useState(curMon);
  const selKey = weeks[sel] ? sel : keys[keys.length - 1];
  const w = selKey ? weeks[selKey] : null;

  return (
    <div className="flex flex-col gap-7">
      {/* Selector de semanas */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {keys.map((k) => {
          const wk = weeks[k];
          const activo = k === selKey;
          const enCurso = k === curMon;
          return (
            <button
              key={k}
              onClick={() => setSel(k)}
              className={`flex flex-col items-start px-3.5 py-2 rounded-xl border whitespace-nowrap transition-colors ${
                activo
                  ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
                  : `border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] ${enCurso ? "border-[var(--primary)]" : ""}`
              }`}
            >
              <span className="font-label text-[11px] tracking-wide flex items-center gap-1">
                Sem {wk.num}
                {enCurso && <span className={`w-1.5 h-1.5 rounded-full ${activo ? "bg-[var(--on-primary)]" : "bg-[var(--primary)]"}`} />}
              </span>
              <span className="tnum text-[13px] font-semibold">{enCurso && wk.tot.costo === 0 ? "en curso" : peso0(wk.tot.costo)}</span>
            </button>
          );
        })}
      </div>

      {w && (
        <>
          {/* Resumen de la semana */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
              <p className="eyebrow">Merma costo</p>
              <p className="tnum text-2xl font-semibold text-[var(--primary)] mt-1">{peso0(w.tot.costo)}</p>
              <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">Semana {w.num}</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
              <p className="eyebrow">Merma público</p>
              <p className="tnum text-2xl font-semibold mt-1">{w.tot.publico > 0 ? peso0(w.tot.publico) : "—"}</p>
              <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">{w.tot.publico > 0 ? "a precio de menú" : "falta cargar lista"}</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
              <p className="eyebrow">Unidades</p>
              <p className="tnum text-2xl font-semibold mt-1">{w.tot.pz}</p>
              <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">piezas mermadas</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
              <p className="eyebrow mb-2">Por motivo</p>
              <div className="flex flex-col gap-1.5">
                {["caducidad", "daño", "otros"].map((b) => (
                  <div key={b} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: MOT[b].color }} />
                      {MOT[b].lab}
                    </span>
                    <span className="tnum font-medium">{peso0(w.tot.byb[b])}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rejilla de la semana: 7 días */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {w.days.map((items, i) => {
              const fecha = addDays(w.monday, i);
              const dCosto = items.reduce((a, x) => a + x.costo, 0);
              const dCad = items.filter((x) => x.b === "caducidad").reduce((a, x) => a + x.costo, 0);
              const dDano = items.filter((x) => x.b === "daño").reduce((a, x) => a + x.costo, 0);
              const vacio = items.length === 0;
              return (
                <div
                  key={i}
                  className={`rounded-2xl border p-3 flex flex-col min-h-[120px] ${
                    vacio
                      ? "border-dashed border-[var(--outline-variant)] bg-transparent"
                      : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="font-label text-[11px] tracking-wide text-[var(--on-surface-variant)]">{DIAS[i]}</span>
                    <span className="tnum text-[11px] text-[var(--on-surface-variant)]">{etiqueta(fecha)}</span>
                  </div>

                  {vacio ? (
                    <div className="flex-1 grid place-items-center">
                      <span className="text-[var(--on-surface-variant)] opacity-40 text-lg">·</span>
                    </div>
                  ) : (
                    <>
                      <ul className="flex flex-col gap-1.5 flex-1">
                        {items.map((it, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-[12px] leading-tight">
                            <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: MOT[it.b].color }} title={MOT[it.b].lab} />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate text-[var(--on-surface)]">
                                {it.cant > 1 && <b>{it.cant}× </b>}
                                {it.insumo}
                              </span>
                            </span>
                            <span className="tnum text-[var(--on-surface-variant)] shrink-0">{peso0(it.costo)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 pt-2 border-t border-[var(--outline-variant)] flex flex-col gap-0.5">
                        {dCad > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: "var(--primary)" }}>Caducidad</span>
                            <span className="tnum">{peso0(dCad)}</span>
                          </div>
                        )}
                        {dDano > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: "var(--error)" }}>Daño</span>
                            <span className="tnum">{peso0(dDano)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[12px] font-semibold">
                          <span>Total día</span>
                          <span className="tnum">{peso0(dCosto)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
