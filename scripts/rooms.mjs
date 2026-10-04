import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import {
  archiveRoot,
  projectRoot,
  safeId,
  readCatalog,
  writeCatalog,
  settingsFrom,
} from "../lib/catalog.mjs";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries(
    [
      "id",
      "title",
      "description",
      "apartment",
      "kind",
      "date",
      "model",
      "poster",
      "settings",
      "video",
    ].map((k) => [k, { type: "string" }]),
  ),
});
const [command] = positionals;
function need(key) {
  if (!values[key]) throw new Error(`--${key} fehlt.`);
  return values[key];
}
async function main() {
  const catalog = await readCatalog();
  if (command === "list") {
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }
  if (command === "apartment") {
    const id = need("id");
    if (!safeId(id))
      throw new Error(
        "ID: Kleinbuchstaben, Ziffern und Bindestriche verwenden.",
      );
    if (id === "demo-apartment")
      throw new Error("Diese ID ist für die Demo reserviert.");
    const old = catalog.apartments.find((a) => a.id === id);
    const apartment = {
      id,
      title: need("title"),
      description: values.description || "",
    };
    if (old) Object.assign(old, apartment);
    else catalog.apartments.push(apartment);
    await writeCatalog(catalog);
    console.log(`Wohnung gespeichert: ${apartment.title}`);
    return;
  }
  if (command === "view") {
    const scene = catalog.scenes.find((s) => s.id === need("id"));
    if (!scene) throw new Error("Aufnahme nicht gefunden.");
    const settings = await settingsFrom(need("settings"));
    await fs.writeFile(
      path.join(archiveRoot, "scenes", scene.id, "settings.json"),
      JSON.stringify(settings, null, 2),
    );
    console.log(
      "Startansicht gespeichert. Mit npm run publish veröffentlichen.",
    );
    return;
  }
  if (command !== "import")
    throw new Error(
      "Befehle: apartment, import, view, list. Beispiele im README.",
    );
  const id = need("id");
  if (!safeId(id) || id === "demo-apartment")
    throw new Error("Ungültige oder reservierte ID.");
  if (catalog.scenes.some((s) => s.id === id))
    throw new Error(
      "ID existiert bereits. Für eine neue Aufnahme eine neue ID verwenden.",
    );
  const apartmentId = need("apartment");
  if (!catalog.apartments.some((a) => a.id === apartmentId))
    throw new Error("Wohnung zuerst mit rooms apartment anlegen.");
  const model = path.resolve(need("model"));
  const extension = path.extname(model).toLowerCase();
  if (![".ply", ".sog"].includes(extension))
    throw new Error(
      "Modell muss eine Gaussian-Splat PLY oder gebündelte SOG sein.",
    );
  const poster = path.resolve(need("poster"));
  const posterExtension = path.extname(poster).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(posterExtension))
    throw new Error("Vorschaubild: JPG, PNG oder WebP.");
  const header = await fs.open(model);
  const peek = Buffer.alloc(8192);
  await header.read(peek, 0, peek.length, 0);
  await header.close();
  if (
    extension === ".ply" &&
    ((!peek.toString().startsWith("ply\n") &&
      !peek.toString().startsWith("ply\r\n")) ||
      !peek.toString().includes("scale_0") ||
      !peek.toString().includes("f_dc_0"))
  )
    throw new Error("PLY enthält keine erwarteten Gaussian-Splat-Attribute.");
  if (extension === ".sog" && (peek[0] !== 0x50 || peek[1] !== 0x4b))
    throw new Error("SOG muss eine gebündelte ZIP-Datei sein.");
  const scene = {
    id,
    apartmentId,
    title: need("title"),
    description: values.description || "",
    date: need("date"),
    kind: values.kind || "room",
    model: "scene.sog",
    poster: `poster${posterExtension}`,
    settings: "settings.json",
  };
  const settings = await settingsFrom(values.settings);
  // Validate metadata before writing model files.
  const nextCatalog = structuredClone(catalog);
  nextCatalog.scenes.push(scene);
  const { validateCatalog } = await import("../lib/catalog.mjs");
  validateCatalog(nextCatalog);
  const target = path.join(archiveRoot, "scenes", id);
  const staging = `${target}.importing`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.mkdir(staging);
  } catch {
    throw new Error(
      "Ein Import oder verwaiste Aufnahme existiert bereits. Bitte prüfen.",
    );
  }
  try {
    await fs.copyFile(model, path.join(staging, `original${extension}`));
    if (extension === ".sog")
      await fs.copyFile(model, path.join(staging, "scene.sog"));
    else {
      const cli = path.join(projectRoot, "node_modules/.bin/splat-transform");
      const conversion = ["--gpu", "cpu", model];
      // Nerfstudio declares Z-up explicitly. Preserve the original, normalize only the web copy.
      if (peek.toString().includes("comment Vertical Axis: z"))
        conversion.push("--rotate", "90,0,0");
      conversion.push(path.join(staging, "scene.sog"));
      const converted = spawnSync(cli, conversion, { stdio: "inherit" });
      if (converted.status !== 0)
        throw new Error(
          "SOG-Konvertierung fehlgeschlagen; Original bleibt unverändert.",
        );
    }
    await fs.copyFile(poster, path.join(staging, scene.poster));
    await fs.writeFile(
      path.join(staging, "settings.json"),
      JSON.stringify(settings, null, 2),
    );
    if (values.video)
      await fs.copyFile(
        path.resolve(values.video),
        path.join(staging, `video${path.extname(values.video)}`),
      );
    await fs.writeFile(
      path.join(staging, "metadata.json"),
      JSON.stringify(scene, null, 2),
    );
    await fs.rename(staging, target);
    await writeCatalog(nextCatalog);
    console.log(`Importiert: ${scene.title}. Original + Webfassung: ${target}`);
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    throw error;
  }
}
try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
