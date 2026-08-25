# Decisiones tomadas y errores ya diagnosticados

Léelo antes de proponer cambiar arquitectura o antes de "arreglar" un descuadre.
Varias de estas ya se evaluaron; repetir el análisis cuesta tiempo y a veces rompe algo.

## Por qué Supabase y no otra cosa

Se eligió **Supabase sobre SQL Server y sobre Mongo**: es Postgres administrado, trae
autenticación incluida y tiene plan gratuito. La decisión sigue vigente.

## Por qué Hamachi

Ya estaba puesto como puente hacia todas las sucursales. Evita instalar o exponer cada POS.

## Por qué el piso en julio 2026 y no el histórico completo

Extraer todo el histórico en cada corrida satura la conexión de las sucursales, que van por
VPN sobre la red de la tienda. Por eso la regla es un **piso fijo en el 1 de julio de 2026**
con **incremento diario**. La decidió Renato el 2026-08-23:

- Al conectar una sucursal nueva se trae su historial desde el `2026-07-01`. Una sola vez.
- De ahí en adelante cada corrida trae solo el día, con un día de traslape.

Se evaluó y **se descartó** la variante de extraer siempre desde julio 2026 en cada corrida:
es más simple de programar, pero la ventana crece sin tope (~6 meses por sucursal en diciembre,
~9 en marzo) y eso es precisamente lo que esta decisión evita.

La ventana se deriva de `max(fecha)` en Supabase y no de una bandera, para que se autocure:
si falla una noche, la corrida siguiente cubre el hueco sola sin intervención.

## Por qué el puerto 4000

El 3000 lo ocupa otro proyecto en la misma máquina de desarrollo.

---

## Descuadres reales y su causa verdadera

Estos casos importan porque en ambos la primera hipótesis fue "el código está mal", y en uno
de ellos no lo estaba.

### Fuentes Mares — sí era el código
- Dashboard: $3,085. Supervisor: $5,624.
- **Causa:** faltaba escribir el campo normalizado del insumo, lo que rompía el cruce con
  `equivalencias`. Los insumos sin equivalencia quedaban sin costo.
- **Corregido** → quedó en $5,785, que coincide con el supervisor.

### Juárez 3 — NO era el código
- Dashboard: $1,122. Supervisora: $261.
- **Causa:** en el Excel de precios, la columna de costo de Juárez estaba **duplicada de la de
  Chihuahua**. El código hacía exactamente lo que debía.
- **Pendiente del usuario:** cargar la lista de costos real de Juárez.
- **El consolidado ya cuantifica el problema en pantalla**: la banda de avisos muestra el
  monto y el porcentaje de pesos que hoy son costo provisional de Juárez (detectado por
  espejo de regiones, ver más abajo), no solo una advertencia de texto. El pendiente de cargar
  la lista real sigue abierto; ver `contexto/estado.md`.

**Lección operativa:** ante un descuadre, verificar primero los datos de entrada (Excel de
precios, equivalencias faltantes, comentarios sin fecha) antes de tocar la lógica.

---

## Comparabilidad entre semanas en el consolidado (2026-08-25)

- **`interseccion()` en `web/libs/consolidado.js`** calcula la comparabilidad entre semanas sin
  ninguna consulta nueva: reusa las filas de `v_consolidado_aporte_semanal` que `datosCadena` ya
  trae acotadas a `[lunesActual, lunesPrevio]`. Devuelve un estado (`sin_previa` / `misma_base` /
  `base_distinta` / `sin_interseccion`) más `deltaPct` y `nota` ya listos para pintar, para que
  `dashboard/page.js` no tenga que repetir la lógica de decidir cuándo un % es honesto.
- En `misma_base`, el `deltaPct` se recalcula desde las filas de aporte (no se reusa
  `semActual.pesos`/`semPrev.pesos` de `v_consolidado_semanal`). Numéricamente deben coincidir
  siempre que la base sea idéntica (son la misma suma agrupada distinto); se prefirió esta
  fuente por ser la que exige el hito y porque así toda la lógica de comparabilidad vive en un
  solo lugar.
- **`PanelClasificacion` (solo consolidado) no filtra por una lista fija de clases**: renderiza
  toda fila de `v_consolidado_por_tipo` con piezas != 0. Así la suma de las tarjetas es SIEMPRE
  igual a la suma de la vista, incluso si aparece una clase nueva sin icono propio (cae al icono
  genérico "•"). El panel de la vista individual, con su lista fija de 3 clases
  (caducidad/daño/sin clasificar), **no se tocó** — es una decisión de diseño previa, no un
  descuido: con una sola sucursal, cortesía/otro casi nunca tienen piezas.

## `costo_confiable` ya no filtra la valorización

Desde `migracion_10` / `migracion_13`, las vistas del tablero (`v_merma_diaria`,
`v_merma_semanal`, `v_merma_por_producto`, `v_merma_por_tipo` y toda la familia
`v_consolidado_*`) se calculan sobre `merma_costeada`, que valoriza con `precios.costo` y
**no** aplica ningún umbral sobre `costo_confiable`. Ese filtro (excluir de los pesos las
filas con costo capturado mal, p. ej. el caso de macarrones a $720,300) **sobrevive solo en
tres lugares, ya obsoletos**: `migracion_01_costo_confiable.sql`,
`migracion_04_merma_semanal.sql` y `extractor/verificar.mjs`.

Se documenta como obsoleto **y no se reactiva**, a propósito:
- Reactivarlo solo en el consolidado lo haría no cuadrar con la suma de sus partes (las vistas
  por sucursal ya no filtran) — rompería la conciliación que es la razón de ser del módulo.
- Reactivarlo en todas las vistas cambiaría números que ya fueron validados con los
  supervisores de cada sucursal.

Cualquiera de las dos cosas sería un cambio de comportamiento real, no una corrección de
contexto — es otro módulo, con su propio PRD y su propia autorización.

## Nombre canónico vs. nombre para mostrar

`sucursales.sucursal` es el **nombre canónico**: exactamente como lo escribe el POS. Es la
llave — aparece en `merma.sucursal`, `sucursal_region.sucursal`, `sync_estado.sucursal`, el
parámetro `?sucursal=` de la URL, y en todo `group by` y `join ... on` del módulo. **Nunca se
renombra.**

`sucursales.nombre_display` es la etiqueta que Renato quiere ver en pantalla. Caso concreto:
la sucursal se llama `JUAREZ 3` en el POS y en todos los datos; Renato la quiere ver como
`MISIONES`. La traducción vive únicamente en `sucursales.nombre_display`, se lee solo en el
`select` externo de `v_consolidado_cobertura` y en un mapa `{canónico → display}` del lado de
JS. Nunca entra a un `group by`, un `join on`, un `where` ni una URL — si se invirtieran los
dos valores en la siembra de la tabla, el módulo entero se caería porque ningún `join`
encontraría nada (`merma.sucursal = 'JUAREZ 3'`, jamás `'MISIONES'`).

## Detección de costos provisionales por espejo de regiones

El aviso de "costos provisionales" en Juárez no está cableado por nombre de región: se
detecta **comparando datos**. `v_consolidado_regiones_espejo` hace un self-join de `precios`
por `(producto_norm, tamano)` entre pares de regiones distintas y calcula qué proporción de
esos costos son idénticos. Si la proporción supera un umbral, se declara "espejo" — señal de
que una región copió su lista de precios de la otra. Al ser simétrica y sin nombres cableados,
**se apaga sola** el día que se cargue la lista real de costos de Juárez: dejará de haber
costos idénticos y `es_espejo` pasará a `false` sin tocar código.

El **umbral es una proporción (`espejo_umbral_pct`, hoy 0.90) y no una igualdad total**, a
propósito: con un umbral de 100% bastaría con que alguien editara un solo precio a mano para
que el aviso desapareciera, dejando cientos de costos todavía heredados sin ninguna señal. Un
falso negativo ahí es peor que un falso positivo. Los umbrales (`espejo_min_productos`,
`espejo_umbral_pct`) viven en la tabla `configuracion`, no cableados en SQL, para poder
ajustarlos sin migración.

La detección es simétrica, pero **la atribución de cuál región es la provisional no puede
serlo** — marcar a Chihuahua como provisional sería una acusación falsa cuando los datos
muestran lo contrario. El desempate sale del catálogo `regiones.es_referencia`: dentro de un
par en espejo, la provisional es la que tiene `es_referencia = false` (hoy, JUAREZ; CHIHUAHUA
es `es_referencia = true` porque su lista es la confiable y verificada). El flag del catálogo
nunca mantiene vivo el aviso por sí solo: si la detección en `precios` deja de ser cierta
(porque se cargó la lista real), el aviso se apaga aunque `es_referencia` no cambie.

## El centinela `__cadena__`

La vista consolidada se activa con `/dashboard?sucursal=__cadena__`. Se eligió ese valor y no
`"CONSOLIDADO"` ni `"TODAS"` porque un nombre en mayúsculas normales podría algún día
colisionar con el nombre real de una sucursal en el POS (los nombres canónicos del POS son
texto libre en mayúsculas). Los dobles guion bajo lo marcan como un valor reservado del
sistema, no un dato de negocio, y hacen improbable la colisión.

## El padrón de sucursales todavía no distingue quién lo ve

La tabla `sucursales` se creó con la misma política que todo lo demás hoy:
`for select to authenticated using (true)`. Cualquier usuario con sesión ve las 12.

Mientras no existan roles, no es un problema: el RLS de `merma` también es `using (true)`.
Pero **el día que se construya el RLS por sucursal, hay que filtrar también este catálogo**. Si
no, un supervisor de una plaza vería en "Aporte por sucursal" los nombres de las 12 tiendas con
ceros, y en la línea de cobertura un denominador que no le corresponde.

La línea de cobertura es lo que evita el daño mayor —que alguien crea que está viendo la cadena
completa cuando solo ve su parte—, pero no sustituye a la política.

## Seguridad

- Solo lectura en el POS (`reportes_ro`, `READ UNCOMMITTED`): la aplicación nunca modifica la
  operación de la tienda.
- Credenciales y llaves **nunca en GitHub**: `extractor/.env`, `extractor/sucursales.json`,
  `web/.env.local` están ignorados.
- Repositorio: https://github.com/renatochavezb/pos-reporting
