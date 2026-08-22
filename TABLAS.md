# Tablas útiles de SeattlePOS — Dulce Noviembre

Mapa de las tablas del POS (SeattlePOS 18, mismo esquema en las 12 sucursales).
De las ~435 tablas, solo ~25 sirven para reportes; el resto son configuración,
catálogos del SAT (CFDI) y pantallas del POS.

Columnas **en negrita** = las clave para reportes.

---

## 🛒 VENTAS

### `Tickets` — encabezado de cada venta
Base de todo reporte de ventas. **Llave = (NoTicket, Letra, Sucursal)**.
- **NoTicket, Letra, Sucursal** — identifican la nota (la llave son las 3).
- **FechaHora**, **TurnoDeVenta** (`d/M/yyyy-NoCaja`), NoCaja, **Usuario**, Cliente
- **NoEstadoTicket** — `1`=impreso (cuenta abierta), `2`=cancelado, **`3`=pagado (venta real)**
- **NoTipoDeVenta** — `1`=comedor, `2`=para llevar, `3`=domicilio
- **NoFormaDePago** — condición: `1`=contado, `2`=crédito, `3`=cortesía (⚠️ NO es el método de pago)
- **Subtotal, IVA, Total**, Descuento, Incremento, Propina, **Costo**, GananciaRepartidor

### `TicketDetalles` — los productos de cada nota (mix de venta)
- NoTicket, Letra, Sucursal, NoDetalle, **NoProducto**, **Cantidad**, **PrecioUnitario**, **Importe**, IVA, **CostoUnitario**, **Costo**, DescripcionCorta
- **UsuarioDelete / MotivoDelete** — renglones borrados antes de cobrar (excluir)
- FolioDeCancelacion, TipoTransferencia

### `TicketCobro` — el cobro
- FolioDeNotaDeVenta, NoTicket/Letra/Sucursal, **FechaHoraAlCobrar**, **UsuarioAlCobrar**, Subtotal, IVA, Propina, Total
- Desglose: Pesos, Dolares, TarjetaDeCredito, TarjetaDeDebito, Transferencias, Vales, Cheques…
- **UsuarioAutorizoDescuento**, DescuentoPorcentaje (control de fugas)

### `TicketCobroFormaPago` — método de pago real ⭐
- FolioDeNotaDeVenta, **IDFormaPago**, **Importe** → aquí está si pagaron efectivo/tarjeta/etc. (para cuadrar el corte).

### `TicketPorcentajeIVA`
- NoTicket, Letra, Sucursal, **PorcentajeIVA**

### `TicketCancelacion` — cancelaciones
- NoTicket/Letra/Sucursal, Usuario, FechaHora, **Motivo**, TurnoDeVenta, Modulo

### `TurnosDeVenta` — turnos
- **TurnoDeVenta**, Sucursal, NoCaja, FechaHora, Usuario, **Actual** (1 = turno abierto ahora)

### `TicketRepartidor`, `TicketDatosServicioADomicilio` — ventas a domicilio

---

## 📦 INVENTARIO / MERMA

### `KardexInsumoPuntoDeVenta` — ⭐ TODOS los movimientos de inventario
De aquí sale la merma, el consumo por ventas, compras y ajustes.
- **NoTransaccion** — id único (watermark para extracción incremental)
- **NoInsumo**, Sucursal
- **NoTransaccionKey** — TIPO de movimiento: **`18`=merma**, `19`=cancela merma, `8-17`=venta, `2`=compra, `29/30`=ajustes (altas/bajas directas), `3`=transferencia…
- **Transaccion** — nombre del tipo ("MERMAS EN PUNTO DE VENTA")
- **FechaHora**, ExistenciaAnterior, **Cantidad** (signo: `–` salida, `+` entrada), ExistenciaActual
- Usuario, **Folio** (sesión de captura = NoMerma), Modulo

### `KardexInsumoCosto` — costos por insumo
- NoTransaccion, **NoInsumo**, Sucursal, **FechaHora**, CostoAnterior, **CostoActual** (costo vigente a esa fecha)

### `Insumos` — catálogo de insumos
- **NoInsumo**, **Insumo** (nombre), DescripcionCorta, **CategoriaDeInsumo**, SubCategoriaDeInsumo, **UnidadDeMedida**, UtilizaInventarioNegativo, GastoIndirecto

### `InsumoExistenciaPuntoDeVenta` — existencia actual
- **NoInsumo**, Sucursal, **Existencia**, NoTransaccionKey, Transaccion, Usuario, Folio, Modulo

### `MermasPuntoDeVenta` — captura de merma (encabezado)
- **NoMerma**, Sucursal, **Fecha**, **Usuario**, Modulo, **NoEstado**, UsuarioCancelo, FechaDeCancelacion, MotivoDeCancelacion, NoInventario

### `MermaPuntoDeVentaDetalles` — renglones de merma ⭐
- **NoMerma**, Sucursal, NoDetalle, **NoInsumo**, **Insumo**, **Cantidad**, Multiplicador, **Conversion**, UnidadDeMedida, **Motivo** (comentario: caducidad/daño + fecha real)

### Ajustes y conteos físicos
- `InventarioBajasDirectas` / `…Detalles` / `…Color` — bajas directas
- `InventarioCapturaDirecta` / `…Detalles` — altas/ajustes directos
- `InventarioInicialPuntoDeVenta` / `…Detalles` — inventario inicial
- `InventarioFisicoPuntoDeVenta` / `…Semanal` / `…Detalles` — conteos físicos
- `KardexProductosPuntoDeVenta` — kardex de productos terminados

---

## 🏷️ CATÁLOGOS (apoyo — nombres y precios)

### `Productos` — catálogo de productos vendibles
- **NoProducto**, **Producto**, DescripcionCorta, **CategoriaDeProducto**, SubCategoriaDeProducto, CategoriaDeVenta, UnidadDeMedida, Tamano, c_ClaveProdServ

### `ProductoPrecio` — precio de venta ⭐
- **NoProducto**, **Sucursal**, **NoTipoDeVenta**, **Precio**, DesglozaIVA → precio público por sucursal y tipo de venta

### `FormaPagoID` — catálogo de métodos de pago
- **IDFormaPago**, **FormaPago** (Efectivo/Tarjeta…), c_FormaPago, UtilizaTipoDeCambio

### `Sucursales` — las tiendas
- **Sucursal**, Direccion, Colonia, Ciudad, Telefono, **Marca**, Letra, AreaGeografica, ConnectionString, HoraApertura, HoraCierre

### `EstadosTickets`, `TiposDeVenta`, `CategoriasDeVenta` — catálogos chicos (traducen los códigos)

---

## 💵 CAJA

### `CortesDeCaja` + subtablas — arqueo de caja
- `CorteDeCajaEntradas`, `CorteDeCajaSalidas`, `CorteDeCajaRubros`, `CorteDeCajaMonedas` — efectivo contado, entradas, salidas, faltantes/sobrantes.
- `CortesDeCajaMesero` + subtablas — corte por mesero.
- (Columnas exactas por confirmar.)

---

## ⚙️ NO ÚTILES (ignorar para reportes)

- **Configuración/UI:** `VariablesDelSistema*`, `Botones*`, `Menu`, `ProductoBoton`, `ProductoImagen*`, colores, impresoras, sonidos.
- **Replicación:** `AccesoReplicador`, `Replication*`.
- **Facturación CFDI/SAT:** `Factura33*`, `c_*` (c_Pais, c_Moneda, c_FormaPago… catálogos del SAT), `xmlMaster`, `WSDLTimbrado`. Solo si algún día se quieren reportes de facturas timbradas.

---

## ⚠️ Trampas clave (reglas de negocio)

- **Ticket = 3 columnas** (NoTicket, Letra, Sucursal). Con una sola, los importes se duplican.
- **Venta real = NoEstadoTicket 3.** **Venta neta = Total − IVA** (la propina no es venta).
- **Día de negocio = el del turno** (`TurnoDeVenta`), no el del reloj.
- **Método de pago** vive en `TicketCobroFormaPago`, NO en `Tickets.NoFormaDePago` (eso es condición).
- **Costo del detalle**, no del encabezado (`Tickets.Costo` viene mal).
- **Merma** = kardex tipo 18 (19 la cancela y netea), valorizada con `KardexInsumoCosto`; tipos 29/30 son ajuste, no merma.
- **SQL Server 2008 R2** (nivel compat 100): sin TRY_CONVERT, IIF, CONCAT, LAG/LEAD, etc. Todo con `READ UNCOMMITTED`.
