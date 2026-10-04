import { cookieValue, verifySession } from "../../lib/session.mjs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};
export default async function auth(
  request: Request,
  context: { next: () => Promise<Response> },
) {
  const url = new URL(request.url);
  if (
    [
      "/api/login",
      "/api/logout",
      "/.netlify/functions/login",
      "/.netlify/functions/logout",
    ].includes(url.pathname)
  )
    return context.next();
  const secret = Deno.env.get("ROOM_SESSION_SECRET");
  const valid = await verifySession(
    cookieValue(request.headers.get("cookie")),
    secret,
  );
  if (url.pathname === "/login") {
    if (valid)
      return new Response(null, {
        status: 303,
        headers: { ...headers, Location: "/" },
      });
    return new Response(loginPage(url.searchParams.has("error")), {
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      },
    });
  }
  if (!valid) {
    const page =
      url.pathname === "/" ||
      request.headers.get("accept")?.includes("text/html");
    return page
      ? new Response(null, {
          status: 303,
          headers: { ...headers, Location: "/login" },
        })
      : new Response("Anmeldung erforderlich.", { status: 401, headers });
  }
  const response = await context.next();
  const secured = new Response(response.body, response);
  Object.entries(headers).forEach(([key, value]) =>
    secured.headers.set(key, value),
  );
  secured.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  return secured;
}
function loginPage(error: boolean) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Room Memories · Anmelden</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#101318;color:#edf2f7;font:16px/1.6 system-ui,sans-serif;padding:24px}main{width:min(100%,440px)}.mark{color:#99bafb;font-size:34px;margin-bottom:26px}.eyebrow{font-size:12px;letter-spacing:2px;color:#99bafb;text-transform:uppercase}h1{font-size:40px;line-height:1.15;margin:12px 0 18px;letter-spacing:-1.5px}p{color:#9ba6b5}label{display:block;margin:28px 0 8px;font-size:14px}input,button{width:100%;border-radius:10px;font:inherit;padding:13px 16px}input{background:#1b212b;border:1px solid #394352;color:white}input:focus{outline:2px solid #99bafb;outline-offset:2px}button{margin-top:16px;background:#acc7ff;border:0;color:#0b1930;font-weight:650;cursor:pointer}small{display:block;margin-top:26px;color:#818d9e;font-size:13px}.error{color:#ffc6bb}footer{margin-top:60px;color:#657287;font-size:12px}</style></head><body><main><div class="mark" aria-hidden="true">◇</div><div class="eyebrow">Room Memories</div><h1>Räume bleiben.</h1><p>Dein privates Archiv. Ein Ort für Räume,<br>an die du dich erinnern möchtest.</p><form method="post" action="/api/login"><label for="password">Dein Zugangspasswort</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus>${error ? '<p class="error" role="alert">Das Passwort stimmt nicht. Versuch es erneut.</p>' : ""}<button type="submit">Archiv öffnen <span aria-hidden="true">↗</span></button></form><small>Die Sitzung endet nach 24 Stunden.</small><footer>ROOM MEMORIES · PRIVATE COLLECTION</footer></main></body></html>`;
}
