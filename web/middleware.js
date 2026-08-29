import { updateSession } from "@/libs/supabase/middleware";

export async function middleware(request) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/precios/:path*", "/misiones-nvo/:path*", "/fuentes-mares-nvo/:path*"],
};
