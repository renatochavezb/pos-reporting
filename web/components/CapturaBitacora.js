"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/libs/supabase/client";
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

const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(n || 0));
const fCorta = (iso) => { try { return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00")); } catch { return iso; } };

const inputCls = "w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]";

export default function CapturaBitacora({ sucursal, nombre, correo, fotos, conceptos }) {
  const router = useRouter();
  const [imgs, setImgs] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [draft, setDraft] = useState(null);
  const [errorLectura, setErrorLectura] = useState("");
  const [guardado, setGuardado] = useState(null); // resumen de éxito
  const [zoom, setZoom] = useState(null);
  const [estados, setEstados] = useState({}); // imgId -> 'leyendo' | 'ok' | 'error'

  // Avisa si intenta salir con un borrador sin guardar.
  useEffect(() => {
    const hayPendiente = draft && draft.length > 0;
    const handler = (e) => { if (hayPendiente) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draft]);

  const salir = async () => { const s = createClient(); await s.auth.signOut(); router.push("/"); router.refresh(); };

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setCargando(true);
    setGuardado(null); setErrorLectura("");
    const add = [];
    for (const f of files) { const d = await downscale(f); if (d) add.push({ id: `${f.name}-${f.size}-${add.length}-${imgs.length}`, url: d }); }
    setImgs([...imgs, ...add]);
    setCargando(false);
    e.target.value = "";
  };
  const quitarImg = (id) => {
    setImgs(imgs.filter((x) => x.id !== id));
    setEstados((s) => { const n = { ...s }; delete n[id]; return n; });
  };

  // Lee UNA foto a la vez (llamada corta e independiente). Las ya leídas no se
  // vuelven a procesar; si una falla, se puede reintentar solo esa.
  const transcribir = async () => {
    if (transcribiendo) return;
    const pendientes = imgs.filter((im) => estados[im.id] !== "ok");
    if (!pendientes.length) return;
    setTranscribiendo(true);
    setErrorLectura(""); setGuardado(null);
    let acumulado = draft ? [...draft] : [];
    let fallidas = 0, leidasOk = 0;
    for (let n = 0; n < pendientes.length; n++) {
      const im = pendientes[n];
      setEstados((s) => ({ ...s, [im.id]: "leyendo" }));
      const t = toast.loading(`Leyendo foto ${n + 1} de ${pendientes.length}…`);
      try {
        const r = await fetch("/api/bitacora/transcribir", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenes: [im.url] }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "no se pudo leer");
        acumulado = [...acumulado, ...(d.rows || [])];
        setDraft(acumulado);
        setEstados((s) => ({ ...s, [im.id]: "ok" }));
        leidasOk++;
        toast.success(`Foto ${n + 1}: ${(d.rows || []).length} renglones`, { id: t, duration: 2500 });
      } catch (e) {
        fallidas++;
        setEstados((s) => ({ ...s, [im.id]: "error" }));
        toast.error(`Foto ${n + 1} no se pudo leer`, { id: t, duration: 4000 });
      }
    }
    setTranscribiendo(false);
    if (!acumulado.length && fallidas) {
      setErrorLectura("No se pudo leer ninguna foto. Vuelve a intentar o tómalas de nuevo con buena luz. Tip: una foto por semana lee más rápido.");
    } else if (fallidas) {
      setErrorLectura(`${fallidas} foto(s) no se pudieron leer (marcadas en rojo). Puedes reintentar solo esas con el botón, sin volver a leer las que ya salieron bien.`);
    }
  };

  const setRow = (i, campo, val) => { const n = [...draft]; n[i] = { ...n[i], [campo]: val }; setDraft(n); };
  const borrarRow = (i) => setDraft(draft.filter((_, j) => j !== i));
  const agregarRow = () => setDraft([...(draft || []), { fecha: new Date().toISOString().slice(0, 10), insumo: "", tam: "GD", cantidad: 1, motivo: "caducidad", importe_costo: null }]);

  const guardar = async () => {
    if (!draft?.length || guardando) return;
    setGuardando(true);
    const t = toast.loading("Guardando…");
    try {
      // Solo se archivan las fotos que sí se leyeron (para que foto y datos cuadren).
      const okImgs = imgs.filter((im) => estados[im.id] === "ok");
      const aArchivar = (okImgs.length ? okImgs : imgs).map((x) => x.url);
      const r = await fetch("/api/bitacora/guardar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: draft, imagenes: aArchivar }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar");
      toast.success("¡Guardado!", { id: t });
      setGuardado({ renglones: d.renglones, totCosto: d.totCosto, sinCosto: d.sinCosto, fotos: d.fotos });
      setDraft(null); setImgs([]); setErrorLectura(""); setEstados({});
      router.refresh();
    } catch (e) {
      toast.error("No se guardó: " + e.message + ". Intenta de nuevo.", { id: t, duration: 7000 });
    }
    setGuardando(false);
  };

  return (
    <div className="dn-brand min-h-screen bg-[var(--surface-container-low)]">
      {/* Encabezado */}
      <header className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--outline-variant)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-[3px] h-7 rounded-full bg-[var(--primary)]" />
            <div className="leading-tight">
              <p className="font-headline text-lg text-[var(--on-surface)]">Dulce Noviembre</p>
              <p className="eyebrow">Sucursal · {nombre}</p>
            </div>
          </div>
          <button onClick={salir} className="text-xs font-semibold text-[var(--on-surface-variant)] hover:text-[var(--primary)] rounded-full border border-[var(--outline-variant)] px-3 py-1.5">Salir</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Éxito */}
        {guardado && (
          <div className="rounded-2xl border-2 border-[var(--primary)] bg-[var(--primary-container)] p-5 flex flex-col gap-2 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[var(--primary)] grid place-items-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--on-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <p className="font-headline text-2xl text-[var(--on-primary-container)]">¡Operación exitosa!</p>
            <p className="text-sm text-[var(--on-primary-container)]">Se guardaron <b>{guardado.renglones}</b> renglones · {mxn(guardado.totCosto)}{guardado.sinCosto ? ` (${guardado.sinCosto} sin costo)` : ""}. Foto archivada ✓</p>
            <button onClick={() => setGuardado(null)} className="mx-auto mt-2 rounded-full px-5 py-2 text-sm font-semibold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90">Subir otra bitácora</button>
          </div>
        )}

        {/* Tomar foto */}
        {!guardado && (
          <section className="bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <h1 className="font-headline text-2xl text-[var(--on-surface)]">Subir bitácora</h1>
              <p className="text-sm text-[var(--on-surface-variant)] mt-1">Toma la foto de la libreta. La IA la lee, tú revisas y guardas.</p>
            </div>

            <label className="grid place-items-center gap-2 border border-dashed border-[var(--outline-variant)] rounded-2xl p-6 cursor-pointer hover:bg-[var(--surface-container-low)] transition-colors text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9">
                <path d="M3 9a2 2 0 0 1 2-2h1.6l1-1.5A2 2 0 0 1 9.3 4.5h5.4a2 2 0 0 1 1.7.9l1 1.6H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
              <span className="text-sm font-semibold text-[var(--primary)]">{cargando ? "Procesando…" : imgs.length ? "Agregar otra foto" : "Tomar / subir foto"}</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} disabled={cargando} />
            </label>

            {imgs.length > 0 && (() => {
              const pendientes = imgs.filter((im) => estados[im.id] !== "ok").length;
              const huboError = imgs.some((im) => estados[im.id] === "error");
              const borde = { ok: "border-[var(--primary)]", error: "border-[#d97706]", leyendo: "border-[var(--primary)]" };
              return (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {imgs.map((im) => {
                      const st = estados[im.id];
                      return (
                        <div key={im.id} className={`relative rounded-xl overflow-hidden border-2 ${borde[st] || "border-[var(--outline-variant)]"}`}>
                          <img src={im.url} alt="" className="w-full h-24 object-cover cursor-zoom-in" onClick={() => setZoom(im.url)} />
                          {st && (
                            <span className={`absolute bottom-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${st === "ok" ? "bg-[var(--primary)] text-[var(--on-primary)]" : st === "error" ? "bg-[#d97706] text-white" : "bg-black/60 text-white"}`}>
                              {st === "ok" ? "✓ leída" : st === "error" ? "✗ error" : "leyendo…"}
                            </span>
                          )}
                          {!transcribiendo && (
                            <button onClick={() => quitarImg(im.id)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[var(--surface-container-lowest)]/90 border border-[var(--outline-variant)] text-[var(--error)] grid place-items-center">×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {pendientes > 0 && (
                    <button onClick={transcribir} disabled={transcribiendo} className="w-full rounded-full py-3 font-label text-sm font-semibold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 transition disabled:opacity-60">
                      {transcribiendo ? "Leyendo…" : huboError ? `Reintentar las que faltan (${pendientes})` : imgs.length > 1 ? `Leer con IA (${pendientes} foto${pendientes > 1 ? "s" : ""})` : "Leer con IA"}
                    </button>
                  )}
                </>
              );
            })()}
          </section>
        )}

        {/* Error de lectura */}
        {errorLectura && (
          <div className="rounded-2xl border-2 border-[var(--error)] bg-[var(--error)]/8 p-5 flex flex-col gap-3 text-center">
            <p className="font-headline text-xl text-[var(--error)]">No se pudo leer</p>
            <p className="text-sm text-[var(--on-surface)]">{errorLectura}</p>
            {imgs.length > 0 && (
              <button onClick={transcribir} disabled={transcribiendo} className="mx-auto rounded-full px-5 py-2.5 text-sm font-semibold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 disabled:opacity-60">
                {transcribiendo ? "Reintentando…" : "Volver a intentar"}
              </button>
            )}
          </div>
        )}

        {/* Borrador editable */}
        {draft && (
          <section className="bg-[var(--surface-container-lowest)] border-2 border-[var(--primary)] rounded-2xl p-5 flex flex-col gap-4">
            <div className="rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Aún NO se ha guardado. Revisa y presiona "Aceptar y guardar" al final.
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-headline text-xl text-[var(--on-surface)]">Revisa y corrige</h2>
                <p className="text-sm text-[var(--on-surface-variant)]">Borra los que estén mal y corrige nombres, cantidades o fechas.</p>
              </div>
              <span className="text-xs text-[var(--on-surface-variant)] whitespace-nowrap">{draft.length} renglones</span>
            </div>

            <div className="flex flex-col gap-3">
              {draft.map((row, i) => (
                <div key={i} className={`rounded-xl border bg-[var(--surface-container-low)] p-3 flex flex-col gap-2 ${row.ambiguo ? "border-[#d97706] border-2" : "border-[var(--outline-variant)]"}`}>
                  {row.ambiguo && (
                    <p className="text-[11px] font-semibold text-[#b45309] flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Verifica: hay varios productos parecidos, confirma que sea el correcto.
                    </p>
                  )}
                  <div className="flex items-start gap-2">
                    <input value={row.insumo} onChange={(e) => setRow(i, "insumo", e.target.value)} placeholder="Producto" className={inputCls + " flex-1 font-medium"} />
                    <button onClick={() => borrarRow(i)} className="shrink-0 w-9 h-9 grid place-items-center rounded-lg border border-[var(--outline-variant)] text-[var(--error)]" title="Borrar">×</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">Fecha</span>
                      <input type="date" value={row.fecha} onChange={(e) => setRow(i, "fecha", e.target.value)} className={inputCls} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">Cantidad</span>
                      <input type="number" min="1" value={row.cantidad} onChange={(e) => setRow(i, "cantidad", Number(e.target.value))} className={inputCls} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">Tamaño</span>
                      <select value={row.tam} onChange={(e) => setRow(i, "tam", e.target.value)} className={inputCls}>
                        <option value="GD">Grande</option>
                        <option value="CH">Chico</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">Motivo</span>
                      <select value={row.motivo} onChange={(e) => setRow(i, "motivo", e.target.value)} className={inputCls}>
                        <option value="caducidad">Caducidad</option>
                        <option value="daño">Daño</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={agregarRow} className="rounded-full px-4 py-2.5 text-sm font-semibold border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]">+ Agregar renglón</button>
              <button onClick={guardar} disabled={guardando} className="flex-1 rounded-full py-3 font-label text-sm font-bold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 transition disabled:opacity-60">
                {guardando ? "Guardando…" : "✓ Aceptar y guardar"}
              </button>
            </div>
          </section>
        )}

        {/* Fotos subidas */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
            <h2 className="font-headline text-xl text-[var(--on-surface)]">Fotos subidas</h2>
            <span className="ml-1 text-xs text-[var(--on-surface-variant)]">{fotos.length}</span>
          </div>
          {fotos.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">Aún no has subido fotos.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {fotos.map((f) => (
                <div key={f.id} className="rounded-xl overflow-hidden border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
                  {f.url ? <img src={f.url} alt="" className="w-full h-24 object-cover cursor-zoom-in" onClick={() => setZoom(f.url)} /> : <div className="w-full h-24 grid place-items-center text-xs text-[var(--on-surface-variant)]">sin vista</div>}
                  <p className="text-[11px] text-center text-[var(--on-surface-variant)] py-1">{fCorta(f.fecha)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Transcripciones */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
            <h2 className="font-headline text-xl text-[var(--on-surface)]">Transcripciones</h2>
            <span className="ml-1 text-xs text-[var(--on-surface-variant)]">{conceptos.length}</span>
          </div>
          {conceptos.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">Todavía no hay transcripciones.</p>
          ) : (
            <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[var(--surface-container-low)]">
                    <tr className="font-label text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                      <th className="px-3 py-2.5 font-medium">Fecha</th>
                      <th className="px-3 py-2.5 font-medium">Producto</th>
                      <th className="px-3 py-2.5 font-medium text-center">Cant.</th>
                      <th className="px-3 py-2.5 font-medium">Motivo</th>
                      <th className="px-3 py-2.5 font-medium text-right">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--on-surface)]">
                    {conceptos.map((c) => (
                      <tr key={c.id} className="border-t border-[var(--outline-variant)]/60">
                        <td className="px-3 py-2 text-[var(--on-surface-variant)] whitespace-nowrap">{fCorta(c.fecha)}</td>
                        <td className="px-3 py-2">{c.insumo}</td>
                        <td className="px-3 py-2 text-center tnum">{c.cantidad}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.motivo_tipo === "daño" ? "bg-[var(--error)]/12 text-[var(--error)]" : "bg-[var(--primary-container)] text-[var(--on-primary-container)]"}`}>
                            {c.motivo_tipo === "daño" ? "Daño" : "Caducidad"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tnum">{c.importe_costo != null ? mxn(c.importe_costo) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
