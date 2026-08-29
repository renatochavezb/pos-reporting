"use client";

import { useEffect, useState } from "react";

// Reduce la imagen a máx 1600px y la vuelve JPEG para que quepa en el navegador.
function downscale(file, maxDim = 1600) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try {
        resolve(cv.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export default function BitacoraUpload({ sucursal }) {
  const key = `bitacora:${sucursal}`;
  const [imgs, setImgs] = useState([]);
  const [zoom, setZoom] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) setImgs(JSON.parse(s));
    } catch {}
  }, [key]);

  const persist = (arr) => {
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch {
      /* si no cabe, se queda solo en memoria de esta sesión */
    }
  };

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setCargando(true);
    const add = [];
    for (const f of files) {
      const d = await downscale(f);
      if (d) add.push({ id: `${f.name}-${f.size}-${add.length}`, url: d, name: f.name });
    }
    const next = [...imgs, ...add];
    setImgs(next);
    persist(next);
    setCargando(false);
    e.target.value = "";
  };

  const remove = (id) => {
    const next = imgs.filter((x) => x.id !== id);
    setImgs(next);
    persist(next);
  };

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
        {imgs.length > 0 && (
          <span className="text-xs text-[var(--on-surface-variant)]">
            {imgs.length} {imgs.length === 1 ? "foto" : "fotos"} guardada{imgs.length === 1 ? "" : "s"} en este navegador
          </span>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {imgs.map((im) => (
            <div key={im.id} className="relative group rounded-xl overflow-hidden border border-[var(--outline-variant)]">
              <img
                src={im.url}
                alt={im.name}
                className="w-full h-32 object-cover cursor-zoom-in"
                onClick={() => setZoom(im.url)}
              />
              <button
                onClick={() => remove(im.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--surface-container-lowest)]/90 border border-[var(--outline-variant)] text-[var(--error)] text-sm grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Quitar"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="Bitácora" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
