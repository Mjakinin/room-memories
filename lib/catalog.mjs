import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultSettings,
  validateSettings,
  importSettings,
} from "@playcanvas/supersplat-viewer/settings";
export const projectRoot = path.resolve(import.meta.dirname, "..");
export const archiveRoot = path.resolve(
  process.env.ROOM_ARCHIVE || path.join(projectRoot, "private", "archive"),
);
export const emptyCatalog = () => ({ version: 1, apartments: [], scenes: [] });
export const safeId = (id) =>
  typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
export async function readCatalog(root = archiveRoot) {
  try {
    const value = JSON.parse(
      await fs.readFile(path.join(root, "catalog.json"), "utf8"),
    );
    validateCatalog(value);
    return value;
  } catch (error) {
    if (error.code === "ENOENT") return emptyCatalog();
    throw error;
  }
}
export function validateCatalog(value) {
  if (
    value.version !== 1 ||
    !Array.isArray(value.apartments) ||
    !Array.isArray(value.scenes)
  )
    throw new Error("Ungültiger Katalog.");
  const apartments = new Set();
  const scenes = new Set();
  for (const a of value.apartments) {
    if (
      !safeId(a.id) ||
      apartments.has(a.id) ||
      !a.title ||
      typeof a.title !== "string"
    )
      throw new Error("Ungültige Wohnung.");
    apartments.add(a.id);
  }
  for (const s of value.scenes) {
    if (
      !safeId(s.id) ||
      scenes.has(s.id) ||
      !apartments.has(s.apartmentId) ||
      !s.title ||
      !["room", "apartment"].includes(s.kind)
    )
      throw new Error("Ungültige Aufnahme.");
    if (
      s.date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) ||
        new Date(`${s.date}T12:00:00Z`).toISOString().slice(0, 10) !== s.date)
    )
      throw new Error("Ungültiges Datum: YYYY-MM-DD verwenden.");
    scenes.add(s.id);
  }
}
export async function writeCatalog(catalog, root = archiveRoot) {
  validateCatalog(catalog);
  await fs.mkdir(root, { recursive: true });
  const target = path.join(root, "catalog.json");
  await fs.writeFile(`${target}.tmp`, JSON.stringify(catalog, null, 2) + "\n", {
    mode: 0o600,
  });
  await fs.rename(`${target}.tmp`, target);
}
export async function settingsFrom(file) {
  const settings = file
    ? importSettings(JSON.parse(await fs.readFile(file, "utf8")))
    : defaultSettings("environment");
  validateSettings(settings, { limits: true });
  // Viewer assets must remain on the protected origin, with no remote tracking/resources.
  if (settings.soundUrl || settings.background.skyboxUrl)
    throw new Error("Externe Medien in Einstellungen sind nicht erlaubt.");
  return settings;
}
