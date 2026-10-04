import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { projectRoot } from "../lib/catalog.mjs";
test("PLY import converts a web SOG, preserves originals and assigns whole apartments", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "room-import-"));
  const archive = path.join(temporary, "archive");
  const command = (args) =>
    spawnSync(process.execPath, ["scripts/rooms.mjs", ...args], {
      cwd: projectRoot,
      env: { ...process.env, ROOM_ARCHIVE: archive },
      encoding: "utf8",
    });
  try {
    assert.equal(
      command(["apartment", "--id", "berlin", "--title", "Berlin"]).status,
      0,
    );
    let header =
      "ply\nformat binary_little_endian 1.0\ncomment Vertical Axis: z\nelement vertex 64\n";
    for (const field of [
      "x",
      "y",
      "z",
      "nx",
      "ny",
      "nz",
      "f_dc_0",
      "f_dc_1",
      "f_dc_2",
      "opacity",
      "scale_0",
      "scale_1",
      "scale_2",
      "rot_0",
      "rot_1",
      "rot_2",
      "rot_3",
    ])
      header += `property float ${field}\n`;
    header += "end_header\n";
    const data = Buffer.alloc(64 * 17 * 4);
    for (let i = 0; i < 64; i++)
      [
        (i % 4) / 4,
        (Math.floor(i / 4) % 4) / 4,
        Math.floor(i / 16) / 4,
        0,
        0,
        0,
        0.2,
        0.4,
        0.6,
        3,
        -2,
        -2,
        -2,
        1,
        0,
        0,
        0,
      ].forEach((n, j) => data.writeFloatLE(n, (i * 17 + j) * 4));
    const ply = path.join(temporary, "fixture.ply");
    const original = Buffer.concat([Buffer.from(header), data]);
    await fs.writeFile(ply, original);
    const args = [
      "import",
      "--id",
      "whole",
      "--apartment",
      "berlin",
      "--kind",
      "apartment",
      "--title",
      "Ganze Wohnung",
      "--date",
      "2026-10-04",
      "--model",
      ply,
      "--poster",
      path.join(projectRoot, "demo/poster.png"),
    ];
    const imported = command(args);
    assert.equal(imported.status, 0, imported.stderr + imported.stdout);
    assert.deepEqual(
      await fs.readFile(path.join(archive, "scenes/whole/original.ply")),
      original,
    );
    const web = await fs.readFile(path.join(archive, "scenes/whole/scene.sog"));
    assert.equal(web[0], 0x50);
    assert.equal(web[1], 0x4b);
    const catalog = JSON.parse(
      await fs.readFile(path.join(archive, "catalog.json")),
    );
    assert.equal(catalog.scenes[0].kind, "apartment");
    assert.equal(catalog.scenes[0].apartmentId, "berlin");
    assert.notEqual(command(args).status, 0, "Duplikate nicht überschreiben");
    assert.notEqual(
      command(["apartment", "--id", "../escape", "--title", "Bad"]).status,
      0,
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
