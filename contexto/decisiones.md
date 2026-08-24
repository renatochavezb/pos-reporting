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

**Lección operativa:** ante un descuadre, verificar primero los datos de entrada (Excel de
precios, equivalencias faltantes, comentarios sin fecha) antes de tocar la lógica.

---

## Seguridad

- Solo lectura en el POS (`reportes_ro`, `READ UNCOMMITTED`): la aplicación nunca modifica la
  operación de la tienda.
- Credenciales y llaves **nunca en GitHub**: `extractor/.env`, `extractor/sucursales.json`,
  `web/.env.local` están ignorados.
- Repositorio: https://github.com/renatochavezb/pos-reporting
