# Estado actual

> Este archivo cambia seguido. Actualízalo cuando conectes una sucursal o termines un módulo.
> Última revisión: agosto 2026.

## Sucursales

De las 12, el trabajo va sucursal por sucursal.

| Sucursal            | Base de datos    | Estado |
|---------------------|------------------|--------|
| Fuentes Mares       | `SURDB2026`      | Conectada, con datos reales y validada contra supervisor |
| Misiones / Juárez 3 | `MisionesDB2026` | Conectada. La máquina antes era de CANTERA (ver blindaje en restricciones.md) |
| Torres              | `TorresDB2026`   | Usuario de lectura creado. Pendiente su IP de Hamachi; no alcanzable aún |
| CANTERA (la real)   | —                | Pendiente. Es una tienda distinta de Misiones/Juárez 3 |
| Las 8 restantes     | —                | Pendientes de conectar |

## Módulos

| Módulo | Estado |
|---|---|
| Merma — extractor | Funcionando |
| Merma — dashboard | Funcionando (`/dashboard`) |
| Precios — carga de Excel por región | Funcionando (`/precios`) |
| Ventas | **No construido.** Tablas ya mapeadas en `TABLAS.md` |
| Caja / arqueo | **No construido.** Faltan confirmar columnas de `CortesDeCaja` |

## Pendientes conocidos

1. Conectar las 9 sucursales restantes (Torres solo espera su IP de Hamachi).
2. **Lista de costos real de Juárez** — hoy viene duplicada de Chihuahua, lo que distorsiona
   la valorización de esa plaza.
3. Que el personal llene los comentarios de merma (motivo + fecha día/mes/año). El sistema ya
   lee y clasifica; faltan los datos.
4. Confirmar columnas de `CortesDeCaja` cuando la red esté estable.

## Objetivo del sistema completo

Un tablero único donde dirección y supervisión vean **ventas y merma de las 12 sucursales**,
comparadas y valorizadas, sin entrar a ningún POS — con la semana en curso siempre como lo
primero que se ve.

Lo que falta construir sobre las tablas ya mapeadas:
- Ventas netas por sucursal / día / turno
- Mezcla de productos vendidos
- Métodos de pago (para cuadrar el corte)
- Cancelaciones y descuentos (control de fugas)
- Reportes de caja / arqueo
- Horarios de mayor venta y tendencias de compra
