"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GRUPOS = [
  { titulo: "Gerencia", items: [{ icon: "◆", label: "Dashboard", href: "/dashboard" }] },
  { titulo: "Datos", items: [{ icon: "≡", label: "Ventas" }] },
  { titulo: "Administración", items: [
    { icon: "✦", label: "Precios", href: "/precios" },
    { icon: "⌂", label: "Sucursales" },
    { icon: "⚙", label: "Ajustes" },
  ]},
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <nav className="w-[260px] fixed left-0 top-0 h-screen hidden md:flex flex-col bg-[var(--surface)] border-r border-[var(--outline-variant)] z-40">
      <div className="flex flex-col h-full px-5 py-6">
        <div className="mb-8">
          <h2 className="font-headline italic text-3xl text-[var(--primary)] leading-none">Dn.</h2>
          <p className="eyebrow mt-2">Reportes DN · v1.0</p>
        </div>
        <div className="flex flex-col gap-6 flex-grow">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <p className="eyebrow mb-2 px-1">{g.titulo}</p>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const activo = n.href && path === n.href;
                  const cls = `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activo ? "bg-[var(--primary-container)] text-[var(--on-primary-container)] font-semibold"
                    : n.href ? "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
                    : "text-[var(--muted-soft)] cursor-default"
                  }`;
                  const inner = (<><span className="w-4 text-center">{n.icon}</span>{n.label}</>);
                  return (
                    <li key={n.label}>
                      {n.href ? <Link href={n.href} className={cls}>{inner}</Link> : <span className={cls}>{inner}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <p className="pt-4 border-t border-[var(--outline-variant)] text-xs text-[var(--on-surface-variant)]">
          Dulce Noviembre · 2026
        </p>
      </div>
    </nav>
  );
}
