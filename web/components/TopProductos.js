"use client";

import { useMemo, useState } from "react";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pesos0 = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

// --- fechas (solo la parte YYYY-MM-DD) ---
function parts(dstr) {
  const [y, m, d] = dstr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { y, m, d, dt, dow: (dt.getUTCDay() + 6) % 7 };
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
  const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7);
}
function addDays(dstr, n) {
  const { dt } = parts(dstr);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
const etiqDia = (dstr) => {
  const { d, m } = parts(dstr);
  return `${d} ${MESES[m - 1]}`;
};

function Barra({ pct }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--bar-track)] w-full overflow-hidden">
      <div className="h-full rounded-full bg-[var(--bar-fill)]" style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}

function topPorMotivo(rows, motivo, limite = 8) {
  const map = new Map();
  for (const r of rows || []) {
    const b = r.motivo_tipo === "caducidad" ? "caducidad" : r.motivo_tipo === "daño" || r.motivo_tipo === "dano" ? "daño" : "otros";
    if (b !== motivo) continue;
    const e = map.get(r.insumo) || { insumo: r.insumo, pesos: 0, piezas: 0, costo_unit: null, tiene_costo: false };
    e.pesos += Number(r.importe_costo || 0);
    e.piezas += Number(r.cantidad || 0);
    if (r.costo_unit != null) { e.costo_unit = Number(r.costo_unit); e.tiene_costo = true; }
    map.set(r.insumo, e);
  }
  return [...map.values()].sort((a, b) => b.pesos - a.pesos).slice(0, limite);
}

function TablaTop({ titulo, items, max, color }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-4 rounded-full" style={{ background: color }} />
        <h3 className="font-headline text-xl text-[var(--on-surface)]">{titulo}</h3>
      </div>
      <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--on-surface-variant)]">Sin datos en estas semanas</p>
        ) : (
          items.map((p, i) => {
            const pct = p.tiene_costo ? (p.pesos / max) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-4 px-5 py-3 border-t border-[var(--outline-variant)]/70 first:border-t-0">
                <span className="w-4 text-[var(--muted-soft)] font-label text-sm">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${!p.tiene_costo ? "text-[var(--error)]" : "text-[var(--on-surface)]"}`}>{p.insumo}</p>
                  <p className="text-xs text-[var(--primary)] mt-0.5">{Math.round(p.piezas)} pz · costo {p.costo_unit != null ? pesos0(p.costo_unit) : "—"}</p>
                </div>
                <div className="w-16 hidden sm:block"><Barra pct={pct} /></div>
                <span className="w-20 text-right font-headline text-lg tnum">{p.tiene_costo ? pesos0(p.pesos) : "s/p"}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function TopProductos({ rows }) {
  // Semanas con datos, ordenadas
  const weeks = useMemo(() => {
    const set = new Map();
    for (const r of rows || []) {
      const day = String(r.fecha || "").slice(0, 10);
      if (!day) continue;
      const mon = mondayOf(day);
      if (!set.has(mon)) set.set(mon, { monday: mon, num: isoWeek(day) });
    }
    return [...set.values()].sort((a, b) => (a.monday < b.monday ? -1 : 1));
  }, [rows]);

  // Selección de rango: {a, b} índices; null = todas
  const [sel, setSel] = useState({ a: null, b: null });
  const clickWeek = (i) => setSel((s) => (s.a === null || s.b !== null ? { a: i, b: null } : { a: s.a, b: i }));
  const reset = () => setSel({ a: null, b: null });

  const hasSel = sel.a !== null;
  const start = hasSel ? Math.min(sel.a, sel.b ?? sel.a) : 0;
  const end = hasSel ? Math.max(sel.a, sel.b ?? sel.a) : Math.max(0, weeks.length - 1);
  const eligiendo = hasSel && sel.b === null; // esperando segundo clic

  const desde = weeks.length ? weeks[start].monday : null;
  const hasta = weeks.length ? addDays(weeks[end].monday, 6) : null;

  const filt = useMemo(
    () => (rows || []).filter((r) => { const d = String(r.fecha || "").slice(0, 10); return desde && d >= desde && d <= hasta; }),
    [rows, desde, hasta]
  );
  const topMermados = useMemo(() => topPorMotivo(filt, "caducidad"), [filt]);
  const topDanados = useMemo(() => topPorMotivo(filt, "daño"), [filt]);
  const maxMerm = Math.max(1, ...topMermados.map((p) => p.pesos));
  const maxDan = Math.max(1, ...topDanados.map((p) => p.pesos));

  const nSel = end - start + 1;
  const etiqueta = !weeks.length
    ? "sin datos"
    : `${nSel === weeks.length && !hasSel ? "Todas las semanas · " : ""}${etiqDia(desde)} → ${etiqDia(hasta)} · ${nSel} sem`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
          <h2 className="font-headline text-2xl text-[var(--on-surface)]">Productos por motivo</h2>
        </div>
        <button
          onClick={reset}
          className={`px-4 py-1.5 rounded-full font-label text-[12px] transition-colors ${
            !hasSel ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
          }`}
        >
          Todas
        </button>
      </div>

      {/* Selector de semanas (calendario por semana) */}
      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
        <p className="text-xs text-[var(--on-surface-variant)] mb-2 px-1">
          {eligiendo ? "Elige la semana final del rango…" : "Clic en una semana para elegirla · clic en otra para un rango"}
        </p>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {weeks.map((w, i) => {
            const enRango = i >= start && i <= end;
            const activo = hasSel && enRango;
            return (
              <button
                key={w.monday}
                onClick={() => clickWeek(i)}
                className={`flex flex-col items-start px-3 py-2 rounded-xl border whitespace-nowrap transition-colors ${
                  activo
                    ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
                    : "border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
                }`}
              >
                <span className="font-label text-[11px] tracking-wide">Sem {w.num}</span>
                <span className="tnum text-[11px]">{etiqDia(w.monday)}–{etiqDia(addDays(w.monday, 6))}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--on-surface-variant)] mt-2 px-1 tnum">Periodo: {etiqueta}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TablaTop titulo="Productos más mermados" items={topMermados} max={maxMerm} color="var(--primary)" />
        <TablaTop titulo="Productos más dañados" items={topDanados} max={maxDan} color="var(--error)" />
      </div>
    </div>
  );
}
