import { cookieHeader } from "../../lib/session.mjs";
export default async function logout(request) {
  if (request.method !== "POST")
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin)
    return new Response("Ungültiger Ursprung", { status: 403 });
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Set-Cookie": cookieHeader("", url.protocol === "https:", 0),
      "Cache-Control": "no-store",
    },
  });
}
