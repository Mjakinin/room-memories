import fs from "node:fs/promises";
import path from "node:path";
import { launchBrowser } from "./browser.mjs";
import { projectRoot } from "../lib/catalog.mjs";
const browser = await launchBrowser();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.error("Browser:", error.message));
await page.goto(
  process.env.ROOM_CAPTURE_URL ||
    "http://127.0.0.1:5173/?debug#room/demo-apartment",
);
await page.waitForFunction(() => window.roomViewer?.state.loaded, {
  timeout: 120000,
});
if (process.argv.includes("--frame")) {
  await page.evaluate(() => window.roomViewer.frameScene());
}
await page.waitForTimeout(1500);
console.log(
  JSON.stringify(
    await page.evaluate(() => ({
      camera: window.getCameraState?.(),
      entities: window.roomViewer.app.root
        .findComponents("camera")
        .map((c) => ({
          name: c.entity.name,
          position: c.entity.getPosition().toArray(),
        })),
      bounds: window.roomViewer.app.root.findComponents("gsplat").map((g) => ({
        center: g.customAabb?.center?.toArray(),
        half: g.customAabb?.halfExtents?.toArray(),
        aabb: g.instance?.meshInstance?.aabb?.center.toArray(),
        size: g.instance?.meshInstance?.aabb?.halfExtents.toArray(),
      })),
    })),
  ),
);
const capture = await page.evaluate(async () => {
  const result = await window.roomViewer.captureFrame({
    width: 1280,
    height: 800,
  });
  const bytes = Uint8ClampedArray.from(atob(result.data), (c) =>
    c.charCodeAt(0),
  );
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  canvas
    .getContext("2d")
    .putImageData(new ImageData(bytes, result.width, result.height), 0, 0);
  return canvas.toDataURL("image/png");
});
const raw = capture.replace(/^data:image\/\w+;base64,/, "");
await fs.writeFile(
  path.join(projectRoot, "demo/poster.png"),
  Buffer.from(raw, "base64"),
);
await page.screenshot({ path: path.join(projectRoot, ".local/viewer.png") });
await page.goto("http://127.0.0.1:5173/");
await page.screenshot({ path: path.join(projectRoot, ".local/gallery.png") });
console.log(
  "Echte Demoaufnahme gerendert; Vorschaubild und QA-Screenshots gespeichert.",
);
await browser.close();
