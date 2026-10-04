import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { projectRoot } from "../lib/catalog.mjs";
const deployment = JSON.parse(
  await fs.readFile(path.join(projectRoot, ".local/last-deploy.json"), "utf8"),
);
const access = await fs.readFile(
  path.join(projectRoot, ".local/access.txt"),
  "utf8",
);
const password = access.match(/^Passwort: (.+)$/m)[1];
const hosts = [
  process.env.ROOM_SITE_URL || deployment.url,
  deployment.deploy_url,
];
const deployHost = new URL(deployment.deploy_url).hostname;
hosts.push("https://" + deployHost.slice(deployHost.indexOf("--") + 2));
for (const base of [...new Set(hosts)]) {
  for (const route of [
    "/catalog.json",
    "/media/demo-apartment/apartment.sog",
    "/media/demo-apartment/poster.png",
    "/media/demo-apartment/settings.json",
    "/.netlify/images?url=/media/demo-apartment/poster.png&w=100",
  ]) {
    const response = await fetch(base + route, { redirect: "manual" });
    assert.equal(response.status, 401, `${base}${route} muss gesperrt sein`);
    assert.match(response.headers.get("cache-control"), /no-store/);
    await response.body?.cancel();
  }
  const result = await fetch(base + "/api/login", {
    method: "POST",
    redirect: "manual",
    headers: {
      Origin: new URL(base).origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ password }),
  });
  assert.equal(result.status, 303, "Login muss erfolgreich sein");
  const cookie = result.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly.*SameSite=Strict.*Secure/);
  const authenticated = await fetch(base + "/catalog.json", {
    headers: { Cookie: cookie.split(";")[0] },
  });
  assert.equal(authenticated.status, 200);
  const catalog = await authenticated.json();
  assert.ok(catalog.scenes.length);
  const model = await fetch(base + catalog.scenes[0].model, {
    headers: { Cookie: cookie.split(";")[0], Range: "bytes=0-31" },
  });
  assert.ok([200, 206].includes(model.status));
  const bytes = new Uint8Array(await model.arrayBuffer());
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const expired = await fetch(base + "/catalog.json", {
    headers: { Cookie: "room_session=invalid" },
  });
  assert.equal(expired.status, 401);
  console.log(
    `Live geprüft: ${base} · Zugang, Download-Sperre, Sitzungs-Cookie, privater Modellabruf.`,
  );
}
