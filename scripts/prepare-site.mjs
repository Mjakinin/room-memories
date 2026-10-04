import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  archiveRoot,
  projectRoot,
  readCatalog,
  settingsFrom,
} from "../lib/catalog.mjs";
export async function prepareSite() {
  const demo = JSON.parse(
    await fs.readFile(path.join(projectRoot, "demo/catalog.json"), "utf8"),
  );
  const privateCatalog = await readCatalog();
  const catalog = {
    version: 1,
    apartments: [...demo.apartments, ...privateCatalog.apartments],
    scenes: [],
  };
  const media = path.join(projectRoot, "public/media");
  await fs.rm(media, { recursive: true, force: true });
  await fs.mkdir(media, { recursive: true });
  for (const scene of [...demo.scenes, ...privateCatalog.scenes]) {
    const source = scene.demo
      ? path.join(projectRoot, "demo")
      : path.join(archiveRoot, "scenes", scene.id);
    const target = path.join(media, scene.id);
    await fs.mkdir(target);
    for (const file of [scene.model, scene.poster, scene.settings]) {
      if (file !== path.basename(file))
        throw new Error("Ungültiger Dateiname.");
      await fs.copyFile(path.join(source, file), path.join(target, file));
    }
    catalog.scenes.push({
      ...scene,
      model: `/media/${scene.id}/${scene.model}`,
      poster: `/media/${scene.id}/${scene.poster}`,
      settings: `/media/${scene.id}/${scene.settings}`,
      bytes: (await fs.stat(path.join(source, scene.model))).size,
    });
  }
  await fs.writeFile(
    path.join(projectRoot, "public/catalog.json"),
    JSON.stringify(catalog),
  );
  console.log(
    `Website vorbereitet: ${catalog.scenes.length} Aufnahme(n). Private Dateien sind von Git ausgeschlossen.`,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await prepareSite();
