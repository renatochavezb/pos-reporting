// Subida/lectura de fotos en Google Drive vía OAuth (refresh token).
// La app actúa "como tú" (tu cuenta de Google), así las fotos usan tu espacio
// y quedan en tu Drive. Sin dependencias extra: todo por REST con fetch.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";

export function driveConfigurado() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

async function accessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error("Google OAuth: " + (d.error_description || d.error || r.status));
  return d.access_token;
}

async function buscarCarpeta(token, name, parentId) {
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${name.replace(/'/g, "\\'")}'` + (parentId ? ` and '${parentId}' in parents` : "");
  const url = `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const d = await r.json();
  return d.files?.[0]?.id || null;
}
async function crearCarpeta(token, name, parentId) {
  const meta = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) meta.parents = [parentId];
  const r = await fetch(`${API}/files?fields=id`, {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(meta),
  });
  const d = await r.json();
  if (!d.id) throw new Error("No se pudo crear la carpeta en Drive");
  return d.id;
}
async function carpeta(token, name, parentId) {
  return (await buscarCarpeta(token, name, parentId)) || (await crearCarpeta(token, name, parentId));
}

// Sube un archivo a "Bitácoras DN / <sucursal>". Devuelve el id de Drive.
export async function subirADrive({ buffer, filename, mime, sucursal }) {
  const token = await accessToken();
  const parent = process.env.GOOGLE_DRIVE_FOLDER_ID || (await carpeta(token, "Bitácoras DN", null));
  const sub = await carpeta(token, sucursal, parent);
  const meta = { name: filename, parents: [sub] };
  const boundary = "dnb" + Math.random().toString(16).slice(2);
  const cuerpo = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch(UPLOAD, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: cuerpo,
  });
  const d = await r.json();
  if (!r.ok || !d.id) throw new Error("Drive upload: " + (d.error?.message || r.status));
  return d.id;
}

// Descarga los bytes de un archivo de Drive (para servirlo dentro de la app).
export async function descargarDeDrive(id) {
  const token = await accessToken();
  const r = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media`, { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error("Drive download: " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  return { buf, mime: r.headers.get("content-type") || "image/jpeg" };
}
