import "./style.css";
import type { ViewerHandle } from "@playcanvas/supersplat-viewer/viewer";
type Apartment = { id: string; title: string; description?: string };
type Scene = {
  id: string;
  apartmentId: string;
  title: string;
  date: string;
  description: string;
  kind: "room" | "apartment";
  model: string;
  poster: string;
  settings: string;
  bytes: number;
  demo?: boolean;
  attribution?: { author: string; url: string; license: string };
};
type Catalog = { version: 1; apartments: Apartment[]; scenes: Scene[] };
const root = document.querySelector<HTMLDivElement>("#app")!;
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (name: string) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({ cube: '<path d="m12 3 9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>', arrow: '<path d="M7 17 17 7M7 7h10v10"/>', back: '<path d="m14 7-5 5 5 5"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>', lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>', logout: '<path d="M9 4H4v16h5m5-12 4 4-4 4M9 12h11"/>', play: '<path d="m9 5 11 7-11 7Z"/>' } as Record<string, string>)[name] || ""}</svg>`;
let catalog: Catalog;
let selected = "all";
let query = "";
let sort = "newest";
let viewer: ViewerHandle | undefined;
let openId: string | undefined;
let generation = 0;
const date = (value: string) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "Beispielaufnahme";
const size = (bytes: number) =>
  `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
function gallery() {
  root.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#">${icon("cube")}<span>Room Memories<span class="brand-sub">DEIN RÄUMLICHES ARCHIV</span></span></a><div class="nav-label">SAMMLUNG</div><nav class="category-nav" aria-label="Wohnungen"><button class="nav-item ${selected === "all" ? "active" : ""}" data-category="all">${icon("grid")}<span>Alle Aufnahmen</span><span class="count">${catalog.scenes.length}</span></button>${catalog.apartments.map((a) => `<button class="nav-item ${selected === a.id ? "active" : ""}" data-category="${esc(a.id)}">${icon("home")}<span>${esc(a.title)}</span><span class="count">${catalog.scenes.filter((s) => s.apartmentId === a.id).length}</span></button>`).join("")}</nav><div class="sidebar-bottom"><div class="privacy">${icon("lock")}<div>Dein privates Archiv<span>Nur mit deinem Zugang erreichbar.</span></div></div><form action="/api/logout" method="post"><button class="logout" type="submit">${icon("logout")}Abmelden</button></form></div></aside><main class="main"><header class="topline"><span>Räume, die bleiben.</span><span class="private-badge"><i></i> Privat</span></header><section class="collection-heading"><div class="eyebrow">DEINE SAMMLUNG</div><h1>${esc(selected === "all" ? "Meine Räume" : catalog.apartments.find((a) => a.id === selected)?.title || "Meine Räume")}</h1><p>${esc(selected === "all" ? "Ein vertrauter Ort. Ein Moment. Immer wieder begehbar." : catalog.apartments.find((a) => a.id === selected)?.description || "Deine Aufnahmen an diesem Ort.")}</p></section><div class="toolbar"><label class="search">${icon("search")}<input aria-label="Aufnahmen suchen" placeholder="Aufnahmen suchen …" value="${esc(query)}" type="search"></label><label class="sort-label">Sortieren<select aria-label="Aufnahmen sortieren"><option value="newest" ${sort === "newest" ? "selected" : ""}>Neueste zuerst</option><option value="title" ${sort === "title" ? "selected" : ""}>Name A–Z</option></select></label></div><div class="results-line" aria-live="polite"></div><section class="scene-grid" aria-label="Aufnahmen"></section><footer class="collection-footer">${icon("cube")} Erinnerungen haben einen Ort.</footer></main></div><div id="overlay"></div>`;
  root.querySelectorAll<HTMLButtonElement>("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.category!;
        query = "";
        gallery();
      }),
  );
  root.querySelector<HTMLInputElement>(".search input")!.oninput = (event) => {
    query = (event.target as HTMLInputElement).value;
    cards();
  };
  root.querySelector<HTMLSelectElement>("select")!.onchange = (event) => {
    sort = (event.target as HTMLSelectElement).value;
    cards();
  };
  cards();
}
function cards() {
  const scenes = catalog.scenes
    .filter(
      (s) =>
        (selected === "all" || s.apartmentId === selected) &&
        `${s.title} ${s.description} ${catalog.apartments.find((a) => a.id === s.apartmentId)?.title}`
          .toLocaleLowerCase("de")
          .includes(query.toLocaleLowerCase("de")),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "de")
        : b.date.localeCompare(a.date),
    );
  root.querySelector(".results-line")!.textContent =
    `${scenes.length} ${scenes.length === 1 ? "Aufnahme" : "Aufnahmen"}`;
  root.querySelector(".scene-grid")!.innerHTML = scenes.length
    ? scenes
        .map(
          (s) =>
            `<button class="scene-card" data-scene="${esc(s.id)}" aria-label="${esc(s.title)} in 3D öffnen"><div class="scene-image"><img src="${esc(s.poster)}" alt="Vorschau: ${esc(s.title)}" loading="lazy"><span class="scene-tag">${s.demo ? "DEMO" : s.kind === "apartment" ? "GANZE WOHNUNG" : "ZIMMER"}</span><span class="open-scene">${icon("arrow")}</span><span class="image-caption">${icon("play")} In 3D erkunden</span></div><div class="card-info"><div class="card-location">${esc(catalog.apartments.find((a) => a.id === s.apartmentId)?.title || "")}</div><h2>${esc(s.title)}</h2><p>${esc(s.description)}</p><div class="card-meta"><span>${date(s.date)}</span><span>3D · ${size(s.bytes)}</span></div></div></button>`,
        )
        .join("")
    : `<div class="empty">${icon("search")}<h2>Hier ist es noch still.</h2><p>${query ? "Für diese Suche gibt es keine Aufnahme." : "Deine erste Aufnahme wartet auf ihren Platz."}</p></div>`;
  root.querySelectorAll<HTMLButtonElement>("[data-scene]").forEach(
    (b) =>
      (b.onclick = () => {
        location.hash = `room/${b.dataset.scene}`;
      }),
  );
}
async function route() {
  const id = location.hash.startsWith("#room/")
    ? decodeURIComponent(location.hash.slice(6))
    : undefined;
  if (openId === id) return;
  generation++;
  const current = generation;
  viewer?.destroy();
  viewer = undefined;
  Object.assign(window, { roomViewer: undefined });
  openId = undefined;
  document.body.classList.remove("viewer-open");
  root.querySelector("#overlay")!.innerHTML = "";
  if (!id) return;
  const scene = catalog.scenes.find((s) => s.id === id);
  if (!scene) {
    location.hash = "";
    return;
  }
  openId = id;
  document.body.classList.add("viewer-open");
  root.querySelector("#overlay")!.innerHTML =
    `<section class="viewer-dialog" role="dialog" aria-modal="true" aria-label="${esc(scene.title)}"><header class="viewer-top"><button class="text-button close-viewer" aria-label="Zur Galerie">${icon("back")}<span>Sammlung</span></button><div class="viewer-title"><span>${esc(catalog.apartments.find((a) => a.id === scene.apartmentId)?.title || "")}</span><h2>${esc(scene.title)}</h2></div><button class="icon-button close-viewer" aria-label="Viewer schließen">${icon("close")}</button></header><div id="splat-viewer"><div class="loading-message"><span class="spinner"></span>Dein Raum wird geöffnet …</div></div><footer class="viewer-bottom"><div><span class="viewer-date">${date(scene.date)}</span><p>${esc(scene.description)}</p>${scene.attribution ? `<span class="attribution">Demo: <a href="${esc(scene.attribution.url)}" target="_blank" rel="noopener">${esc(scene.attribution.author)}</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">${esc(scene.attribution.license)}</a></span>` : ""}</div><div class="viewer-actions"><button class="text-button" id="reset-view" disabled>${icon("reset")}<span>Startansicht</span></button><button class="icon-button" id="fullscreen" aria-label="Vollbild">${icon("expand")}</button></div></footer></section>`;
  root.querySelectorAll<HTMLButtonElement>(".close-viewer").forEach(
    (b) =>
      (b.onclick = () => {
        location.hash = "";
      }),
  );
  root.querySelector<HTMLButtonElement>(".close-viewer")!.focus();
  try {
    const [{ createViewer }] = await Promise.all([
      import("@playcanvas/supersplat-viewer/viewer"),
      import("@playcanvas/supersplat-viewer/viewer.css"),
    ]);
    if (generation !== current) return;
    const container = root.querySelector<HTMLElement>("#splat-viewer")!;
    container.innerHTML = "";
    const handle = await createViewer({
      container,
      settings: scene.settings,
      contentUrl: scene.model,
      posterUrl: scene.poster,
      ui: true,
      renderer: "webgl",
      lang: "de",
      noanim: true,
      exposeGlobals: import.meta.env.DEV,
      debug:
        import.meta.env.DEV &&
        new URLSearchParams(location.search).has("debug"),
    });
    if (generation !== current) {
      handle.destroy();
      return;
    }
    viewer = handle;
    Object.assign(window, { roomViewer: handle });
    const reset = root.querySelector<HTMLButtonElement>("#reset-view")!;
    reset.setAttribute("aria-label", "Startansicht");
    const ready = () => {
      reset.disabled = false;
      handle.state.cameraMode = "fly";
    };
    if (handle.state.loaded) ready();
    else handle.events.on("loaded:changed", ready);
    reset.onclick = () => handle.resetCamera();
    root.querySelector<HTMLButtonElement>("#fullscreen")!.onclick = () =>
      handle.requestFullscreen();
  } catch (error) {
    if (generation !== current) return;
    console.error(error);
    root.querySelector("#splat-viewer")!.innerHTML =
      '<div class="viewer-error"><h2>Der Raum konnte nicht geladen werden.</h2><p>Prüfe die Verbindung und ob dein Browser WebGL unterstützt.</p><button class="primary-button" id="retry">Erneut versuchen</button></div>';
    root.querySelector<HTMLButtonElement>("#retry")!.onclick = () => {
      openId = undefined;
      void route();
    };
  }
}
window.addEventListener("hashchange", () => void route());
window.addEventListener("keydown", (event) => {
  if (document.fullscreenElement) return;
  if (event.key === "Escape" && openId) location.hash = "";
});
document.addEventListener("focusin", (event) => {
  if (!openId) return;
  const dialog = root.querySelector(".viewer-dialog");
  if (dialog && !dialog.contains(event.target as Node))
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
});
async function init() {
  try {
    const response = await fetch("/catalog.json", { cache: "no-store" });
    if (response.status === 401) {
      location.href = "/login";
      return;
    }
    if (!response.ok) throw new Error(`Catalog: ${response.status}`);
    catalog = await response.json();
    gallery();
    await route();
  } catch (error) {
    console.error(error);
    root.innerHTML =
      '<main class="fatal"><h1>Das Archiv ist gerade nicht erreichbar.</h1><p>Bitte versuch es gleich noch einmal.</p><button class="primary-button" id="reload">Neu laden</button></main>';
    root.querySelector<HTMLButtonElement>("#reload")!.onclick = () =>
      location.reload();
  }
}
void init();
