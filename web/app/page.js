"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/libs/supabase/client";
import toast from "react-hot-toast";

// Dominio interno invisible: el encargado teclea solo el nombre de su sucursal.
const DOMINIO = "sucursal.dulcenoviembre.mx";
const slug = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Correo interno a partir de lo que escribe el usuario.
function aCorreo(entrada) {
  const e = String(entrada || "").trim();
  if (e.includes("@")) return e.toLowerCase();
  return slug(e) + "@" + DOMINIO;
}
// A dónde mandar según el rol.
const destino = (user) => (user?.user_metadata?.role === "sucursal" ? "/captura" : "/dashboard");

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push(destino(data.user));
      else setChecking(false);
    });
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: aCorreo(usuario),
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("Usuario o contraseña incorrectos");
      return;
    }
    router.push(destino(data.user));
    router.refresh();
  };

  if (checking) {
    return (
      <div className="dn-brand min-h-screen flex items-center justify-center bg-[var(--surface-container-low)]">
        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 animate-spin">
          <circle cx="12" cy="12" r="9" stroke="var(--primary)" strokeWidth="2.5" strokeOpacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="dn-brand min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-[var(--surface-container-low)]">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Marca */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-3">
            <span className="w-[3px] h-8 rounded-full bg-[var(--primary)]" />
            <span className="font-headline text-3xl text-[var(--on-surface)] leading-none">Dulce Noviembre</span>
          </div>
          <p className="eyebrow">Reportes · Ventas y Merma</p>
        </div>

        {/* Tarjeta */}
        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col gap-4 bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] rounded-2xl p-8 ambient-shadow-md"
        >
          <div>
            <h1 className="font-headline text-2xl text-[var(--on-surface)]">Acceder al sistema</h1>
            <p className="text-sm text-[var(--on-surface-variant)] mt-1">Acceso restringido · Solo usuarios autorizados</p>
          </div>

          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Usuario (nombre de tu sucursal)"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2.5 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] outline-none transition-colors focus:border-[var(--primary)]"
          />
          <input
            type="password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2.5 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] outline-none transition-colors focus:border-[var(--primary)]"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full py-2.5 font-label text-sm font-semibold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="text-xs text-[var(--on-surface-variant)] text-center">Dulce Noviembre · Reportes internos</p>
      </div>
    </div>
  );
}
