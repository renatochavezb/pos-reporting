"use client";

import { useState } from "react";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaMes = (s) => { if (!s) return ""; const [, m, d] = s.split("-"); return `${Number(d)} ${MESES[Number(m) - 1]}`; };
const money0 = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);

function niceCeil(x) {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
}

export default function GraficaSemanal({ data = [] }) {
  const [metric, setMetric] = useState("costo"); // 'costo' | 'unidades'
  const [hover, setHover] = useState(null);

  const puntos = data.map((d) => ({
    label: diaMes(d.lunes),
    semana: d.semana,
    val: metric === "costo" ? Number(d.pesos || 0) : Number(d.piezas || 0),
  }));

  if (puntos.length < 2) {
    return (
      <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] px-5 py-6">
        <p className="eyebrow mb-2">Histórico semanal</p>
        <p className="text-sm text-[var(--on-surface-variant)]">Se necesitan al menos 2 semanas con datos.</p>
      </div>
    );
  }

  const W = 720, H = 250, L = 54, R = 16, T = 18, B = 34;
  const pw = W - L - R, ph = H - T - B;
  const rawMax = Math.max(...puntos.map((p) => p.val));
  const max = niceCeil(rawMax);
  const avg = puntos.reduce((s, p) => s + p.val, 0) / puntos.length;

  const x = (i) => L + (i / (puntos.length - 1)) * pw;
  const y = (v) => T + ph - (v / max) * ph;
  const yAvg = y(avg);

  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.val).toFixed(1)}`).join(" ");
  const area = `${linea} L ${x(puntos.length - 1).toFixed(1)} ${T + ph} L ${x(0).toFixed(1)} ${T + ph} Z`;

  const fmtY = (v) => metric === "costo" ? (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`) : `${Math.round(v)}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const cada = puntos.length > 9 ? 2 : 1;

  const LINE = "#8A4B5B", FILL = "#D99AA4";

  return (
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] px-5 py-5">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <p className="eyebrow">Histórico semanal</p>
        <div className="flex gap-2">
          {[["costo", "Costo"], ["unidades", "Unidades"]].map(([k, txt]) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={`px-3 py-1.5 rounded-full font-label text-[12px] transition-colors ${
                metric === k
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
              }`}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="gradMerma" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FILL} stopOpacity="0.28" />
            <stop offset="100%" stopColor={FILL} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid + labels Y */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} y1={y(t)} x2={W - R} y2={y(t)} stroke="#EDE2DC" strokeWidth="1" />
            <text x={L - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9E8B84" fontFamily="JetBrains Mono">{fmtY(t)}</text>
          </g>
        ))}

        {/* área + línea */}
        <path d={area} fill="url(#gradMerma)" />
        <path d={linea} fill="none" stroke={LINE} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* promedio punteado */}
        <line x1={L} y1={yAvg} x2={W - R} y2={yAvg} stroke="#C4B4AD" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={W - R} y={yAvg - 6} textAnchor="end" fontSize="11" fill="#9E8B84" fontFamily="JetBrains Mono">
          Prom {metric === "costo" ? money0(avg) : Math.round(avg)}
        </text>

        {/* puntos */}
        {puntos.map((p, i) => {
          const last = i === puntos.length - 1;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <circle cx={x(i)} cy={y(p.val)} r="12" fill="transparent" />
              <circle cx={x(i)} cy={y(p.val)} r="5" fill={last || hover === i ? LINE : "#fff"} stroke={LINE} strokeWidth="2.5" />
              {(i % cada === 0 || last) && (
                <text x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="#9E8B84" fontFamily="Manrope">{p.label}</text>
              )}
            </g>
          );
        })}

        {/* tooltip */}
        {hover != null && (() => {
          const p = puntos[hover];
          const tx = Math.min(Math.max(x(hover), L + 40), W - R - 40);
          const ty = y(p.val) - 42;
          const val = metric === "costo" ? money0(p.val) : `${p.val} pz`;
          return (
            <g>
              <rect x={tx - 46} y={ty} width="92" height="34" rx="8" fill="#40302E" />
              <text x={tx} y={ty + 14} textAnchor="middle" fontSize="10" fill="#D9C6BF" fontFamily="JetBrains Mono">Sem {p.semana}</text>
              <text x={tx} y={ty + 27} textAnchor="middle" fontSize="12" fill="#fff" fontFamily="Manrope" fontWeight="600">{val}</text>
            </g>
          );
        })()}
      </svg>

      <p className="text-xs text-[var(--on-surface-variant)] mt-4">
        Cada punto es una semana. Línea punteada = promedio del periodo. Pasa el cursor sobre un punto para ver el detalle.
      </p>
    </div>
  );
}
