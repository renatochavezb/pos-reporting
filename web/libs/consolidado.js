// Lógica de datos del tablero de merma: resolución de sucursal, las dos formas de traer
// los datos (una sucursal vs. toda la cadena) y los aplanadores que le permiten a
// dashboard/page.js renderizar un solo bloque JSX para los dos casos.
//
// Regla de oro de este archivo (ver plan.md, hito 4): `datosCadena` y `datosSucursal`
// devuelven LA MISMA forma de objeto. Ninguna consulta de `datosCadena` trae filas de
// `merma`: todas leen vistas ya agregadas (`v_consolidado_*`), así que el costo de red no
// crece con el número de sucursales.

import { pesos0, piezas, fechaHora, regionTexto } from "@/libs/formato";

// Valor del parámetro `?sucursal=` que activa la vista de toda la cadena.
export const CENTINELA = "__cadena__";

// Límites de la semana en curso (lunes a domingo), en formato YYYY-MM-DD. Los usa tanto
// `datosCadena` (para acotar v_consolidado_aporte_semanal a como mucho 24 filas, F18) como
// `dashboard/page.js` (para armar la fila "semana en curso" del héroe). Tienen que ser
// EXACTAMENTE la misma semana o la tabla de Aporte deja de cuadrar contra el héroe (hito 5).
export function limitesSemana(hoy = new Date()) {
  const fmtD = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const dow = (hoy.getDay() + 6) % 7; // 0 = lunes
  const lunesAct = new Date(hoy);
  lunesAct.setDate(hoy.getDate() - dow);
  const domAct = new Date(lunesAct);
  domAct.setDate(lunesAct.getDate() + 6);
  const lunesPrev = new Date(lunesAct);
  lunesPrev.setDate(lunesAct.getDate() - 7);
  return { lunesActual: fmtD(lunesAct), domingoActual: fmtD(domAct), lunesPrevio: fmtD(lunesPrev) };
}

// Resuelve el parámetro de la URL contra la lista de sucursales con datos.
// - El centinela siempre se reconoce, exista o no una sucursal con ese nombre.
// - Cualquier otro valor que no esté en la lista cae a la primera sucursal, sin error (F3).
export function resolverSucursal(sucursales, valor) {
  if (valor === CENTINELA) return CENTINELA;
  if (valor && (sucursales || []).includes(valor)) return valor;
  return (sucursales || [])[0] || "FUENTES MARES";
}

// Datos de una sola sucursal. Mismas cinco consultas que ya hacía dashboard/page.js
// (se quitó `precios_cargas`: se traía pero nunca se usaba en el render).
export async function datosSucursal(sb, sucursal) {
  const [{ data: diaria }, { data: productos }, { data: semanas }, { data: sync }, { data: tipos }] =
    await Promise.all([
      sb.from("v_merma_diaria").select("*").eq("sucursal", sucursal).order("fecha", { ascending: false }).limit(12),
      sb
        .from("v_merma_por_producto")
        .select("*")
        .eq("sucursal", sucursal)
        .order("pesos", { ascending: false, nullsFirst: false })
        .limit(8),
      sb.from("v_merma_semanal").select("*").eq("sucursal", sucursal).order("lunes", { ascending: false }).limit(16),
      sb.from("sync_estado").select("*").eq("sucursal", sucursal).eq("tabla", "merma").maybeSingle(),
      sb.from("v_merma_por_tipo").select("*").eq("sucursal", sucursal),
    ]);

  return {
    diaria: diaria || [],
    productos: productos || [],
    semanas: semanas || [],
    sync: sync || null,
    tipos: tipos || [],
    cadena: null,
  };
}

// Datos de toda la cadena. Diez consultas fijas en un solo Promise.all, ninguna sobre
// `merma`: todas sobre vistas `v_consolidado_*` ya agregadas, o sobre los catálogos chicos
// (`sucursales`/`configuracion`). El número de consultas no cambia si hay 2 sucursales o 12.
// La de aporte se acota con `.in("lunes", [lunesActual, lunesPrevio])`: máximo 24 filas.
// No se agrega una consulta aparte a `v_consolidado_regiones_espejo`: el monto y porcentaje
// del aviso de costos provisionales (hito 5) se calculan a partir de `v_consolidado_por_region`,
// que ya trae `costos_provisionales` resuelto por esa vista -- una consulta menos, mismo dato.
export async function datosCadena(sb) {
  const { lunesActual, lunesPrevio } = limitesSemana();

  const [
    { data: diaria },
    { data: productos },
    { data: semanas },
    { data: tipos },
    { data: cobertura },
    { data: regiones },
    { data: configPadron },
    { data: aporte },
    { data: insumosHueco },
    { data: costoSospechoso },
  ] = await Promise.all([
    sb.from("v_consolidado_diaria").select("*").order("fecha", { ascending: false }).limit(12),
    sb
      .from("v_consolidado_por_producto")
      .select("*")
      .order("pesos", { ascending: false, nullsFirst: false })
      .limit(8),
    sb.from("v_consolidado_semanal").select("*").order("lunes", { ascending: false }).limit(16),
    sb.from("v_consolidado_por_tipo").select("*"),
    sb.from("v_consolidado_cobertura").select("*"),
    sb.from("v_consolidado_por_region").select("*"),
    sb.from("configuracion").select("valor").eq("clave", "sucursales_en_padron").maybeSingle(),
    sb.from("v_consolidado_aporte_semanal").select("*").in("lunes", [lunesActual, lunesPrevio]),
    sb.from("v_consolidado_insumos_hueco").select("*"),
    sb.from("v_consolidado_costo_sospechoso").select("*"),
  ]);

  const filasCobertura = cobertura || [];

  // Denominador M = greatest(sucursales del padrón no dadas de baja,
  // configuracion.sucursales_en_padron, sucursales distintas en los datos). Si la clave de
  // configuración no existe, M queda null a propósito: nunca se inventa un denominador con
  // solo dos de los tres términos.
  const catalogoNoBaja = filasCobertura.filter((r) => r.en_padron && r.estado !== "baja").length;
  const conDatos = filasCobertura.filter((r) => r.con_datos).length;
  const padronConfig = configPadron?.valor != null ? Number(configPadron.valor) : null;
  const m =
    padronConfig != null && !Number.isNaN(padronConfig)
      ? Math.max(catalogoNoBaja, padronConfig, conDatos)
      : null;

  return {
    diaria: diaria || [],
    productos: productos || [],
    semanas: semanas || [],
    sync: null,
    tipos: tipos || [],
    cadena: {
      m,
      cobertura: filasCobertura,
      regiones: regiones || [],
      aporte: aporte || [],
      insumosHueco: insumosHueco || [],
      costoSospechoso: costoSospechoso || [],
      lunesActual,
      lunesPrevio,
    },
  };
}

// Aplana `v_merma_por_producto` (sucursal) y `v_consolidado_por_producto` (cadena) a una
// sola forma para que el ranking se renderice con un solo bloque JSX.
// Individual: costo_texto = pesos0(costo_unit) -- salida idéntica a la de hoy.
// Cadena: costo_texto = "varía por región" cuando costos_distintos > 1.
export function normalizarRanking(productos) {
  return (productos || []).map((p) => ({
    id: p.no_insumo ?? p.llave,
    insumo: p.insumo,
    piezas: p.piezas,
    pesos: p.pesos,
    tiene_costo: p.tiene_costo,
    costo_texto:
      p.costos_distintos > 1 ? "varía por región" : p.costo_unit != null ? pesos0(p.costo_unit) : "—",
  }));
}

// F8 — el héroe lleva "≈" cuando alguna de estas cinco condiciones se cumple. Todas ya
// están calculadas por las vistas; esta función solo hace el OR y arma la etiqueta con
// los números de lo que se cumplió. Solo aplica en modo cadena (la vista individual llama
// a esta función con datos que siempre dan `aproximado: false`).
export function esAproximado({ n, m, cobertura, regiones, piezasSinValorizar }) {
  const motivos = [];

  if (m != null && n != null && n < m) {
    motivos.push(`faltan ${m - n} sucursales`);
  }

  const relevantes = (cobertura || []).filter((r) => r.en_padron || r.con_datos);
  const conProblemaSync = relevantes.filter(
    (r) => r.estatus_sync === "error" || r.sin_corrida_reciente || r.nunca_sincronizada
  );
  if (conProblemaSync.length > 0) {
    motivos.push(`${conProblemaSync.length} sucursal(es) en error o sin corrida reciente`);
  }

  if (Number(piezasSinValorizar || 0) !== 0) {
    motivos.push(`${piezasSinValorizar} piezas sin valorizar`);
  }

  const regionProvisional = (regiones || []).find(
    (r) => r.costos_provisionales && Number(r.pesos || 0) > 0
  );
  if (regionProvisional) {
    motivos.push(`costos provisionales en ${regionProvisional.region}`);
  }

  const sinRegionConPiezas = (regiones || []).find(
    (r) => r.region == null && Number(r.piezas || 0) > 0
  );
  if (sinRegionConPiezas) {
    motivos.push(`${sinRegionConPiezas.piezas} piezas de sucursales sin región`);
  }

  return { aproximado: motivos.length > 0, motivos };
}

// Hito 5 (F10/F11/D11) — arma la banda de avisos del consolidado, en orden de gravedad:
// error > advertencia > acción > informativo. Cada aviso desaparece SOLO cuando su causa se
// resuelve en los datos reales; ninguno se cablea a un nombre de sucursal ni a un monto fijo.
//
// Nota de diseño (caso Juárez 3, ver contexto/decisiones.md): "sin región" se detecta con DOS
// fuentes, unidas, porque hay dos formas distintas de quedar sin región:
//  (a) el catálogo `sucursales.region` nunca se llenó (cobertura.tiene_region = false), y
//  (b) la fila operativa de `sucursal_region` falta o se borró, lo que deja
//      `merma_costeada.region` en null aunque el catálogo esté bien -- esto es lo que
//      `v_consolidado_insumos_hueco` reporta con causa 'sin región'.
// Si este aviso solo mirara el catálogo, la prueba reversible del hito 5 (borrar la fila de
// `sucursal_region` de Juárez 3) no lo dispararía, porque esa prueba no toca `sucursales`.
export function construirAvisos({ cobertura, regiones, insumosHueco, costoSospechoso }) {
  const filasCobertura = cobertura || [];
  const filasRegion = regiones || [];
  const filasHueco = insumosHueco || [];
  const filasSospechoso = costoSospechoso || [];
  const avisos = [];

  const relevantes = filasCobertura.filter((r) => r.en_padron || r.con_datos);
  const mapaDisplay = new Map(filasCobertura.map((r) => [r.sucursal, r.nombre_display]));

  // 1 — sucursales sin región (error): sin ella no se valorizan y quedan fuera del total en
  // pesos. Unión de las dos causas descritas arriba, deduplicada por sucursal canónica.
  const sinRegion = new Set();
  filasHueco
    .filter((h) => h.causa === "sin región")
    .forEach((h) => (h.sucursales || []).forEach((s) => sinRegion.add(s)));
  relevantes.filter((r) => !r.tiene_region).forEach((r) => sinRegion.add(r.sucursal));
  if (sinRegion.size > 0) {
    const nombres = [...sinRegion].map((s) => mapaDisplay.get(s) || s).join(", ");
    avisos.push({
      tipo: "error",
      texto: `${sinRegion.size} sucursal(es) sin región asignada: no se valorizan y no están en el total en pesos (${nombres}).`,
    });
  }

  // 2 — sync en error o sin corrida reciente (error), nombrando desde cuándo.
  const conProblemaSync = relevantes.filter((r) => r.estatus_sync === "error" || r.sin_corrida_reciente);
  if (conProblemaSync.length > 0) {
    const detalle = conProblemaSync
      .map((r) => `${r.nombre_display} (desde ${fechaHora(r.ultima_corrida)})`)
      .join(", ");
    avisos.push({
      tipo: "error",
      texto: `${conProblemaSync.length} sucursal(es) con sincronización en error o sin corrida reciente: ${detalle}.`,
    });
  }

  // 3 — costos de la región provisional (advertencia): monto y % calculados de verdad, sale
  // de cruzar v_consolidado_por_region (ya trae `costos_provisionales` resuelto por el espejo
  // de `precios` y la atribución de `regiones.es_referencia`).
  const totalPesosRegiones = filasRegion.reduce((acc, r) => acc + Number(r.pesos || 0), 0);
  const provisional = filasRegion.find((r) => r.costos_provisionales);
  if (provisional && totalPesosRegiones > 0) {
    const monto = Number(provisional.pesos || 0);
    const pct = (monto / totalPesosRegiones) * 100;
    const referencia = filasRegion.find((r) => r.region != null && r.region !== provisional.region);
    avisos.push({
      tipo: "advertencia",
      texto:
        `Los costos de ${regionTexto(provisional.region)} son provisionales` +
        (referencia ? ` (heredados de ${regionTexto(referencia.region)})` : "") +
        `. ${pesos0(monto)} de este total (${pct.toFixed(1)}%) corresponde a sucursales de ` +
        `${regionTexto(provisional.region)} y está sobrevaluado.`,
    });
  }

  // 4 y 5 — insumos sin equivalencia / sin precio en su región (acción). Separados: la acción
  // correctiva es distinta en cada caso, aunque las dos apunten a /precios.
  const sinEquivalencia = filasHueco.filter((h) => h.causa === "sin equivalencia");
  if (sinEquivalencia.length > 0) {
    const piezasTot = sinEquivalencia.reduce((acc, h) => acc + Number(h.piezas || 0), 0);
    avisos.push({
      tipo: "accion",
      texto: `${sinEquivalencia.length} insumo(s) sin equivalencia registrada (${piezas(piezasTot)} piezas sin valorizar): ${sinEquivalencia.map((h) => h.insumo).join(", ")}.`,
      href: "/precios",
    });
  }
  const sinPrecioRegion = filasHueco.filter((h) => h.causa === "sin precio en su región");
  if (sinPrecioRegion.length > 0) {
    const piezasTot = sinPrecioRegion.reduce((acc, h) => acc + Number(h.piezas || 0), 0);
    avisos.push({
      tipo: "accion",
      texto: `${sinPrecioRegion.length} insumo(s) sin precio cargado en su región (${piezas(piezasTot)} piezas sin valorizar): ${sinPrecioRegion.map((h) => h.insumo).join(", ")}.`,
      href: "/precios",
    });
  }

  // 6 — costos sospechosos (informativo): costo_confiable = false.
  if (filasSospechoso.length > 0) {
    const piezasTot = filasSospechoso.reduce((acc, h) => acc + Number(h.piezas || 0), 0);
    avisos.push({
      tipo: "informativo",
      texto: `${filasSospechoso.length} insumo(s) con costo marcado como sospechoso (${piezas(piezasTot)} piezas): ${filasSospechoso.map((h) => h.insumo).join(", ")}.`,
    });
  }

  return avisos;
}

// Hito 6 (F14/D7) — variación de la semana en curso sobre una BASE COMPARABLE de sucursales,
// no sobre el total crudo. El `deltaPct` de siempre (semActual.pesos vs semPrev.pesos) miente
// en modo cadena cuando el conjunto de sucursales que aportó cambió entre las dos semanas: si
// entró una tienda nueva, el total sube y parece que la merma explotó, aunque cada sucursal
// individual esté igual.
//
// Se calcula con las filas de `v_consolidado_aporte_semanal` que `datosCadena` YA trae
// (acotadas a [lunesActual, lunesPrevio], máx. 24 filas): ninguna consulta nueva.
//
// Cuatro estados, en el orden que exige el plan:
//   - "sin_previa": no hay fila de la semana pasada -> como hoy, sin píldora ni nota.
//   - "misma_base": el conjunto de sucursales es idéntico -> el % de siempre (recalculado
//     desde estas mismas filas, para que quede consistente con la nota) + "misma base: N".
//   - "base_distinta": el conjunto difiere pero hay intersección -> NUNCA se calcula un %
//     sobre los totales brutos (esos ya se ven, sin conectarlos, en el héroe y en la tarjeta
//     "semana pasada"); el % que sí se ofrece es sobre la intersección, con su nota de qué
//     sucursales se excluyeron.
//   - "sin_interseccion": la intersección es vacía -> nunca un porcentaje, solo "—".
//
// `mapaDisplay` es un Map(sucursal canónico -> nombre_display) para que "excluye: ..." se lea
// en nombres para mostrar, no en claves crudas.
export function interseccion({ aporte, lunesActual, lunesPrevio, mapaDisplay }) {
  const filasActual = (aporte || []).filter((a) => a.lunes === lunesActual);
  const filasPrevia = (aporte || []).filter((a) => a.lunes === lunesPrevio);

  if (filasPrevia.length === 0) {
    return { estado: "sin_previa", n: null, deltaPct: null, nota: null };
  }

  const sumaPesos = (filas, subset) =>
    filas
      .filter((a) => !subset || subset.has(a.sucursal))
      .reduce((acc, a) => acc + Number(a.pesos || 0), 0);

  const setActual = new Set(filasActual.map((a) => a.sucursal));
  const setPrevia = new Set(filasPrevia.map((a) => a.sucursal));
  const mismaBase =
    setActual.size === setPrevia.size && [...setActual].every((s) => setPrevia.has(s));
  const plural = (n) => (n === 1 ? "sucursal" : "sucursales");
  const display = (s) => mapaDisplay?.get(s) || s;

  if (mismaBase) {
    const pActual = sumaPesos(filasActual);
    const pPrevia = sumaPesos(filasPrevia);
    return {
      estado: "misma_base",
      n: setActual.size,
      deltaPct: pPrevia > 0 ? ((pActual - pPrevia) / pPrevia) * 100 : null,
      nota: `misma base: ${setActual.size} ${plural(setActual.size)}`,
    };
  }

  const comunes = new Set([...setActual].filter((s) => setPrevia.has(s)));
  if (comunes.size === 0) {
    return { estado: "sin_interseccion", n: 0, deltaPct: null, nota: "sin base comparable" };
  }

  const pActualComun = sumaPesos(filasActual, comunes);
  const pPreviaComun = sumaPesos(filasPrevia, comunes);
  const excluidas = [...new Set([...setActual, ...setPrevia])]
    .filter((s) => !comunes.has(s))
    .map(display)
    .sort((a, b) => a.localeCompare(b));

  return {
    estado: "base_distinta",
    n: comunes.size,
    deltaPct: pPreviaComun > 0 ? ((pActualComun - pPreviaComun) / pPreviaComun) * 100 : null,
    nota: `base comparable: ${comunes.size} ${plural(comunes.size)} (excluye: ${excluidas.join(", ")})`,
  };
}
