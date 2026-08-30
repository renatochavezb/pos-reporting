import { NextResponse } from "next/server";

// Rutas privadas que requieren sesión.
const PROTEGIDAS = ["/dashboard", "/precios", "/nvo", "/ajustes"];

// Chequeo ligero de sesión: solo mira si existe la cookie de auth de Supabase.
// No importa el cliente de Supabase para mantener el middleware compatible con
// el Edge Runtime de Vercel. La validación real del token la hacen las páginas
// (server components) y el cliente del navegador refresca la sesión solo.
export function middleware(request) {
  const path = request.nextUrl.pathname;
  const protegida = PROTEGIDAS.some((p) => path.startsWith(p));
  if (!protegida) return NextResponse.next();

  const tieneSesion = request.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token/.test(c.name) && c.value);

  if (!tieneSesion) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/precios/:path*", "/nvo/:path*", "/ajustes/:path*"],
};
