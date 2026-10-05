"use strict";

// The site is one page with two faces, Home and the Item Wiki, drawn from items.json: what the
// server knows of its items, with everything nobody has found yet left as a blank.

const KIND_ORDER = ["Weapon", "Tool", "Armor", "Accessory", "Mod", "Material", "Mutation"];
const KIND_PLURAL = { Weapon: "Weapons", Tool: "Tools", Armor: "Armor", Accessory: "Accessories", Mod: "Mods", Material: "Materials", Mutation: "Mutations" };
const VANILLA_VERSIONS = ["1.21.8", "1.21.4"];
const REFRESH_MS = 60000;
const FRAME_MS = 150;

let data = { items: [], rarities: [] };
let rarityColor = {};
let kind = "All";
let animated = [];

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---- Pictures ----

/** Where the game's own picture of an ordinary item may be found, most likely first. */
function vanillaSources(name) {
  const versions = [data.version, ...VANILLA_VERSIONS].filter(Boolean);
  const sources = [];
  for (const folder of ["item", "block"]) {
    for (const version of versions) {
      sources.push(`https://assets.mcasset.cloud/${version}/assets/minecraft/textures/${folder}/${name}.png`);
    }
  }
  return sources;
}

/** An item's picture: its own from the server, or the ordinary item's it looks like, or failing both its first letter. */
function icon(item, large) {
  const box = el("div", large ? "icon icon-large" : "icon");
  if (item.hidden) {
    box.append(el("span", "unknown", "?"));
    return box;
  }
  const letter = () => {
    box.replaceChildren(el("span", "letter", (item.name || "?").trim().charAt(0).toUpperCase()));
  };
  if (item.texture) {
    const img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", letter);
    img.addEventListener("load", () => {
      // A picture taller than it is wide is a strip of frames, one above another: it is played through.
      const frames = Math.round(img.naturalHeight / img.naturalWidth);
      if (frames > 1) animated.push({ img, frames, at: 0 });
    });
    img.src = item.texture;
    box.append(img);
    return box;
  }
  const sources = vanillaSources(item.vanilla || "barrier");
  if (item.tint) {
    // Dyed leather: the grey picture, multiplied by the dye, cut to its own outline.
    const probe = new Image();
    let at = 0;
    probe.addEventListener("error", () => { at += 1; if (at < sources.length) probe.src = sources[at]; else letter(); });
    probe.addEventListener("load", () => {
      const tinted = el("div", "tinted");
      const url = `url("${probe.src}")`;
      tinted.style.backgroundImage = `linear-gradient(${item.tint}, ${item.tint}), ${url}`;
      tinted.style.webkitMaskImage = url;
      tinted.style.maskImage = url;
      box.replaceChildren(tinted);
    });
    probe.src = sources[0];
    return box;
  }
  const img = el("img");
  img.alt = "";
  img.loading = "lazy";
  let at = 0;
  img.addEventListener("error", () => { at += 1; if (at < sources.length) img.src = sources[at]; else letter(); });
  img.src = sources[0];
  box.append(img);
  return box;
}

setInterval(() => {
  animated = animated.filter((entry) => entry.img.isConnected);
  for (const entry of animated) {
    entry.at = (entry.at + 1) % entry.frames;
    entry.img.style.objectPosition = `0 ${entry.frames === 1 ? 0 : (entry.at / (entry.frames - 1)) * 100}%`;
  }
}, FRAME_MS);

// ---- Words ----

/** A line of the game's tooltip: pieces of text, each in its own colour and weight. */
function line(pieces) {
  const row = el("div");
  for (const piece of Array.isArray(pieces) ? pieces : pieces ? [pieces] : []) {
    if (piece.i) {
      // One of the game's own symbols: its white picture, shown in the colour the game writes it in.
      const symbol = el("span", "glyph");
      const picture = `url("textures/${piece.i}.png")`;
      symbol.style.webkitMaskImage = picture;
      symbol.style.maskImage = picture;
      if (piece.c) symbol.style.color = piece.c;
      symbol.setAttribute("aria-hidden", "true");
      row.append(symbol);
      continue;
    }
    let node = el(piece.b ? "b" : "span", null, piece.t);
    if (piece.c) node.style.color = piece.c;
    if (piece.s) {
      const struck = el("s");
      struck.append(node);
      if (piece.c) struck.style.color = piece.c;
      node = struck;
    }
    row.append(node);
  }
  return row;
}

function when(millis) {
  if (!millis) return "";
  return new Date(millis).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---- An item, opened ----

function open(item) {
  const color = rarityColor[item.rarity] || "";
  const card = document.querySelector(".sheet-card");
  card.style.setProperty("--rarity", color || "var(--line)");
  $("sheet-icon").replaceWith(Object.assign(icon(item, true), { id: "sheet-icon" }));
  $("sheet-name").textContent = item.name;
  const rarity = (data.rarities.find((each) => each.id === item.rarity) || {}).name;
  $("sheet-kind").textContent = [rarity, item.kind].filter(Boolean).join(" ");
  const lore = $("sheet-lore");
  lore.replaceChildren(line(item.title && item.title.length ? item.title : [{ t: item.name, c: color, b: true }]));
  for (const pieces of item.lore || []) lore.append(line(pieces));
  const ways = $("sheet-ways");
  ways.replaceChildren();
  for (const way of item.obtain || []) ways.append(el("li", null, way));
  $("sheet-how").hidden = !(item.obtain && item.obtain.length);
  const found = $("sheet-found");
  found.replaceChildren("First found by ", el("strong", null, item.foundBy || "someone"));
  if (item.foundAt) found.append(` on ${when(item.foundAt)}`);
  $("sheet").hidden = false;
  document.querySelector(".sheet-close").focus();
}

function close() {
  $("sheet").hidden = true;
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-close]")) close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") close();
});

// ---- The wiki ----

function card(item) {
  if (item.hidden) {
    const blank = el("div", "card hidden");
    blank.append(icon(item), el("div", "card-name", "???"), el("div", "card-kind", item.kind));
    return blank;
  }
  const button = el("button", "card");
  button.type = "button";
  button.style.setProperty("--rarity", rarityColor[item.rarity] || "var(--text)");
  button.append(icon(item), el("div", "card-name", item.name), el("div", "card-kind", item.kind));
  button.addEventListener("click", () => open(item));
  return button;
}

function drawKinds() {
  const counts = {};
  for (const item of data.items) counts[item.kind] = (counts[item.kind] || 0) + 1;
  const kinds = ["All", ...KIND_ORDER.filter((each) => counts[each]), ...Object.keys(counts).filter((each) => !KIND_ORDER.includes(each))];
  const tabs = $("kinds");
  tabs.replaceChildren();
  for (const each of kinds) {
    const tab = el("button", each === kind ? "on" : "");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", each === kind ? "true" : "false");
    tab.append(each === "All" ? "All " : `${KIND_PLURAL[each] || each} `, el("span", null, String(each === "All" ? data.items.length : counts[each])));
    tab.addEventListener("click", () => { kind = each; drawKinds(); drawGrid(); });
    tabs.append(tab);
  }
}

function drawGrid() {
  const query = $("search").value.trim().toLowerCase();
  const rarity = $("rarity").value;
  const showHidden = $("show-hidden").checked;
  const grid = $("grid");
  grid.replaceChildren();
  let shown = 0;
  for (const item of data.items) {
    if (kind !== "All" && item.kind !== kind) continue;
    if (item.hidden) {
      // A blank cannot match a search or a rarity: nothing is known of it.
      if (!showHidden || query || rarity) continue;
    } else {
      if (rarity && item.rarity !== rarity) continue;
      if (query && !item.name.toLowerCase().includes(query)) continue;
    }
    grid.append(card(item));
    shown += 1;
  }
  $("empty").hidden = shown > 0;
}

function drawWiki() {
  const found = data.discovered || 0;
  const total = data.total || data.items.length;
  $("found-count").textContent = found;
  $("total-count").textContent = total;
  $("progress-fill").style.width = total ? `${(found / total) * 100}%` : "0";
  const select = $("rarity");
  const chosen = select.value;
  select.replaceChildren(new Option("Every rarity", ""));
  for (const rarity of data.rarities) select.append(new Option(rarity.name, rarity.id));
  select.value = chosen;
  drawKinds();
  drawGrid();
}

// ---- Home ----

function drawHome() {
  document.title = data.name || "WorldFall";
  $("brand-name").textContent = data.name || "WorldFall";
  $("hero-name").textContent = data.name || "WorldFall";
  if (data.tagline) $("hero-tagline").textContent = data.tagline;
  $("stat-online").textContent = data.online ?? "-";
  $("stat-found").textContent = `${data.discovered || 0} / ${data.total || 0}`;
  $("stat-version").textContent = data.version || "-";
  const total = data.total || data.items.length;
  $("home-found").textContent = data.discovered || 0;
  $("home-total").textContent = total;
  $("home-fill").style.width = total ? `${((data.discovered || 0) / total) * 100}%` : "0";
  const address = (data.address || "").trim();
  $("address").hidden = !address;
  $("play-top").hidden = !address;
  $("address-value").textContent = address;

  const latest = $("latest");
  latest.replaceChildren();
  const recent = data.items.filter((item) => !item.hidden).sort((a, b) => (b.foundAt || 0) - (a.foundAt || 0)).slice(0, 6);
  if (!recent.length) {
    latest.append(el("p", "latest-none", "Nothing has been found yet. Be the first."));
  }
  for (const item of recent) {
    const row = el("button", "latest-item");
    row.type = "button";
    row.style.setProperty("--rarity", rarityColor[item.rarity] || "var(--line)");
    const words = el("div");
    const name = el("strong", null, item.name);
    name.style.color = rarityColor[item.rarity] || "";
    words.append(name, el("small", null, `${item.foundBy || "Someone"}, ${when(item.foundAt)}`));
    row.append(icon(item), words);
    row.addEventListener("click", () => open(item));
    latest.append(row);
  }
}

async function copyAddress() {
  const address = (data.address || "").trim();
  if (!address) return;
  try {
    await navigator.clipboard.writeText(address);
    $("address-hint").textContent = "Copied";
  } catch (error) {
    $("address-hint").textContent = "Copy it by hand";
  }
  setTimeout(() => { $("address-hint").textContent = "Click to copy"; }, 2000);
}

$("address").addEventListener("click", copyAddress);
$("play-top").addEventListener("click", () => { location.hash = "#home"; copyAddress(); });
$("search").addEventListener("input", drawGrid);
$("rarity").addEventListener("change", drawGrid);
$("show-hidden").addEventListener("change", drawGrid);

// ---- Which face is showing ----

function route() {
  const page = location.hash === "#wiki" ? "wiki" : "home";
  $("page-home").hidden = page !== "home";
  $("page-wiki").hidden = page !== "wiki";
  for (const link of document.querySelectorAll(".bar nav a")) link.classList.toggle("on", link.dataset.page === page);
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

async function load() {
  try {
    const response = await fetch("items.json", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    data = await response.json();
    data.items = data.items || [];
    data.rarities = data.rarities || [];
    rarityColor = {};
    for (const rarity of data.rarities) rarityColor[rarity.id] = rarity.color;
    drawHome();
    drawWiki();
  } catch (error) {
    $("latest").replaceChildren(el("p", "latest-none", "The server could not be reached just now."));
  }
}

route();
load();
setInterval(() => { if ($("sheet").hidden) load(); }, REFRESH_MS);
