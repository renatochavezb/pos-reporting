// Formateadores de números y fechas del tablero de merma.
// Extraídos de dashboard/page.js para poder reusarlos en los componentes nuevos
// del consolidado sin duplicar la lógica.

export const pesos = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export const pesos0 = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

// Cantidades de piezas, con separador de miles. Para conteos chicos (una sola sucursal)
// no cambia nada a la vista; para el consolidado, donde los totales pueden ir a los miles,
// evita números pegados e ilegibles.
export const piezas = (n) => (n == null ? "—" : new Intl.NumberFormat("es-MX").format(n));

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const diaMes = (s) => {
  if (!s) return "";
  const [, m, d] = s.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]}`;
};

export const fechaHora = (iso) =>
  !iso
    ? "—"
    : new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso));

// Nombre de región para mostrar. Las regiones son un catálogo chico y estable (a diferencia
// de las sucursales, que van a crecer a 12), así que aquí basta un mapa fijo -- mismo patrón
// que ya usa web/app/(private)/(user)/precios/page.js para sus encabezados "Chihuahua"/
// "Juárez". Si se agrega una región nueva, cae al texto crudo en vez de romperse.
export const regionTexto = (region) =>
  region === "CHIHUAHUA" ? "Chihuahua" : region === "JUAREZ" ? "Juárez" : region == null ? "Sin región" : region;
