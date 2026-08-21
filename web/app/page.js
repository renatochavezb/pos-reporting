"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/libs/supabase/client";
import toast from "react-hot-toast";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push("/dashboard");
      else setChecking(false);
    });
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Correo o contraseña incorrectos");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  if (checking) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0D0D0D" }}
      >
        <span className="loading loading-dots loading-lg" style={{ color: "#FF671D" }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        background: "#0D0D0D",
        backgroundImage:
          "radial-gradient(ellipse 60% 50% at 50% -10%, rgba(255,103,29,0.10) 0%, transparent 70%)",
      }}
    >
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <div style={{ width: 3, height: 28, background: "#FF671D", borderRadius: 2 }} />
            <span style={{ fontSize: "1.5rem", letterSpacing: "0.08em", color: "#fff", fontWeight: 700 }}>
              Dulce Noviembre
            </span>
          </div>
          <p style={{ letterSpacing: "0.18em", fontSize: "0.72rem", color: "#888" }}>
            REPORTES · VENTAS Y MERMA
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col gap-4"
          style={{
            background: "#141414",
            border: "1px solid #2A2A2A",
            borderRadius: "0.75rem",
            padding: "2rem",
          }}
        >
          <div className="flex flex-col gap-1">
            <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff" }}>
              Acceder al sistema
            </p>
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              Acceso restringido · Solo usuarios autorizados
            </p>
          </div>

          <input
            type="email"
            required
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input input-bordered w-full"
          />
          <input
            type="password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-bordered w-full"
          />

          <button
            type="submit"
            disabled={loading}
            className="btn w-full"
            style={{ background: "#FF671D", color: "#fff", border: "none" }}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p style={{ fontSize: "0.72rem", color: "#444", textAlign: "center" }}>
          Dulce Noviembre · Reportes internos
        </p>
      </div>
    </div>
  );
}
