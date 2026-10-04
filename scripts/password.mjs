import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/password.mjs";
import { projectRoot } from "../lib/catalog.mjs";
const local = path.join(projectRoot, ".local");
await fs.mkdir(local, { recursive: true, mode: 0o700 });
const envFile = path.join(projectRoot, ".env");
if (!process.argv.includes("--rotate")) {
  try {
    await fs.access(envFile);
    throw new Error(
      "Zugang ist schon eingerichtet. Zum Wechseln: npm run password -- --rotate",
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const password = randomBytes(18).toString("base64url");
const secret = randomBytes(48).toString("base64url");
await fs.writeFile(
  envFile,
  `ROOM_PASSWORD_HASH=${await hashPassword(password)}\nROOM_SESSION_SECRET=${secret}\n`,
  { mode: 0o600 },
);
await fs.writeFile(
  path.join(local, "access.txt"),
  `Room Memories\nPasswort: ${password}\n\nPrivat aufbewahren; diese Datei wird nicht in Git gespeichert.\nNach einem Passwortwechsel npm run publish ausführen.\n`,
  { mode: 0o600 },
);
console.log(
  "Zugang eingerichtet. Dein Passwort steht in .local/access.txt. Geheimnisse sind von Git ausgeschlossen.",
);
