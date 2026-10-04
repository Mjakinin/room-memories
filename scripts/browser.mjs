import { chromium } from "@playwright/test";
export async function launchBrowser() {
  const hardware =
    process.env.ROOM_GPU === "hardware" ||
    (process.env.DISPLAY && process.env.ROOM_GPU !== "software");
  return chromium.launch({
    args: hardware
      ? [
          "--use-gl=angle",
          "--use-angle=gl",
          "--enable-gpu",
          "--ignore-gpu-blocklist",
        ]
      : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
}
