import test from "node:test";
import assert from "node:assert/strict";
import { safeId, validateCatalog, settingsFrom } from "../lib/catalog.mjs";
test("categories, whole apartment scenes and IDs are validated", () => {
  assert.equal(safeId("../escape"), false);
  assert.equal(safeId("berlin-wohnzimmer"), true);
  const value = {
    version: 1,
    apartments: [{ id: "berlin", title: "Berlin" }],
    scenes: [
      {
        id: "whole",
        apartmentId: "berlin",
        title: "Ganze Wohnung",
        kind: "apartment",
        date: "2026-10-04",
      },
    ],
  };
  validateCatalog(value);
  assert.throws(() =>
    validateCatalog({
      ...value,
      scenes: [{ ...value.scenes[0], apartmentId: "missing" }],
    }),
  );
  assert.throws(() =>
    validateCatalog({
      ...value,
      scenes: [{ ...value.scenes[0], date: "2026-02-31" }],
    }),
  );
});
test("default camera settings follow the upstream viewer schema", async () => {
  const settings = await settingsFrom();
  assert.equal(settings.version, 2);
  assert.equal(settings.cameras.length, 1);
});
