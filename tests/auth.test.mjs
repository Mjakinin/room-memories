import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  verifySession,
  cookieHeader,
  cookieValue,
} from "../lib/session.mjs";
import { hashPassword, verifyPassword } from "../lib/password.mjs";
import login from "../netlify/functions/login.mjs";
import logout from "../netlify/functions/logout.mjs";
import auth from "../netlify/edge-functions/auth.ts";
const secret = "test-secret-with-at-least-thirty-two-characters";
const now = 1800000000000;
test("sessions reject tampering, expiry, oversized and missing tokens", async () => {
  const token = await createSession(secret, now);
  assert.equal(await verifySession(token, secret, now), true);
  assert.equal(await verifySession(token, secret, now + 86400001), false);
  assert.equal(await verifySession(token + "x", secret, now), false);
  assert.equal(
    await verifySession(token.replace(/^./, "9"), secret, now),
    false,
  );
  assert.equal(await verifySession(token, "different-secret", now), false);
  assert.equal(await verifySession(null, secret, now), false);
  assert.match(
    cookieHeader(token),
    /HttpOnly; SameSite=Strict; Max-Age=86400; Secure/,
  );
  assert.equal(cookieValue(`other=x; room_session=${token}; another=y`), token);
});
test("password hashes and login function protect sessions and request origin", async () => {
  const hash = await hashPassword("correct-test-password");
  assert.equal(await verifyPassword("correct-test-password", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  process.env.ROOM_PASSWORD_HASH = hash;
  process.env.ROOM_SESSION_SECRET = secret;
  const request = (password, origin = "https://rooms.example") =>
    new Request("https://rooms.example/api/login", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ password }),
    });
  assert.equal(
    (await login(request("correct-test-password", "https://attacker.example")))
      .status,
    403,
  );
  assert.equal(
    (await login(request("wrong"))).headers.get("location"),
    "/login?error=1",
  );
  const ok = await login(request("correct-test-password"));
  assert.equal(ok.status, 303);
  assert.match(ok.headers.get("set-cookie"), /HttpOnly.*Secure/);
  const clear = await logout(
    new Request("https://rooms.example/api/logout", {
      method: "POST",
      headers: { Origin: "https://rooms.example" },
    }),
  );
  assert.match(clear.headers.get("set-cookie"), /Max-Age=0/);
  delete process.env.ROOM_PASSWORD_HASH;
  assert.equal((await login(request("correct-test-password"))).status, 503);
});
test("edge gate protects direct model, poster, catalog, origin and preview requests", async () => {
  globalThis.Deno = { env: { get: () => secret } };
  let downstream = 0;
  const context = {
    next: async () => {
      downstream++;
      return new Response("PRIVATE", {
        headers: { "Content-Type": "application/octet-stream" },
      });
    },
  };
  for (const origin of [
    "https://rooms.example",
    "https://project.netlify.app",
    "https://preview--project.netlify.app",
  ]) {
    for (const file of [
      "/media/private/scene.sog",
      "/media/private/poster.png",
      "/catalog.json",
      "/favicon.svg",
      "/assets/viewer.js",
    ]) {
      const response = await auth(new Request(origin + file), context);
      assert.equal(response.status, 401);
      assert.equal(downstream, 0);
    }
    const token = await createSession(secret);
    const response = await auth(
      new Request(origin + "/media/private/scene.sog", {
        headers: { Cookie: cookieHeader(token) },
      }),
      context,
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "PRIVATE");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    downstream = 0;
  }
  globalThis.Deno = { env: { get: () => undefined } };
  assert.equal(
    (await auth(new Request("https://rooms.example/catalog.json"), context))
      .status,
    401,
  );
  assert.equal(downstream, 0);
});
