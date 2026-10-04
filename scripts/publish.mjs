import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { projectRoot } from "../lib/catalog.mjs";
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      result.error?.message ||
        `${command} fehlgeschlagen: ${result.stderr || result.stdout}`,
    );
  return result.stdout;
}
try {
  const state = JSON.parse(
    await fs.readFile(path.join(projectRoot, ".netlify/state.json"), "utf8"),
  );
  if (!state.siteId)
    throw new Error(
      "Zuerst netlify login und netlify link --id SITE_ID ausführen.",
    );
  const env = await fs.readFile(path.join(projectRoot, ".env"), "utf8");
  if (
    !env.includes("ROOM_PASSWORD_HASH=pbkdf2$") ||
    !/ROOM_SESSION_SECRET=.{32,}/.test(env)
  )
    throw new Error("Zuerst npm run password ausführen.");
  run("npm", ["run", "build"], { stdio: "inherit" });
  // env:import may print secrets. Capture output and never echo it.
  const envResult = spawnSync(
    "netlify",
    ["env:import", ".env", "--site", state.siteId],
    { cwd: projectRoot, encoding: "utf8" },
  );
  if (envResult.error || envResult.status !== 0)
    throw new Error(
      "Netlify-Geheimnisse konnten nicht gesetzt werden. Anmeldung/Zugriff prüfen.",
    );
  console.log("Zugangsdaten für alle Netlify-Kontexte gesetzt.");
  const output = run(
    "netlify",
    [
      "deploy",
      "--prod",
      "--no-build",
      "--dir",
      "dist",
      "--functions",
      "netlify/functions",
      "--site",
      state.siteId,
      "--json",
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  await fs.mkdir(path.join(projectRoot, ".local"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, ".local/last-deploy.json"),
    output,
    { mode: 0o600 },
  );
  console.log("Auf Netlify veröffentlicht. Details: .local/last-deploy.json");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
