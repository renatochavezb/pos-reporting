"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

// Reduce la imagen a máx 1600px y la vuelve JPEG.
function downscale(file, maxDim = 1600) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try { resolve(cv.toDataURL("image/jpeg", 0.82)); } catch { resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export default function BitacoraUpload({ sucursal }) {
  const router = useRouter();
  const key = `bitacora:${sucursal}`;
  const [imgs, setImgs] = useState([]);
  const [estados, setEstados] = useState({}); // imgId -> 'leyendo' | 'ok' | 'error'
  const [zoom, setZoom] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setImgs(JSON.parse(s)); } catch {}
  }, [key]);

  // Guarda en localStorage solo las que aún NO se han procesado.
  const persistPendientes = (arr, est) => {
    try { localStorage.setItem(key, JSON.stringify(arr.filter((x) => est[x.id] !== "ok"))); } catch {}
  };

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setCargando(true);
    const add = [];
    for (const f of files) { const d = await downscale(f); if (d) add.push({ id: `${f.name}-${f.size}-${add.length}-${imgs.length}`, url: d, name: f.name }); }
    const next = [...imgs, ...add];
    setImgs(next);
    persistPendientes(next, estados);
    setCargando(false);
    e.target.value = "";
  };

  const quitarImg = (id) => {
    const next = imgs.filter((x) => x.id !== id);
    const est = { ...estados }; delete est[id];
    setImgs(next); setEstados(est);
    persistPendientes(next, est);
  };

  // Procesa UNA foto a la vez: transcribe + guarda. Las ✓ ya no se reprocesan.
  const procesar = async () => {
    if (procesando) return;
    const pendientes = imgs.filter((im) => estados[im.id] !== "ok");
    if (!pendientes.length) return;
    setProcesando(true);
    let ok = 0, fail = 0;
    const est = { ...estados };
    for (let n = 0; n < pendientes.length; n++) {
      const im = pendientes[n];
      est[im.id] = "leyendo"; setEstados({ ...est });
      const t = toast.loading(`Procesando foto ${n + 1} de ${pendientes.length}…`);
      try {
        const tr = await fetch("/api/bitacora/transcribir", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sucursal, imagenes: [im.url] }),
        });
        const dt = await tr.json();
        if (!tr.ok) throw new Error(dt.error || "no se pudo leer");
        if (!dt.rows || !dt.rows.length) throw new Error("no se detectaron renglones");
        const gr = await fetch("/api/bitacora/guardar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sucursal, rows: dt.rows, imagenes: [im.url] }),
        });
        const dg = await gr.json();
        if (!gr.ok) throw new Error(dg.error || "no se pudo guardar");
        est[im.id] = "ok"; setEstados({ ...est });
        ok++;
        toast.success(`Foto ${n + 1}: ${dg.renglones} renglones guardados`, { id: t, duration: 2500 });
      } catch (e) {
        est[im.id] = "error"; setEstados({ ...est });
        fail++;
        toast.error(`Foto ${n + 1}: ${e.message}`, { id: t, duration: 5000 });
      }
    }
    persistPendientes(imgs, est);
    setProcesando(false);
    if (fail) toast.error(`${fail} foto(s) no se procesaron (en naranja). Reintenta solo esas.`, { duration: 6000 });
    if (ok) router.refresh();
  };

  const pendientes = imgs.filter((im) => estados[im.id] !== "ok").length;
  const huboError = imgs.some((im) => estados[im.id] === "error");
  const borde = { ok: "border-[var(--primary)]", error: "border-[#d97706]", leyendo: "border-[var(--primary)]" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium border border-[var(--outline-variant)] text-[var(--primary)] bg-[var(--surface-container-lowest)] hover:bg-[var(--primary-container)] hover:border-[var(--primary-container)] transition-colors cursor-pointer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 9a2 2 0 0 1 2-2h1.6l1-1.5A2 2 0 0 1 9.3 4.5h5.4a2 2 0 0 1 1.7.9l1 1.6H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <circle cx="12" cy="13" r="3.2" />
          </svg>
          {cargando ? "Procesando…" : imgs.length ? "Agregar otra foto" : "Subir foto de la bitácora"}
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} disabled={cargando} />
        </label>
        {pendientes > 0 && (
          <button onClick={procesar} disabled={procesando || cargando} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 transition disabled:opacity-60">
            {procesando ? (
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
            ) : null}
            {procesando ? "Procesando…" : huboError ? `Reintentar las que faltan (${pendientes})` : `Procesar bitácora${imgs.length > 1 ? ` (${pendientes})` : ""}`}
          </button>
        )}
      </div>

      {imgs.length === 0 ? (
        <label className="border border-dashed border-[var(--outline-variant)] rounded-2xl p-8 text-center cursor-pointer hover:bg-[var(--surface-container-low)] transition-colors">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Sube aquí la foto de la libreta donde el personal anota la merma.
            <br />De esta imagen se transcribe la tabla de la derecha.
          </p>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} disabled={cargando} />
        </label>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {imgs.map((im) => {
              const st = estados[im.id];
              return (
                <div key={im.id} className={`relative group rounded-xl overflow-hidden border-2 ${borde[st] || "border-[var(--outline-variant)]"}`}>
                  <img src={im.url} alt={im.name} className="w-full h-32 object-cover cursor-zoom-in" onClick={() => setZoom(im.url)} />
                  {st && (
                    <span className={`absolute bottom-1.5 left-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${st === "ok" ? "bg-[var(--primary)] text-[var(--on-primary)]" : st === "error" ? "bg-[#d97706] text-white" : "bg-black/60 text-white"}`}>
                      {st === "ok" ? (<><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>Procesada</>) : st === "error" ? "✗ error" : "leyendo…"}
                    </span>
                  )}
                  {st === "ok" && <div className="absolute inset-0 bg-[var(--primary)]/10 pointer-events-none" />}
                  {!procesando && (
                    <button onClick={() => quitarImg(im.id)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--surface-container-lowest)]/90 border border-[var(--outline-variant)] text-[var(--error)] text-sm grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity" title="Quitar">×</button>
                  )}
                </div>
              );
            })}
          </div>
          {imgs.some((im) => estados[im.id] === "ok") && (
            <p className="text-[11px] text-[var(--on-surface-variant)]">Las fotos marcadas <b>✓ Procesada</b> ya se guardaron y no se vuelven a procesar.</p>
          )}
        </>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Bitácora" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
