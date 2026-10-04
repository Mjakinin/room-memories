import fs from "node:fs/promises";
import { launchBrowser } from "./browser.mjs";
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://127.0.0.1:5173/?debug#room/demo-apartment");
await page.waitForFunction(() => window.roomViewer?.state.loaded, {
  timeout: 120000,
});
await fs.mkdir(".local/demo-frames", { recursive: true });
await page.evaluate(() => {
  window.roomViewer.state.controlsHidden = true;
  document.querySelector(".sse-debug-panel").style.display = "none";
  document
    .querySelectorAll(".sse-info-panel")
    .forEach((e) => (e.style.display = "none"));
});
for (let i = 0; i < 80; i++) {
  const t = i / 79;
  await page.evaluate(
    (t) =>
      window.setCameraState({
        position: [5.6 + 1.2 * t, 1.4, -4],
        angles: [0, -90 + 12 * Math.sin(t * Math.PI), 0],
        distance: 1,
        fov: 72,
        mode: "fly",
      }),
    t,
  );
  await page.waitForTimeout(100);
  await page.screenshot({
    path: `.local/demo-frames/frame-${String(i).padStart(3, "0")}.png`,
  });
}
await browser.close();
console.log("80 echte Viewer-Frames für das Demovideo aufgenommen.");
