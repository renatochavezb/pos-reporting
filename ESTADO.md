# Dulce Noviembre — reportes desde SeattlePOS

Estado al **15-ago-2026**.

## Dónde estamos

| Pieza | Estado |
|---|---|
| Esquema del POS entendido (kardex, tickets, costos) | ✅ |
| Reporte de **merma** — SQL | ✅ `sql/merma_resumen.sql` |
| Reporte de **merma** — Excel desde export del POS | ✅ `reporte_merma_excel.js` |
| Reporte de **ventas** — SQL | ✅ `sql/ventas_movimientos.sql` + `sql/ventas_resumen.sql` |
| **Datos reales de las 12 sucursales** | ❌ **bloqueado** |
| Dashboard / Next.js | ⬜ pendiente |
| Automatización diaria | ⬜ pendiente |

## El bloqueo

`.\SQLEXPRESS` tiene restauradas `SeattlePOS_18` y `SeattlePOS_pruebas`, pero **no
son producción**: 143 tickets de 2020-2021, una sola sucursal (MATRIZ), y el
catálogo trae COLON / MATRIZ / SAN FELIPE en vez de las 12 reales.

Sirven para una cosa y solo una: **validar que el SQL corre y que el esquema es
el que creemos**. Ningún número de ahí es del negocio.

Para desbloquear hace falta una de dos:

1. **Un `.bak` por sucursal** → `sql/01_respaldo_en_sucursal.sql` (COPY_ONLY, no
   rompe la cadena de respaldos de la tienda) y `sql/02_restaurar_local.sql`.
2. **Conexión remota** a cada sucursal. `sql/descubrir_conexiones.ps1` corrido en
   esta PC no encontró ninguna: no hay POS instalado aquí. Hay que correrlo en la
   PC de las supervisoras. Lo único que apareció fue una cadena dentro de
   `Sucursales.ConnectionString` (SAN FELIPE → `Data Source=WIN10`, usuario `sa`),
   que es del ambiente de pruebas.

Mientras tanto, la vía que **sí produjo un reporte real** fue el export manual de
kardex a Excel → `reporte_merma_excel.js` (FUENTES MARES, 1-14 ago).

## Restricciones que no son negociables

- **Nivel de compatibilidad 100 (SQL 2008)** aunque el motor sea 2022. Nada de
  `TRY_CONVERT`, `IIF`, `CONCAT`, `STRING_AGG`, `LAG/LEAD`, `OFFSET/FETCH`.
- Todo query contra producción va con `READ UNCOMMITTED`: un lock nuestro puede
  dejar a una cajera sin poder cerrar una venta.

## Trampas del esquema ya descubiertas

Están documentadas en el encabezado de cada `.sql`. Las que más duelen:

- **La llave del ticket son 3 columnas** — `(NoTicket, Letra, Sucursal)`. Con una
  sola, los importes se duplican entre sucursales.
- **`NoFormaDePago` no es el método de pago** — es la condición (contado / crédito
  / cortesía). El método está en `TicketCobroFormaPago`.
- **El total no se saca sumando `TicketDetalles`** — hay tickets con encabezado en
  2000 y detalles en 500 (líneas transferidas a comedor). Importes del
  encabezado, mix por producto del detalle. Nunca al revés.
- **El día de negocio es el del turno, no el del reloj** — el turno se llama
  `d/M/yyyy-NoCaja`. Si queda abierto, la venta cae con fecha de hoy pero
  pertenece al día del turno. Los cortes de caja cuadran por turno.
- **El tipo 30 (BAJAS DIRECTAS) no es merma** — es la pareja del 29 en sesiones de
  conciliación. Contarlo inflaba la merma ~21%. Ver `sql/kardex_movimientos.sql`.
- **El export del POS a Excel intercambia día y mes** cuando el día es ≤ 12
  (1-ago sale como 8-ene). Corregido en `reporte_merma_excel.js`.

## Siguiente paso

Conseguir datos reales. Todo lo demás ya está escrito y probado contra el esquema.
