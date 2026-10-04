import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { devices } from "@playwright/test";
import { launchBrowser } from "./browser.mjs";
const base = process.env.ROOM_BROWSER_URL || "http://127.0.0.1:5173";
const browser = await launchBrowser();
const access = base.includes("127.0.0.1:5173")
  ? null
  : (await fs.readFile(".local/access.txt", "utf8")).match(
      /^Passwort: (.+)$/m,
    )[1];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(
      mobile
        ? { ...devices["Pixel 7"] }
        : { viewport: { width: 1440, height: 900 } },
    );
    const page = await context.newPage();
    const errors = [];
    const resources = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => resources.push(r.url()));
    await page.goto(base);
    if (access) {
      await page.getByLabel("Dein Zugangspasswort").fill(access);
      await page.getByRole("button", { name: "Archiv öffnen" }).click();
    }
    await page.getByRole("heading", { name: "Meine Räume" }).waitFor();
    assert.equal(
      resources.some((url) => url.endsWith(".sog")),
      false,
      "Kein Modell vor dem Öffnen laden",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Kein horizontaler Überlauf",
    );
    await page.getByLabel("Aufnahmen suchen").fill("findet-keinen-raum");
    await page
      .getByRole("heading", { name: "Hier ist es noch still." })
      .waitFor();
    await page.getByLabel("Aufnahmen suchen").fill("");
    await page.getByRole("button", { name: /Beispielwohnung/ }).click();
    await page
      .getByRole("heading", { name: "Beispielwohnung", exact: true })
      .waitFor();
    await page.locator(".scene-image img").evaluate((img) => img.decode());
    await page.screenshot({
      path: `.local/gallery-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Ein Blick in die Wohnung in 3D öffnen" })
      .click();
    await page.waitForFunction(() => window.roomViewer?.state.loaded, {
      timeout: 120000,
    });
    await page
      .getByRole("button", { name: "Startansicht", exact: true })
      .click();
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: 140, y: 330 },
          { x: 230, y: 330 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: 110, y: 320 },
          { x: 270, y: 340 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.mouse.move(550, 350);
      await page.mouse.down();
      await page.mouse.move(620, 370, { steps: 5 });
      await page.mouse.up();
      await page.mouse.wheel(0, -60);
      await page.getByRole("button", { name: "Vollbild", exact: true }).click();
      await page.waitForFunction(() => Boolean(document.fullscreenElement));
      await page.evaluate(() => document.exitFullscreen());
    }
    await page.screenshot({
      path: `.local/viewer-${mobile ? "mobile" : "desktop"}.png`,
    });
    await page.getByRole("button", { name: "Viewer schließen" }).click();
    await page.locator(".viewer-dialog").waitFor({ state: "detached" });
    assert.equal(await page.locator(".viewer-dialog").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      `Browser geprüft: ${mobile ? "Handy (emuliert, Touch/Pinch)" : "Desktop (Maus, Zoom, Vollbild)"} · Suche, Kategorie, Lazy Loading, Startansicht, Öffnen/Schließen.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
