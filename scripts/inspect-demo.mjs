import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
await page.goto("http://127.0.0.1:5173/?debug#room/demo-apartment");
await page.waitForFunction(() => window.roomViewer?.state.loaded, {
  timeout: 120000,
});
const poses = [
  { position: [4.3, 1.3, -4.8], angles: [0, -90, 0] },
  { position: [4.3, 1.3, -4.8], angles: [0, 0, 0] },
  { position: [4.3, 1.3, -4.8], angles: [0, 90, 0] },
  { position: [2.5, 1.3, -3.5], angles: [0, -90, 0] },
  { position: [8, 1.3, -4.8], angles: [0, -90, 0] },
];
for (const [i, pose] of poses.entries()) {
  await page.evaluate((p) => {
    window.setCameraState({ ...p, distance: 1, fov: 70, mode: "fly" });
    document.querySelector(".sse-debug-panel").style.display = "none";
  }, pose);
  await page.waitForTimeout(1600);
  await page
    .locator("#splat-viewer canvas")
    .screenshot({ path: `.local/camera-${i}.png` });
}
await browser.close();
