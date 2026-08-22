// Lee el comentario del POS y saca: tipo de merma + fecha real.
// Formatos vistos: "DAÑO", "CADUCIDAD", "DAÑO 02/08", "29/07 Y DAÑO 02/08", "21/07", "CORTESIA".
export function clasificarMotivo(motivo, fechaCaptura) {
  const m = String(motivo || "").toUpperCase();
  let tipo = null;
  if (/CADUC/.test(m)) tipo = "caducidad";
  else if (/DA.?[NÑ]?O/.test(m) && /DA/.test(m)) tipo = "daño";
  else if (/CORTES/.test(m)) tipo = "cortesia";
  else if (m.trim()) tipo = "otro";

  let fechaMerma = null;
  const dm = m.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (dm && fechaCaptura) {
    const dd = +dm[1], mm = +dm[2];
    let yy = dm[3] ? +dm[3] : +String(fechaCaptura).slice(0, 4);
    if (yy < 100) yy += 2000;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const cand = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      if (cand <= String(fechaCaptura)) fechaMerma = cand; // solo si no es futura
    }
  }
  return { tipo, fecha_merma: fechaMerma || (fechaCaptura ? String(fechaCaptura).slice(0, 10) : null) };
}
