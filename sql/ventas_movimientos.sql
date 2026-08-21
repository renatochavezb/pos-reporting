/* ============================================================
   CAPA BASE: VENTAS  -  SeattlePOS
   ------------------------------------------------------------
   Fuente unica para todos los reportes de venta.
   Devuelve un renglon por TICKET COBRADO, con su dia de negocio,
   tipo de venta, forma de pago, costo y margen.

   Encima de esto salen: venta diaria, ticket promedio, mix por
   producto, formas de pago y comparativo entre sucursales.

   PARAMETROS: @FechaIni, @FechaFin, @Sucursal
   ============================================================ */

/* CRITICO: se lee de una base PRODUCTIVA en vivo.
   READ UNCOMMITTED evita tomar locks compartidos que podrian
   bloquear el INSERT de un ticket y dejar a una cajera sin poder
   cerrar una venta.                                             */
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SET NOCOUNT ON;

/* La base del POS esta en NIVEL DE COMPATIBILIDAD 100 (SQL 2008),
   aunque el motor sea 2022. No se pueden usar TRY_CONVERT, IIF,
   CONCAT, STRING_AGG, LAG/LEAD ni OFFSET/FETCH. Todo aqui esta
   escrito en sintaxis 2008 a proposito. No lo "modernices".     */
SET DATEFORMAT dmy;   -- el turno viene como d/M/yyyy; ISDATE lo valida asi

DECLARE @FechaIni date          = DATEADD(day, -30, CAST(GETDATE() AS date));
DECLARE @FechaFin date          = CAST(GETDATE() AS date);
DECLARE @Sucursal nvarchar(120) = NULL;   -- NULL = todas

/* ------------------------------------------------------------
   TRAMPAS DE ESTE ESQUEMA  (verificadas contra la base)
   ------------------------------------------------------------
   1. LA LLAVE DEL TICKET SON TRES COLUMNAS: (NoTicket, Letra,
      Sucursal). El NoTicket solo SE REPITE entre sucursales.
      Cualquier JOIN con las tres o los importes se duplican.

   2. NoEstadoTicket:  1 = IMPRESO   (cuenta abierta, aun no cobrada)
                       2 = CANCELADO
                       3 = PAGADO    <- esta es la venta real
      Solo el 3 es venta. El 1 son cuentas vivas del turno abierto.

   3. NoFormaDePago NO ES EL METODO DE PAGO. Es la condicion de
      venta: 1 = CONTADO, 2 = CREDITO, 3 = CORTESIA.
      El metodo de pago (efectivo/tarjeta/etc) vive en
      TicketCobroFormaPago. Confundirlos es el error clasico.

   4. EL TOTAL NO SE SACA SUMANDO TicketDetalles. Hay tickets
      donde el encabezado dice 2000 y los detalles suman 500,
      porque hubo lineas transferidas a comedor o borradas.
      Regla: importes -> del encabezado (Tickets/TicketCobro).
             mix por producto -> de TicketDetalles.
      Nunca al reves. Ver bloque 6 de ventas_resumen.sql.

   5. EL DIA DE NEGOCIO NO ES LA FECHA DEL TICKET. El turno se
      llama 'd/M/yyyy-NoCaja' y ahi va el dia real de operacion.
      Si alguien deja el turno abierto, la venta cae con fecha de
      hoy pero pertenece al dia del turno. En la base de muestra
      hay tickets del 21-sep dentro del turno del 15-sep.
      Los cortes de caja de la sucursal cuadran por TURNO, no por
      fecha. Por eso aqui salen las dos y el reporte usa la del
      turno.
   ------------------------------------------------------------ */

WITH cobrados AS (
    SELECT  t.Sucursal,
            t.NoTicket,
            t.Letra,
            t.NoCaja,
            t.TurnoDeVenta,
            t.FechaHora                       AS FechaHoraApertura,
            c.FechaHoraAlCobrar,
            t.Usuario                         AS UsuarioAbrio,
            c.UsuarioAlCobrar,
            t.Cliente,
            t.NoTipoDeVenta,
            t.NoFormaDePago,
            t.Modulo,
            t.Subtotal,
            t.Descuento,
            t.Incremento,
            t.IVA,
            t.Propina,
            t.Total,
            /* COSTO del DETALLE, no del encabezado: Tickets.Costo trae
               basura en datos reales (margen -232%). El costo por renglon
               de TicketDetalles si es correcto. Se excluyen borrados.     */
            ISNULL((SELECT SUM(d.Costo) FROM TicketDetalles d
                     WHERE d.NoTicket = t.NoTicket AND d.Letra = t.Letra
                       AND d.Sucursal = t.Sucursal
                       AND (d.UsuarioDelete IS NULL OR LTRIM(d.UsuarioDelete) = N'')), 0) AS Costo,
            c.FolioDeNotaDeVenta,
            /* dia de negocio: se extrae del nombre del turno
               'd/M/yyyy-NoCaja'. Si el turno viene mal escrito se
               cae a la fecha de cobro para no perder el ticket. */
            CASE WHEN CHARINDEX('-', t.TurnoDeVenta) > 1
                  AND ISDATE(LEFT(t.TurnoDeVenta, CHARINDEX('-', t.TurnoDeVenta) - 1)) = 1
                 THEN CONVERT(date, LEFT(t.TurnoDeVenta,
                              CHARINDEX('-', t.TurnoDeVenta) - 1), 103)
                 ELSE CAST(COALESCE(c.FechaHoraAlCobrar, t.FechaHora) AS date)
            END AS DiaDeNegocio
    FROM Tickets t
    LEFT JOIN TicketCobro c
           ON  c.NoTicket = t.NoTicket
           AND c.Letra    = t.Letra
           AND c.Sucursal = t.Sucursal
    WHERE t.NoEstadoTicket = 3                       -- solo PAGADO
      AND (@Sucursal IS NULL OR t.Sucursal = @Sucursal)
)
SELECT  Sucursal,
        DiaDeNegocio,
        DATEPART(hour, COALESCE(FechaHoraAlCobrar, FechaHoraApertura)) AS HoraDelDia,
        TurnoDeVenta,
        NoCaja,
        NoTicket,
        Letra,
        FolioDeNotaDeVenta,
        FechaHoraApertura,
        FechaHoraAlCobrar,
        /* minutos de permanencia: util en comedor, ruido en mostrador */
        DATEDIFF(minute, FechaHoraApertura, FechaHoraAlCobrar) AS MinutosEnMesa,
        UsuarioAbrio,
        UsuarioAlCobrar,
        Cliente,
        CASE NoTipoDeVenta WHEN 1 THEN 'COMEDOR'
                           WHEN 2 THEN 'PARA LLEVAR'
                           WHEN 3 THEN 'DOMICILIO'
                           ELSE 'OTRO' END            AS TipoDeVenta,
        CASE NoFormaDePago WHEN 1 THEN 'CONTADO'
                           WHEN 2 THEN 'CREDITO'
                           WHEN 3 THEN 'CORTESIA'
                           ELSE 'OTRO' END            AS CondicionDeVenta,
        Modulo,
        Subtotal,
        Descuento,
        Incremento,
        IVA,
        Propina,
        Total,
        Costo,
        CAST(Total - IVA - ISNULL(Costo,0) AS decimal(18,2))  AS UtilidadBruta,
        CASE WHEN (Total - IVA) > 0
             THEN CAST(100.0 * (Total - IVA - ISNULL(Costo,0))
                       / (Total - IVA) AS decimal(6,2)) END   AS PctMargen,
        /* alertas de calidad: se arrastran hasta el reporte para
           que nadie tome un numero sucio como bueno */
        CASE WHEN FechaHoraAlCobrar IS NULL THEN 'SIN COBRO' ELSE '' END AS AlertaCobro,
        CASE WHEN Costo IS NULL OR Costo = 0 THEN 'SIN COSTO' ELSE '' END AS AlertaCosto,
        CASE WHEN CAST(COALESCE(FechaHoraAlCobrar, FechaHoraApertura) AS date) <> DiaDeNegocio
             THEN 'TURNO CRUZADO' ELSE '' END                             AS AlertaTurno
FROM cobrados
WHERE DiaDeNegocio >= @FechaIni
  AND DiaDeNegocio <= @FechaFin
ORDER BY Sucursal, DiaDeNegocio, NoTicket;
