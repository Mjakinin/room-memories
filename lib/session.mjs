export const COOKIE = "room_session";
export const SESSION_SECONDS = 24 * 60 * 60;
const encoder = new TextEncoder();
const b64 = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
async function key(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function createSession(secret, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${crypto.randomUUID()}`;
  return `${payload}.${b64(await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload)))}`;
}
export async function verifySession(token, secret, now = Date.now()) {
  if (!secret || secret.length < 32 || !token || token.length > 240)
    return false;
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    !/^\d+$/.test(parts[0]) ||
    !/^[\w-]{43}$/.test(parts[2])
  )
    return false;
  const expiry = Number(parts[0]);
  if (expiry <= now / 1000 || expiry > now / 1000 + SESSION_SECONDS + 60)
    return false;
  try {
    const signature = Uint8Array.from(
      atob(parts[2].replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
    return await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      signature,
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}
export function cookieValue(header) {
  return (header || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
}
export function cookieHeader(value, secure = true, age = SESSION_SECONDS) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
}
