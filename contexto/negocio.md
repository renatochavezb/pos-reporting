# Reglas de negocio — Dulce Noviembre

Estas reglas determinan si un número sale bien o mal. No son deducibles del código ni del
esquema: vienen de cómo opera SeattlePOS y de cómo trabaja la cadena. **Ignorar una de estas
produce un reporte que se ve correcto y está mal.**

## El problema que resuelve el sistema

12 sucursales, cada una con su propio SeattlePOS. La información está atrapada en cada tienda:
para saber cuánto se vendió o se mermó había que entrar POS por POS. Los supervisores llevaban
sus números a mano y no existía una fuente única confiable.

Prioridad del proyecto: **ventas + merma**, en ese orden de importancia para el negocio.

---

## Merma

- **Merma = kardex tipo 18.** El tipo **19 la cancela** y debe netearse contra el 18.
- Los tipos **29 y 30 son ajustes de inventario, NO son merma**. Incluirlos infla el número.
- La merma en el POS viene en **cantidades de insumo, no en dinero**. Para valorizarla se
  encadena:

  ```
  merma (kardex 18)  →  equivalencias (nombre de insumo → producto con precio)
                     →  precios (región × producto × tamaño)  →  costo en $
  ```

- Las **equivalencias se regeneran automáticamente después de cada extracción**, para que un
  producto nuevo no quede sin costo.
- Los **costos difieren entre Chihuahua y Juárez**. La lista de precios se carga por región.

### Fecha de la merma
Se agrupa por la **fecha del evento, no la de captura**:
- Si el comentario del POS trae una fecha, se usa esa. Formato **día/mes/año**.
- Si no la trae, se usa la fecha de captura.

### Clasificación por comentario
Al personal se le pidió escribir en el comentario **el motivo y la fecha real**.
`clasificarMotivo` en `motivo.mjs` lee ese texto y clasifica en:
**caducidad / daño / cortesía / otro**.

Los comentarios apenas empezaron a llenarse, así que el histórico tiene mucho
"sin clasificar". El sistema ya está listo; faltan los datos.

Las cuatro clases (caducidad / daño / cortesía / otro) más "sin clasificar" **deben sumar
siempre el total de piezas del periodo** — ninguna pieza queda fuera de las cinco. El panel de
clasificación del consolidado (`/dashboard?sucursal=__cadena__`) ya muestra las cinco; el panel
de una sola sucursal sigue mostrando solo tres (caducidad / daño / sin clasificar), una
decisión de diseño previa al consolidado: con una sola sucursal, cortesía y otro casi nunca
tienen piezas.

---

## Ventas (aún no construido — estas reglas aplican cuando se construya)

- **Un ticket se identifica por TRES columnas: `NoTicket`, `Letra`, `Sucursal`.**
  Usar solo `NoTicket` duplica los importes. Este es el error más caro del esquema.
- **Venta real = tickets en estado 3 (pagado).**
- **Venta neta = Total − IVA.** La **propina no es venta**.
- El **método de pago vive en `TicketCobroFormaPago`**, no en `Tickets.NoFormaDePago`.
  Ese último campo es la *condición* (contado / crédito / cortesía), no el medio de pago.
- El **costo correcto es el del detalle del ticket**, no el del encabezado.
- El **día de negocio es el del turno, no el del reloj.** Una venta a la 1am puede pertenecer
  al día anterior.

---

## Cómo se lee el tablero

La **semana en curso es siempre lo primero**. La comparación relevante es semana actual contra
semana pasada, con su variación. El resto (histórico, productos críticos, por tipo) es
secundario.

### Comparabilidad en el consolidado

En **toda la cadena**, comparar el total bruto de la semana actual contra el de la semana pasada
solo es honesto si aportó **el mismo conjunto de sucursales** en ambas. Si entró una sucursal
nueva (o una dejó de mandar datos), el total sube o baja por cobertura, no por merma, y un
porcentaje calculado sobre los brutos miente.

Regla: el % de variación de la cadena se calcula sobre la **intersección** de sucursales que
aportaron en ambas semanas. Si el conjunto es idéntico, es el mismo % de siempre. Si difiere, se
muestran los dos totales brutos **sin conectarlos con un %**, más un % aparte calculado solo
sobre las sucursales comunes, etiquetado explícitamente ("base comparable: N sucursales, excluye:
..."). Si no hay ninguna sucursal en común, nunca se muestra un porcentaje. En la vista de una
sola sucursal esto no aplica: ahí "base comparable" siempre es esa única sucursal.

### Días con captura no es aditivo en el consolidado

"Días con captura" cuenta días calendario, no días-sucursal: si 2 sucursales capturaron 5 días
cada una, **no son 10 días**, siguen siendo como máximo 7 (los días de la semana). Por eso el
consolidado reporta dos números distintos y no los confunde:
- **Días con captura** = días en que al menos una sucursal capturó (máximo 7 por semana).
- **Cobertura de captura** = pares (sucursal, día) con datos, sobre el máximo teórico
  (sucursales aportantes × 7). Este sí es aditivo y sirve para medir qué tan completa fue la
  semana, no cuántos días calendario tuvo actividad.
