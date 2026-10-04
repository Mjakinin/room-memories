import { verifyPassword } from "../../lib/password.mjs";
import { createSession, cookieHeader } from "../../lib/session.mjs";
export default async function login(request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (request.method !== "POST")
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...headers, Allow: "POST" },
    });
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin)
    return new Response("Ungültiger Ursprung", { status: 403, headers });
  const secret = process.env.ROOM_SESSION_SECRET;
  if (!process.env.ROOM_PASSWORD_HASH || !secret || secret.length < 32)
    return new Response("Zugang noch nicht eingerichtet.", {
      status: 503,
      headers,
    });
  if (Number(request.headers.get("content-length") || 0) > 4096)
    return new Response("Request too large", { status: 413, headers });
  let password;
  try {
    const body = await request.text();
    if (body.length > 4096)
      return new Response("Request too large", { status: 413, headers });
    password = new URLSearchParams(body).get("password");
  } catch {
    return new Response("Ungültige Anfrage", { status: 400, headers });
  }
  if (!(await verifyPassword(password, process.env.ROOM_PASSWORD_HASH)))
    return new Response(null, {
      status: 303,
      headers: { ...headers, Location: "/login?error=1" },
    });
  const token = await createSession(secret);
  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      Location: "/",
      "Set-Cookie": cookieHeader(token, url.protocol === "https:"),
    },
  });
}
