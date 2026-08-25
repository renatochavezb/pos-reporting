# Restricciones técnicas

Límites duros del entorno. No son preferencias: código que los ignore falla en producción.

## SQL Server 2008 R2, nivel de compatibilidad 100

El POS corre sobre un motor viejo. **No están disponibles**:

- `TRY_CONVERT` / `TRY_CAST`
- `IIF`
- `CONCAT`
- `LAG` / `LEAD` y funciones de ventana modernas
- `OFFSET ... FETCH`

Cualquier consulta al POS debe escribirse con sintaxis compatible con 2008 R2:
`CASE WHEN` en lugar de `IIF`, `+` con `CAST` explícito en lugar de `CONCAT`,
subconsultas o self-joins en lugar de `LAG`/`LEAD`.

## Acceso de solo lectura

- Usuario **`reportes_ro`** en cada sucursal. La aplicación **nunca escribe en el POS**.
- Todas las consultas usan **`READ UNCOMMITTED`** para no bloquear la operación de la caja.
  Una consulta pesada sin ese hint puede detener las ventas de la tienda.

## Red

- El acceso a las sucursales es por **Hamachi**. Las IPs dependen de que la máquina de la
  sucursal esté encendida y conectada.
- Una sucursal caída **no debe abortar la corrida**: se marca el error en `sync_estado` y se
  continúa con las demás.

## Blindaje de sucursal canónica

**Caso real:** la máquina de Misiones / Juárez 3 antes pertenecía a CANTERA y **conserva datos
viejos de CANTERA en su base**.

El extractor toma **únicamente la sucursal canónica de cada servidor**. Si se quita ese
blindaje, se arrastran datos de otra tienda y los totales quedan inflados sin ninguna señal
de error.

Además: **Misiones y Juárez 3 son la misma sucursal.** La CANTERA verdadera es una tienda
distinta, todavía no conectada.

## Ventana de extracción

El extractor **nunca lee el histórico completo del POS**. El piso es el **1 de julio de 2026**:
no se extrae nada anterior a esa fecha.

La ventana la decide el extractor **por sucursal**, consultando `max(fecha)` de esa sucursal
en Supabase:

- **Sucursal sin datos** → backfill desde el piso. Pasa una sola vez, al conectarla.
- **Sucursal con datos** → solo el incremento: desde la última fecha ya extraída menos un día
  de traslape, que alcanza las capturas tardías y las cancelaciones (tipo 19).

Así el volumen que se le pide a cada sucursal cada noche se mantiene plano, que es justo lo que
esta restricción protege. Releer un día es seguro: el UPSERT va por
`(sucursal, no_transaccion)` y actualiza en vez de duplicar.

Ampliar la ventana más allá de esto sigue prohibido sin medir el impacto: la conexión va por
VPN sobre la red de la tienda.

## Reglas del consolidado

Límites del módulo de consolidado de cadena (`/dashboard?sucursal=__cadena__` y las vistas
`v_consolidado_*`). Ignorarlos rompe el tablero completo, no solo el consolidado, porque
todos cuelgan de `merma_costeada`.

1. **`nombre_display` nunca es llave.** No entra a un `group by`, ni a un `join ... on`, ni a
   un `where`, ni a una URL. Es texto para pantalla, nada más. Agrupar o filtrar por él rompe
   el módulo porque `merma.sucursal` nunca lo usa — el dato real sigue escrito con el nombre
   canónico (ver `contexto/decisiones.md`, "Nombre canónico vs. nombre para mostrar").
2. **Las vistas `v_consolidado_*` no llevan filtros propios de `tipo` ni de `costo_confiable`**
   (excepto `v_consolidado_insumos_hueco` y `v_consolidado_costo_sospechoso`, que filtran a
   propósito porque esa es su función de diagnóstico, no de total). El neteo del tipo 18/19 y
   la exclusión de los tipos 29/30 se heredan de `merma_costeada`. Agregar un filtro de tipo o
   de costo en una vista del consolidado la descuadra contra la suma de las vistas por
   sucursal — rompe la conciliación que es la razón de ser del módulo.
3. **`merma_costeada` solo se modifica con `create or replace view`**, conservando las 18
   primeras columnas en su orden exacto (nombres, tipos, posición); cualquier columna nueva va
   al final. **Nunca `drop view merma_costeada` ni `drop ... cascade`**: de ahí cuelgan
   `v_merma_diaria`, `v_merma_semanal`, `v_merma_por_producto` y `v_merma_por_tipo` — un
   `cascade` tumba las cuatro y el tablero deja de existir.
4. En `supabase/` **solo se crean archivos nuevos**, nunca se edita uno existente (ver
   "Estructura del repo" en `contexto/CLAUDE.md`).
5. **HALLAZGO IMPORTANTE — dos fuentes de región, que pueden divergir.** Hay dos orígenes
   independientes del dato "región de una sucursal":
   - `sucursal_region` es la **autoridad para valorizar**: es la tabla que `merma_costeada`
     cruza contra `precios` para calcular `costo_unit` e `importe_costo`.
   - `sucursales.region`, del catálogo del consolidado, es **solo para mostrar y agrupar**
     (la usan `v_consolidado_cobertura` y `v_consolidado_por_region` como columna de salida).

   Si las dos dejan de coincidir — por ejemplo, una sucursal con `sucursales.region = 'JUAREZ'`
   pero sin fila en `sucursal_region` — el tablero diría "esta sucursal sí tiene región"
   mientras **todos sus pesos salen nulos**. Es el mismo cero silencioso que este módulo existe
   para evitar, reintroducido por tener dos fuentes en vez de una. Por eso el aviso de "sin
   región" del consolidado no confía en una sola señal: cruza `tiene_region = false` (del
   catálogo) con las sucursales que aparecen en `v_consolidado_insumos_hueco` con causa "sin
   región" (que sí depende de `sucursal_region`, vía `merma_costeada`). Así el aviso se dispara
   venga el hueco de donde venga.

   **Al conectar una sucursal hay que darla de alta en las dos tablas** (`sucursales` y
   `sucursal_region`), nunca en una sola. Ver el flujo completo en `contexto/datos.md`,
   "Conectar una sucursal nueva al consolidado".

## Puertos

El tablero corre en **4000**, no en 3000. El 3000 lo ocupa otro proyecto en la misma PC.

## Archivos que nunca se tocan

`extractor/.env`, `extractor/sucursales.json`, `web/.env.local`.
Contienen las credenciales de las 12 sucursales y las llaves de Supabase. Están en
`.gitignore` y no deben leerse, editarse ni subirse.
