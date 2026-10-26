/**
 * A society's tenant brochure: two A4 portrait pages, drawn on a canvas like
 * the posters (lib/qrPoster.js) and saved as one PDF.
 *
 *   page 1  the cover photo (the team's own, else Google's with its credit,
 *           else the map), the name and road, the facts, typical rents, who
 *           can rent, and a QR that opens WhatsApp to MovEazy with "I'm
 *           interested in <society>" typed.
 *   page 2  every amenity, how long to the tech parks, what's nearby
 *           (schools, hospitals, supermarkets, metro and bus), and the map.
 *
 * Layout is in an 840 × 1188 space (4 units a millimetre), drawn at 2× —
 * about 200 dpi on A4.
 */
import QRCode from "qrcode";
import { jpegsToPdf } from "./pdfImage";
import { commuteMinutes, formatCommute } from "./commute";
import { rentRange, roadLabel } from "./societyProspects";

export const BROCHURE_WHATSAPP = "919146969162";
export const brochureWhatsappLabel = "+91 91469 69162";

/** Where people from these societies work and go. */
export const TECH_PARKS = [
  { name: "RMZ Ecoworld", lat: 12.9298, lng: 77.6846 },
  { name: "RMZ Ecospace", lat: 12.9241, lng: 77.6811 },
  { name: "Embassy Tech Village", lat: 12.9307, lng: 77.6914 },
  { name: "Wipro, Sarjapur Road", lat: 12.9136, lng: 77.6856 },
  { name: "Cessna Business Park", lat: 12.9345, lng: 77.6951 },
  { name: "HSR Layout (BDA Complex)", lat: 12.9137, lng: 77.6375 },
  { name: "Koramangala", lat: 12.9357, lng: 77.6241 },
];

const W = 840;
const H = 1188;
const FONT = "Manrope, Inter, system-ui, sans-serif";
const C = { deep: "#0A3A2A", deep2: "#05241A", acc: "#0E7C68", mint: "#E3F4EC", ink: "#13201B", dim: "#56655F", line: "#E4DED0", cream: "#F7F5EE", gold: "#E4B659", red: "#B91C1C" };

export const whatsappLink = (name) =>
  `https://wa.me/${BROCHURE_WHATSAPP}?text=${encodeURIComponent(`Hi MovEazy! I'm interested in renting a flat at ${name}.`)}`;

/* ── Drawing helpers ─────────────────────────────────────────────────────── */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRound(ctx, x, y, w, h, r, color) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function text(ctx, s, x, y, { size = 16, weight = 600, color = C.ink, align = "left", maxWidth } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  let t = String(s ?? "");
  if (maxWidth) while (t.length > 1 && ctx.measureText(t).width > maxWidth) t = `${t.slice(0, -2)}…`;
  ctx.fillText(t, x, y);
  return ctx.measureText(t).width;
}

/** Words wrapped to `maxWidth`, at most `lines` lines (the last ends in … if cut). */
function wrap(ctx, s, maxWidth, lines, font) {
  ctx.font = font;
  const words = String(s || "").split(/\s+/).filter(Boolean);
  const out = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !cur) cur = next;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    let last = kept[lines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[lines - 1] = `${last}…`;
    return kept;
  }
  return out;
}

/** An image drawn to cover the box (cropped from the middle). */
function cover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r;
  const sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function drawQr(ctx, url, x, y, size, color = C.deep2) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const cell = size / n;
  ctx.fillStyle = color;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules.get(r, c)) ctx.fillRect(x + c * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function check(ctx, x, y, s, color = C.acc) {
  ctx.strokeStyle = color;
  ctx.lineWidth = s / 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.5);
  ctx.lineTo(x + s * 0.38, y + s * 0.85);
  ctx.lineTo(x + s, y + s * 0.1);
  ctx.stroke();
}

function logo(ctx, img, x, y, w, plate = true) {
  if (!img) {
    text(ctx, "MovEazy", x, y + 22, { size: 24, weight: 800, color: C.deep });
    return;
  }
  const h = (img.height / img.width) * w;
  if (plate) fillRound(ctx, x - 12, y - 8, w + 24, h + 16, 10, "#FFFFFF");
  ctx.drawImage(img, x, y, w, h);
}

function sectionTitle(ctx, s, x, y) {
  text(ctx, s.toUpperCase(), x, y, { size: 13, weight: 800, color: C.acc });
}

/* ── The map (OpenStreetMap tiles) ───────────────────────────────────────── */

const TILE = 256;
const lng2x = (lng, z) => ((lng + 180) / 360) * 2 ** z * TILE;
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * TILE;
};

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** A w × h map image around the spot (zoom 15), or null if the tiles won't load. */
export async function mapImage(lat, lng, w = 760, h = 380, z = 15) {
  if (lat == null || lng == null) return null;
  const cx = lng2x(Number(lng), z);
  const cy = lat2y(Number(lat), z);
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const tiles = [];
  for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + w) / TILE); tx++) {
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + h) / TILE); ty++) tiles.push([tx, ty]);
  }
  const imgs = await Promise.all(tiles.map(([tx, ty]) => loadImage(`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`)));
  if (imgs.some((i) => !i)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  tiles.forEach(([tx, ty], i) => ctx.drawImage(imgs[i], tx * TILE - x0, ty * TILE - y0));
  // The pin.
  ctx.fillStyle = "rgba(14,124,104,.18)";
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.red;
  ctx.beginPath(); ctx.arc(w / 2, h / 2 - 22, 13, Math.PI, 0); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath(); ctx.arc(w / 2, h / 2 - 22, 5, 0, Math.PI * 2); ctx.fill();
  try {
    canvas.toDataURL(); // tainted tiles would make the PDF fail later; fail here instead
  } catch {
    return null;
  }
  return canvas;
}

/* ── Page 1 ──────────────────────────────────────────────────────────────── */

function factList(s) {
  const f = s.facts || {};
  return [
    f.builder && ["Builder", f.builder],
    f.year_built && ["Built", String(f.year_built)],
    f.towers && ["Towers", String(f.towers)],
    f.total_flats && ["Homes", String(f.total_flats)],
    f.floors && ["Floors", String(f.floors)],
    f.maintenance && ["Maintenance", String(f.maintenance)],
  ].filter(Boolean);
}

function drawPage1(ctx, s, { photo, photoCredit, map, logoImg }) {
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);

  // Cover.
  const coverH = 500;
  const img = photo || map;
  if (img) cover(ctx, img, 0, 0, W, coverH);
  else { ctx.fillStyle = C.deep; ctx.fillRect(0, 0, W, coverH); }
  const g = ctx.createLinearGradient(0, coverH * 0.35, 0, coverH);
  g.addColorStop(0, "rgba(5,36,26,0)");
  g.addColorStop(1, "rgba(5,36,26,.88)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, coverH);
  logo(ctx, logoImg, 44, 40, 150);
  if (photo && photoCredit) text(ctx, `Photo: ${photoCredit} · Google`, W - 30, 30, { size: 10, weight: 600, color: "rgba(255,255,255,.85)", align: "right", maxWidth: 380 });
  if (!photo && map) text(ctx, "© OpenStreetMap contributors", W - 30, coverH - 14, { size: 10, weight: 600, color: "rgba(255,255,255,.8)", align: "right" });

  const where = [roadLabel(s.road), s.area].filter((v, i, a) => v && a.indexOf(v) === i).join(" · ");
  const lines = wrap(ctx, s.name, W - 88, 2, `800 52px ${FONT}`);
  const first = coverH - 46 - (lines.length - 1) * 58;
  text(ctx, where.toUpperCase(), 44, first - 62, { size: 15, weight: 800, color: C.gold, maxWidth: W - 88 });
  lines.forEach((l, i) => text(ctx, l, 44, first + i * 58, { size: 52, weight: 800, color: "#FFFFFF" }));

  // Facts.
  let y = coverH + 40;
  const facts = factList(s);
  if (facts.length) {
    // The builder's name gets two shares of the row; numbers need one.
    const shares = facts.map(([k]) => (k === "Builder" || k === "Maintenance" ? 2 : 1));
    const unit = (W - 88) / shares.reduce((a, b) => a + b, 0);
    let x = 44;
    facts.forEach(([k, v], i) => {
      const colW = unit * shares[i];
      text(ctx, k.toUpperCase(), x, y, { size: 11, weight: 800, color: C.dim });
      text(ctx, v, x, y + 26, { size: 19, weight: 800, color: C.ink, maxWidth: colW - 14 });
      x += colW;
    });
    y += 62;
  }

  // Rents.
  const rents = s.rents || {};
  const bhks = ["1", "2", "3", "4"].filter((k) => rentRange(rents[k]));
  fillRound(ctx, 44, y, W - 88, 150, 18, "#FFFFFF");
  ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; roundRect(ctx, 44, y, W - 88, 150, 18); ctx.stroke();
  sectionTitle(ctx, "Typical monthly rent", 70, y + 36);
  if (bhks.length) {
    const colW = (W - 140) / bhks.length;
    bhks.forEach((k, i) => {
      const x = 70 + i * colW;
      text(ctx, `${k} BHK`, x, y + 76, { size: 15, weight: 700, color: C.dim });
      text(ctx, rentRange(rents[k]), x, y + 112, { size: 30, weight: 800, color: C.deep, maxWidth: colW - 16 });
    });
  } else {
    text(ctx, "Ask us for the flats free right now and their rents.", 70, y + 90, { size: 20, weight: 700, color: C.deep });
  }
  text(ctx, "Approximate, from recent listings — every flat is priced by its owner.", 70, y + 138, { size: 11, weight: 600, color: C.dim });
  y += 182;

  // Who can rent.
  const f = s.facts || {};
  const rules = [["Families", f.families], ["Bachelors", f.bachelors], ["Pets", f.pets]].filter(([, v]) => v === true || v === false);
  if (rules.length) {
    sectionTitle(ctx, "Who can rent", 44, y);
    let x = 44;
    rules.forEach(([k, v]) => {
      const label = `${v ? "✓" : "✕"}  ${k}`;
      ctx.font = `700 16px ${FONT}`;
      const w = ctx.measureText(label).width + 32;
      fillRound(ctx, x, y + 14, w, 38, 19, v ? C.mint : "#F1ECE2");
      text(ctx, label, x + 16, y + 39, { size: 16, weight: 700, color: v ? C.acc : "#8A8270" });
      x += w + 10;
    });
    y += 80;
  }

  // The QR.
  const qy = H - 280;
  fillRound(ctx, 0, qy, W, 280, 0, C.deep);
  fillRound(ctx, 44, qy + 40, 200, 200, 18, "#FFFFFF");
  drawQr(ctx, whatsappLink(s.name), 56, qy + 52, 176);
  text(ctx, "Want a flat here?", 280, qy + 88, { size: 34, weight: 800, color: "#FFFFFF" });
  wrap(ctx, `Scan to WhatsApp MovEazy — we'll show you the flats free in ${s.name}, book your visit and get you moved in fast.`, W - 324, 3, `600 17px ${FONT}`)
    .forEach((l, i) => text(ctx, l, 280, qy + 122 + i * 25, { size: 17, weight: 600, color: "rgba(255,255,255,.85)" }));
  text(ctx, `WhatsApp ${brochureWhatsappLabel}`, 280, qy + 212, { size: 22, weight: 800, color: C.gold });
  text(ctx, "MovEazy · India's first speed renting platform", 280, qy + 240, { size: 13, weight: 600, color: "rgba(255,255,255,.7)" });
}

/* ── Page 2 ──────────────────────────────────────────────────────────────── */

const NEARBY = [
  ["schools", "Schools"],
  ["hospitals", "Hospitals"],
  ["supermarkets", "Groceries & malls"],
  ["transit", "Metro & bus"],
];

function drawPage2(ctx, s, { map, logoImg }) {
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);

  // Header.
  text(ctx, s.name, 44, 66, { size: 26, weight: 800, color: C.deep, maxWidth: W - 300 });
  text(ctx, [roadLabel(s.road), s.area].filter(Boolean).join(" · "), 44, 92, { size: 14, weight: 600, color: C.dim, maxWidth: W - 300 });
  logo(ctx, logoImg, W - 44 - 130, 46, 130, false);
  ctx.fillStyle = C.line; ctx.fillRect(44, 112, W - 88, 2);

  // Amenities.
  let y = 150;
  sectionTitle(ctx, "Amenities", 44, y);
  const am = (s.amenities || []).slice(0, 30);
  if (am.length) {
    const cols = 3;
    const colW = (W - 88) / cols;
    am.forEach((a, i) => {
      const x = 44 + (i % cols) * colW;
      const yy = y + 22 + Math.floor(i / cols) * 30;
      check(ctx, x, yy + 2, 14);
      text(ctx, a, x + 24, yy + 15, { size: 15, weight: 600, color: C.ink, maxWidth: colW - 32 });
    });
    y += 22 + Math.ceil(am.length / cols) * 30 + 26;
  } else {
    text(ctx, "Ask us for the full list.", 44, y + 34, { size: 15, weight: 600, color: C.dim });
    y += 66;
  }

  // Commute.
  sectionTitle(ctx, "Getting to work", 44, y);
  const trips = TECH_PARKS.map((t) => [t.name, commuteMinutes({ lat: s.lat, lng: s.lng }, t)]).filter(([, m]) => m != null);
  {
    const cols = 2;
    const colW = (W - 88) / cols;
    trips.forEach(([n, m], i) => {
      const x = 44 + (i % cols) * colW;
      const yy = y + 34 + Math.floor(i / cols) * 30;
      text(ctx, n, x, yy, { size: 15, weight: 600, color: C.ink, maxWidth: colW - 110 });
      text(ctx, `~${formatCommute(m)}`, x + colW - 24, yy, { size: 15, weight: 800, color: C.acc, align: "right" });
    });
    y += 34 + Math.ceil(trips.length / cols) * 30;
    text(ctx, "Approximate travel by bike or cab in normal traffic.", 44, y, { size: 11, weight: 600, color: C.dim });
    y += 32;
  }

  // Nearby.
  const near = s.nearby || {};
  const groups = NEARBY.filter(([k]) => (near[k] || []).length);
  if (groups.length) {
    sectionTitle(ctx, "Nearby", 44, y);
    const colW = (W - 88) / groups.length;
    let maxRows = 0;
    groups.forEach(([k, label], i) => {
      const x = 44 + i * colW;
      text(ctx, label, x, y + 30, { size: 14, weight: 800, color: C.ink, maxWidth: colW - 12 });
      const items = (near[k] || []).slice(0, 4);
      maxRows = Math.max(maxRows, items.length);
      items.forEach((it, j) => {
        const name = typeof it === "string" ? it : it.name;
        const km = typeof it === "object" && it.km != null ? `${Number(it.km).toFixed(1)} km` : "";
        const ly = wrap(ctx, name, colW - 16, 2, `600 13px ${FONT}`);
        ly.forEach((l, li) => text(ctx, l, x, y + 54 + j * 50 + li * 16, { size: 13, weight: 600, color: C.ink }));
        if (km) text(ctx, km, x, y + 54 + j * 50 + ly.length * 16, { size: 11, weight: 700, color: C.acc });
      });
    });
    y += 54 + maxRows * 50 + 10;
  }

  // Map.
  const mapH = Math.min(560, H - 130 - y);
  if (map && mapH > 160) {
    ctx.save();
    roundRect(ctx, 44, y, W - 88, mapH, 18);
    ctx.clip();
    cover(ctx, map, 44, y, W - 88, mapH);
    ctx.restore();
    text(ctx, "© OpenStreetMap contributors", W - 54, y + mapH - 10, { size: 10, weight: 600, color: C.dim, align: "right" });
  }

  // Foot.
  const fy = H - 92;
  ctx.fillStyle = C.line; ctx.fillRect(44, fy - 18, W - 88, 2);
  fillRound(ctx, 44, fy - 4, 78, 78, 8, "#FFFFFF");
  drawQr(ctx, whatsappLink(s.name), 50, fy + 2, 66);
  text(ctx, `WhatsApp ${brochureWhatsappLabel} for the flats free in ${s.name}`, 140, fy + 26, { size: 15, weight: 800, color: C.deep, maxWidth: W - 190 });
  text(ctx, "Details from public sources and the society — confirmed on your visit. www.moveazy.co.in", 140, fy + 52, { size: 11, weight: 600, color: C.dim, maxWidth: W - 190 });
}

/* ── Out ─────────────────────────────────────────────────────────────────── */

/** Draw page `n` (1 or 2) onto `canvas` at `scale`. `assets`: { photo, photoCredit, map, logoImg } (loaded). */
export function drawBrochurePage(canvas, n, society, assets, scale = 1) {
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = "high";
  if (n === 1) drawPage1(ctx, society, assets);
  else drawPage2(ctx, society, assets);
  return canvas;
}

/** The brochure's pictures: the cover photo (own → Google → none), the map, the logo. */
export async function brochureAssets(society, { googlePhoto = null, logoSrc = "" } = {}) {
  const own = (society.photos || [])[0];
  const [ownImg, gImg, map, logoImg] = await Promise.all([
    own ? loadImage(own) : null,
    !own && googlePhoto?.uri ? loadImage(googlePhoto.uri) : null,
    mapImage(society.lat, society.lng),
    logoSrc ? loadImage(logoSrc) : null,
  ]);
  const photo = ownImg || gImg;
  return { photo, photoCredit: !ownImg && gImg ? googlePhoto.attribution || "Google Maps user" : "", map, logoImg };
}

/** The two pages as one PDF Blob. */
export async function brochurePdf(society, assets) {
  const pages = [];
  for (const n of [1, 2]) {
    const canvas = drawBrochurePage(document.createElement("canvas"), n, society, assets, 2);
    let blob;
    try {
      blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the brochure"))), "image/jpeg", 0.9));
    } catch {
      // A photo that wouldn't share its pixels: draw without it.
      const plain = drawBrochurePage(document.createElement("canvas"), n, society, { ...assets, photo: null }, 2);
      blob = await new Promise((resolve, reject) => plain.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the brochure"))), "image/jpeg", 0.9));
    }
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height });
  }
  return new Blob([jpegsToPdf(pages, "portrait", "A4")], { type: "application/pdf" });
}

/** "Prestige Lakeside Habitat" → "MovEazy - Prestige Lakeside Habitat.pdf" */
export const brochureFileName = (name) => `MovEazy - ${String(name || "Society").replace(/[\\/:*?"<>|]+/g, " ").trim()}.pdf`;
