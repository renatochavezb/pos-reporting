// Lógica de datos del tablero de merma: resolución de sucursal, las dos formas de traer
// los datos (una sucursal vs. toda la cadena) y los aplanadores que le permiten a
// dashboard/page.js renderizar un solo bloque JSX para los dos casos.
//
// Regla de oro de este archivo (ver plan.md, hito 4): `datosCadena` y `datosSucursal`
// devuelven LA MISMA forma de objeto. Ninguna consulta de `datosCadena` trae filas de
// `merma`: todas leen vistas ya agregadas (`v_consolidado_*`), así que el costo de red no
// crece con el número de sucursales.

import { pesos0 } from "@/libs/formato";

// Valor del parámetro `?sucursal=` que activa la vista de toda la cadena.
export const CENTINELA = "__cadena__";

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

// Datos de toda la cadena. Siete consultas fijas en un solo Promise.all, ninguna sobre
// `merma`: todas sobre vistas `v_consolidado_*` ya agregadas, o sobre los catálogos chicos
// (`sucursales`/`configuracion`). El número de consultas no cambia si hay 2 sucursales o 12.
export async function datosCadena(sb) {
  const [
    { data: diaria },
    { data: productos },
    { data: semanas },
    { data: tipos },
    { data: cobertura },
    { data: regiones },
    { data: configPadron },
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
    cadena: { m, cobertura: filasCobertura, regiones: regiones || [] },
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
