# Datos — origen, destino y esquema

## Flujo

```
POS de cada sucursal          Copia central              Lo que ve el usuario
(SeattlePOS / SQL Server)     (Supabase / Postgres)      (Next.js)
──────────────────────        ─────────────────────      ────────────────────
Fuentes Mares ─┐
Misiones/Jz3 ──┼── Hamachi ──► Extractor (Node) ──►  Supabase ──►  Dashboard
Torres ────────┘    (VPN)      solo lectura,         vistas, RLS,  localhost:4000
(… hasta 12)                   UPSERT                auth
```

## Origen: SeattlePOS

- **SeattlePOS 18**, misma estructura de tablas en las 12 sucursales.
- Motor: **SQL Server 2008 R2**.
- Acceso vía **Hamachi** (VPN) — no hace falta instalar nada en cada sucursal.
- Usuario **`reportes_ro`**, solo lectura, en cada sucursal.
- De las **~435 tablas del POS, solo ~25 sirven** para reportes: ventas, inventario/merma,
  catálogos y caja. El mapeo completo está en `TABLAS.md` en la raíz del repo.

### Tablas de ventas ya mapeadas (para cuando se construya el módulo)
`Tickets`, `TicketDetalles`, `TicketCobro`, `TicketCobroFormaPago`.
Permiten: ventas netas por sucursal/día/turno, mezcla de productos, métodos de pago
(para cuadrar el corte), cancelaciones y descuentos.

### Caja
`CortesDeCaja` y sus subtablas. **Faltan confirmar columnas** — no estaba estable la red
cuando se documentó. Verificar antes de construir sobre ellas.

## Destino: Supabase (Postgres)

### Tablas
- `merma` — el hecho principal
- `precios` — por región, producto y tamaño
- `precios_cargas` — historial de las subidas de Excel
- `equivalencias` — nombre de insumo → producto con precio
- `sync_estado` — resultado de cada extracción por sucursal
- `sucursal_region` — de qué región es cada sucursal, **para valorizar**. Es la tabla que
  `merma_costeada` cruza contra `precios`. Ver "Reglas del consolidado" en
  `contexto/restricciones.md`: es una autoridad distinta de `sucursales.region` y las dos
  deben coincidir.
- `sucursales` — el padrón de las 12 sucursales, para el consolidado de cadena.
  - `sucursales.sucursal` es la **llave canónica**: el nombre exacto que escribe el POS. Es
    lo mismo que `merma.sucursal`, `sucursal_region.sucursal` y `sync_estado.sucursal`, y lo
    que se usa en todo `group by`, `join ... on` y en el parámetro `?sucursal=` de la URL.
    Nunca se traduce ni se renombra.
  - `sucursales.nombre_display` es **solo para pantalla** (ver "Nombre canónico vs. nombre
    para mostrar" en `contexto/decisiones.md`). No es llave de nada.
  - `sucursales.region` es solo para **mostrar y agrupar** en el consolidado — no es la que
    valoriza (esa es `sucursal_region`, arriba).
  - Hoy tiene 2 de 12 filas dadas de alta. Ver `contexto/estado.md`.
- `regiones` — catálogo de regiones (`CHIHUAHUA`, `JUAREZ`), con `es_referencia` para saber
  cuál es la lista de precios confiable al detectar espejo de costos (ver
  `contexto/decisiones.md`).
- `configuracion` — pares clave/valor para los umbrales del consolidado
  (`sucursales_en_padron`, `horas_sin_corrida_alerta`, `espejo_min_productos`,
  `espejo_umbral_pct`). Solo lectura para `authenticated`; se edita desde el Table Editor.

### Columnas de `merma` no documentadas antes
- `insumo_norm` — nombre del insumo normalizado (mayúsculas, sin espacios extra). Puede venir
  nulo en filas viejas anteriores a `migracion_09` (ver RIESGO C del plan del módulo
  consolidado); las vistas que agrupan por esto usan `coalesce` al nombre crudo como respaldo.
- `motivo_tipo` — clasificación de `clasificarMotivo` (`motivo.mjs`): caducidad / daño /
  cortesía / otro / nulo (sin clasificar). Ver `contexto/negocio.md`.
- `fecha_merma` — la fecha que trae el comentario del POS, cuando existe. Es la **fecha
  efectiva** que usan las vistas (`coalesce(fecha_merma, fecha)`); `fecha` a secas es la
  fecha de captura.
- `costo_confiable` — booleano, `false` cuando el costo capturado en el POS es sospechoso
  (p. ej. costo mayor al precio de venta). Ya **no filtra** la valorización del tablero; ver
  "`costo_confiable` ya no filtra la valorización" en `contexto/decisiones.md`.

### Vistas (ya vienen agregadas para el dashboard)

Por sucursal:
- `v_sucursales_merma` — sucursales que sí tienen datos, para el selector.
- `v_merma_diaria`, `v_merma_semanal`, `v_merma_por_producto`
- `v_merma_por_tipo` — piezas y pesos por `motivo_tipo` (incluye "sin clasificar").
- `v_merma_costo_sospechoso` — insumos con `costo_confiable = false`, para corregir captura
  en el POS (no para valorizar).

Todas las anteriores leen de `merma_costeada`, la vista base que cruza `merma` con
`sucursal_region`, `equivalencias` y `precios`. Desde el hito de consolidado también expone
`insumo_norm` y `costo_confiable` (columnas 19 y 20, al final; ver
`contexto/restricciones.md`).

Consolidado de cadena (una línea por vista, grano en negritas):
- `v_consolidado_diaria` — **fecha**: piezas, pesos, sucursales aportantes, piezas sin valorizar.
- `v_consolidado_semanal` — **semana ISO**: igual que la diaria, más `dias_con_captura` y
  `dias_sucursal` (ver "Días con captura no es aditivo" en `contexto/negocio.md`).
- `v_consolidado_aporte_semanal` — **sucursal × semana**: el aporte de cada sucursal, base de
  la prueba de conciliación.
- `v_consolidado_por_producto` — **insumo normalizado**: ranking de productos de toda la
  cadena, con `costos_distintos` para detectar "varía por región".
- `v_consolidado_por_tipo` — **tipo de motivo**: incluye cortesía, otro y sin clasificar.
- `v_consolidado_por_region` — **región** (incluida la nula): piezas, pesos y
  `costos_provisionales`.
- `v_consolidado_cobertura` — **sucursal del padrón ∪ con datos**: `full outer join` entre
  `sucursales` y `distinct merma.sucursal`; trae `nombre_display`, `en_padron`,
  `tiene_region`, `estatus_sync`.
- `v_consolidado_insumos_hueco` — **causa × insumo**: piezas sin costear, agrupadas por "sin
  región", "sin equivalencia" o "sin precio en su región".
- `v_consolidado_costo_sospechoso` — **insumo**: espejo consolidado de
  `v_merma_costo_sospechoso`, para toda la cadena.
- `v_consolidado_regiones_espejo` — **par de regiones**: lee `precios` (no `merma_costeada`);
  detecta si dos regiones tienen costos idénticos, señal de lista provisional.

Todas con **RLS** y `security_invoker`. Autenticación con **Supabase Auth** (correo + contraseña).

## El extractor

- Carpeta `extractor/`, programa principal `extraer_merma.mjs`.
- Lee las sucursales de `sucursales.json` (privado: host, usuario y contraseña de cada una).
- Extrae desde **julio 2026** hacia adelante, nunca el histórico completo del POS. En la
  primera corrida de una sucursal trae todo desde el `2026-07-01`; en las siguientes, solo
  el incremento del día.
- Hace **UPSERT** en Supabase.
- Si una sucursal está caída, la marca como error en `sync_estado` y **sigue con las demás**.
- Puede correr todas o una sola pasándole el nombre como argumento.

## Automatización

- **Diario a las 9pm**: Windows Task Scheduler corre `correr_merma.cmd` (todas las sucursales
  + regeneración de equivalencias).
- **Bajo demanda**: el botón "Actualizar" del dashboard llama a `/api/actualizar`. Corre **una
  sucursal o todas**: si el cuerpo de la petición trae `sucursal`, extrae solo esa; si llega
  sin `sucursal` (el caso del botón "Actualizar todas" en la vista de cadena,
  `/dashboard?sucursal=__cadena__`), el extractor corre sin filtro sobre todas las sucursales
  configuradas en `sucursales.json` (hoy, las que ya están conectadas y alcanzables — ver
  `contexto/estado.md`).

## Conectar una sucursal nueva al consolidado

Una vez que el extractor ya la lee (`sucursales.json`, ver `contexto/restricciones.md`),
sumarla al consolidado es **dato, no código**. Tres acciones, sin migración ni redeploy:

1. Insertar su fila en `sucursales` (nombre canónico, `nombre_display`, `region`, `estado`,
   `orden`).
2. Insertar su fila en `sucursal_region` (la autoridad que valoriza; ver "Reglas del
   consolidado" en `contexto/restricciones.md`).
3. Cargar la lista de precios de su región en `precios`, si esa región todavía no tiene una.

Si falta cualquiera de las tres, el tablero lo avisa solo: sin fila en `sucursales`, la
sucursal aparece en Aporte marcada "fuera del padrón"; sin fila en `sucursal_region`, sus
pesos salen "no valorizada"; sin precios en su región, sus insumos caen en
`v_consolidado_insumos_hueco` con causa "sin precio en su región".
