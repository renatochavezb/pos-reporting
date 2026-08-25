// Barra de progreso (estética Programa DN). Extraída tal cual de dashboard/page.js.
export default function Barra({ pct }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--bar-track)] w-full overflow-hidden">
      <div className="h-full rounded-full bg-[var(--bar-fill)]" style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}
