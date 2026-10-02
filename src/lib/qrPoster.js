/**
 * The broker's printable QR poster, drawn on a canvas so the preview in the
 * app and the A4 PDF are the same pixels.
 *
 *   profile   A4 landscape. The broker on the left (photo, name, rating,
 *             number); the QR on the right. The design on partners.moveazy.co.in.
 *   premium   A4 portrait. "Looking for a Premium Home?" over one big QR, the
 *             broker small at the foot.
 *
 * Layout is in a fixed 1188 × 840 space (840 × 1188 for portrait) — 4 units a
 * millimetre — and scaled to whatever resolution is asked for.
 */
import QRCode from "qrcode";
import { jpegToPdf } from "./pdfImage";

export const POSTER_DESIGNS = [
  { id: "profile", label: "Your profile", orientation: "landscape" },
  { id: "premium", label: "Premium Home", orientation: "portrait" },
];

const SIZE = { landscape: [1188, 840], portrait: [840, 1188] };
const FONT = "Manrope, Inter, system-ui, sans-serif";
const C = { deep: "#0A3A2A", deep2: "#05241A", acc: "#15803D", gold: "#E4B659", gold2: "#F7E9C6", gold3: "#8A6419", ink: "#13201B", dim: "#56655F", cream: "#F7F5EE" };

/** The owner app's poster for one property (owner_buildings.sql): its photo, its name, one big QR. No contact on it. */
export const BUILDING_POSTER = { id: "building", label: "Property", orientation: "portrait" };
/** One flat's door poster: the same layout, its own words (flat_insights.sql). */
export const FLAT_POSTER = { id: "flat", label: "Flat", orientation: "portrait" };

export const designOf = (id) => [...POSTER_DESIGNS, BUILDING_POSTER, FLAT_POSTER].find((d) => d.id === id) || POSTER_DESIGNS[0];
export const posterSize = (id) => SIZE[designOf(id).orientation];

/** An image, loaded; null if it can't be (the poster then draws initials). */
export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Wait for the poster's font, so the first draw isn't in a fallback face. */
export async function posterFontsReady() {
  try {
    await Promise.all(["800 40px Manrope", "700 40px Manrope", "500 40px Manrope"].map((f) => document.fonts?.load(f)));
  } catch { /* draw with whatever is there */ }
}

const initials = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "M";

export function formatMobile(phone) {
  const d = String(phone || "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : String(phone || "");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, { size = 30, weight = 700, color = C.ink, align = "left", maxWidth } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  let t = String(s ?? "");
  if (maxWidth) while (t.length > 1 && ctx.measureText(t).width > maxWidth) t = `${t.slice(0, -2)}…`;
  ctx.fillText(t, x, y);
}

function drawQr(ctx, url, x, y, size) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "Q" });
  const n = modules.size;
  const cell = size / n;
  ctx.fillStyle = "#0B1F17";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // A hair of overlap so no seams show between modules when scaled.
      if (modules.data[r * n + c]) ctx.fillRect(x + c * cell, y + r * cell, cell + 0.6, cell + 0.6);
    }
  }
}

function drawPortrait(ctx, cx, cy, r, photo, name) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = C.gold2;
  ctx.fill();
  ctx.clip();
  if (photo) {
    const s = Math.min(photo.naturalWidth || photo.width, photo.naturalHeight || photo.height);
    const sx = ((photo.naturalWidth || photo.width) - s) / 2;
    const sy = ((photo.naturalHeight || photo.height) - s) / 2;
    ctx.drawImage(photo, sx, sy, s, s, cx - r, cy - r, r * 2, r * 2);
  } else {
    text(ctx, initials(name), cx, cy + r * 0.34, { size: r * 0.95, weight: 800, color: C.gold3, align: "center" });
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(4, r * 0.06);
  ctx.strokeStyle = C.gold;
  ctx.stroke();
}

function ratingLine(b) {
  return Number(b?.ratings) > 0 ? `★ ${Number(b.rating).toFixed(1)}  ·  ${b.ratings} rating${Number(b.ratings) === 1 ? "" : "s"}` : "";
}

function drawProfile(ctx, { broker, url, photo, logo, displayUrl }) {
  const [W, H] = SIZE.landscape;
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);

  // Header band
  const g = ctx.createLinearGradient(0, 0, W, 150);
  g.addColorStop(0, "#145C43");
  g.addColorStop(1, C.deep2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 140);
  if (logo) ctx.drawImage(logo, 60, 44, (logo.width / logo.height) * 52, 52);
  text(ctx, "Verified rental homes", W - 60, 82, { size: 28, weight: 700, color: C.gold, align: "right" });

  // Card
  ctx.save();
  ctx.shadowColor = "rgba(10,40,30,.12)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, 50, 180, W - 100, H - 230, 36);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();

  // Left: the broker
  const lx = 330;
  drawPortrait(ctx, lx, 360, 128, photo, broker.name);
  text(ctx, broker.name || "MovEazy partner", lx, 556, { size: 52, weight: 800, align: "center", maxWidth: 500 });
  if (broker.agency) text(ctx, broker.agency, lx, 598, { size: 28, weight: 600, color: C.dim, align: "center", maxWidth: 500 });
  const rl = ratingLine(broker);
  const badgeY = broker.agency ? 652 : 620;
  if (rl) {
    text(ctx, rl, lx, badgeY, { size: 32, weight: 800, color: C.gold3, align: "center" });
  } else {
    text(ctx, "✓ Verified MovEazy partner", lx, badgeY, { size: 28, weight: 800, color: C.acc, align: "center" });
  }
  if (broker.phone) text(ctx, `Call / WhatsApp  ${formatMobile(broker.phone)}`, lx, badgeY + 64, { size: 30, weight: 700, color: C.ink, align: "center" });

  // Divider
  ctx.save();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "#DCD6C6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 + 40, 230);
  ctx.lineTo(W / 2 + 40, H - 100);
  ctx.stroke();
  ctx.restore();

  // Right: the code
  const rx = 900;
  text(ctx, "Scan to see my homes", rx, 262, { size: 40, weight: 800, align: "center" });
  const q = 380;
  drawQr(ctx, url, rx - q / 2, 300, q);
  text(ctx, displayUrl, rx, 730, { size: 26, weight: 700, color: C.dim, align: "center" });
}

function drawPremium(ctx, { broker, url, photo, logo, displayUrl }) {
  const [W, H] = SIZE.portrait;
  const g = ctx.createRadialGradient(0, 0, 40, 0, 0, H * 1.1);
  g.addColorStop(0, "#1B6B4E");
  g.addColorStop(0.5, C.deep);
  g.addColorStop(1, C.deep2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (logo) {
    const lw = (logo.width / logo.height) * 58;
    ctx.drawImage(logo, (W - lw) / 2, 70, lw, 58);
  }
  text(ctx, "Looking for a", W / 2, 262, { size: 60, weight: 700, color: "#fff", align: "center" });
  text(ctx, "Premium Home?", W / 2, 362, { size: 96, weight: 800, color: C.gold, align: "center" });
  text(ctx, "Scan to see verified homes", W / 2, 428, { size: 32, weight: 600, color: "rgba(255,255,255,.78)", align: "center" });

  const card = 580;
  const cx = (W - card) / 2;
  roundRect(ctx, cx, 480, card, card, 40);
  ctx.fillStyle = "#fff";
  ctx.fill();
  drawQr(ctx, url, cx + 40, 520, card - 80);

  // The broker, at the foot
  const fy = 1108;
  const r = 38;
  const nameW = (() => { ctx.font = `800 30px ${FONT}`; return ctx.measureText(broker.name || "").width; })();
  const sub = [broker.phone ? formatMobile(broker.phone) : "", ratingLine(broker)].filter(Boolean).join("   ");
  const subW = (() => { ctx.font = `600 24px ${FONT}`; return ctx.measureText(sub).width; })();
  const blockW = r * 2 + 20 + Math.min(560, Math.max(nameW, subW));
  const bx = (W - blockW) / 2;
  drawPortrait(ctx, bx + r, fy - 8, r, photo, broker.name);
  text(ctx, broker.name || "MovEazy partner", bx + r * 2 + 20, fy - 14, { size: 30, weight: 800, color: "#fff", maxWidth: 560 });
  if (sub) text(ctx, sub, bx + r * 2 + 20, fy + 22, { size: 24, weight: 600, color: C.gold, maxWidth: 560 });
  text(ctx, displayUrl, W / 2, H - 22, { size: 20, weight: 600, color: "rgba(255,255,255,.5)", align: "center" });
}

/** A cover-cropped image in a rounded box. */
function drawCover(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  ctx.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
  ctx.restore();
}

function drawBuilding(ctx, { building, url, photo, logo, displayUrl }) {
  const [W, H] = SIZE.portrait;
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);

  // The building, full width at the top, under a dark band for the logo.
  const ph = 360;
  if (photo) {
    drawCover(ctx, photo, 0, 0, W, ph, 0);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, ph);
    g.addColorStop(0, "#145C43");
    g.addColorStop(1, C.deep2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, ph);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, ph);
  shade.addColorStop(0, "rgba(5,36,26,.72)");
  shade.addColorStop(0.35, "rgba(5,36,26,.05)");
  shade.addColorStop(0.7, "rgba(5,36,26,.15)");
  shade.addColorStop(1, "rgba(5,36,26,.85)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, ph);
  if (logo) {
    const lw = (logo.width / logo.height) * 50;
    ctx.drawImage(logo, 48, 38, lw, 50);
  }
  text(ctx, building.tag || "Homes for rent", W - 48, 72, { size: 26, weight: 800, color: C.gold, align: "right" });
  text(ctx, building.name || "Our property", 48, ph - 74, { size: 58, weight: 800, color: "#fff", maxWidth: W - 96 });
  const sub = [building.area, building.landmark].filter(Boolean).join("  ·  ");
  if (sub) text(ctx, sub, 48, ph - 30, { size: 28, weight: 600, color: "rgba(255,255,255,.85)", maxWidth: W - 96 });

  // The pitch.
  const avail = Number(building.available) || 0;
  const pitch = building.pitch
    || (avail > 0 ? `${avail} flat${avail === 1 ? "" : "s"} available${building.rentFrom ? `  ·  from ${building.rentFrom}` : ""}` : "Flats for rent");
  ctx.font = `800 30px ${FONT}`;
  const pw = Math.min(W - 96, ctx.measureText(pitch).width + 56);
  roundRect(ctx, (W - pw) / 2, ph + 34, pw, 58, 29);
  ctx.fillStyle = C.gold2;
  ctx.fill();
  text(ctx, pitch, W / 2, ph + 74, { size: 30, weight: 800, color: C.gold3, align: "center", maxWidth: W - 120 });

  text(ctx, building.headline || "Scan to see every flat", W / 2, ph + 160, { size: 46, weight: 800, color: C.ink, align: "center" });
  text(ctx, building.subline || "& book a visit at your time", W / 2, ph + 210, { size: 34, weight: 600, color: C.dim, align: "center" });

  // The code.
  const q = 360;
  const card = q + 60;
  const cx = (W - card) / 2;
  const cy = ph + 240;
  ctx.save();
  ctx.shadowColor = "rgba(10,40,30,.16)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, cx, cy, card, card, 32);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, cx, cy, card, card, 32);
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.gold;
  ctx.stroke();
  drawQr(ctx, url, cx + 30, cy + 30, q);

  // Three steps, and where it goes.
  const sy = cy + card + 62;
  const steps = building.steps || ["Scan", "Pick a flat", "Book a visit"];
  const colW = (W - 96) / 3;
  steps.forEach((s, k) => {
    const x = 48 + colW * k + colW / 2;
    ctx.beginPath();
    ctx.arc(x - 70, sy - 10, 18, 0, Math.PI * 2);
    ctx.fillStyle = C.deep;
    ctx.fill();
    text(ctx, String(k + 1), x - 70, sy - 1, { size: 22, weight: 800, color: C.gold, align: "center" });
    text(ctx, s, x - 44, sy, { size: 26, weight: 700, color: C.ink });
  });
  text(ctx, displayUrl, W / 2, H - 30, { size: 22, weight: 600, color: C.dim, align: "center" });
}

/**
 * Draw `design` onto `canvas` at `scale` (1 = 1188 px on the long side).
 * `data`: { broker: {name, agency, phone, rating, ratings}, url, displayUrl, photo, logo } — photo/logo loaded images.
 */
export function drawPoster(canvas, design, data, scale = 1) {
  const [W, H] = posterSize(design);
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = "high";
  const id = designOf(design).id;
  if (id === "premium") drawPremium(ctx, data);
  else if (id === "building" || id === "flat") drawBuilding(ctx, data);
  else drawProfile(ctx, data);
  return canvas;
}

/** The poster as an A4 PDF Blob, at about 200 dpi. */
export async function posterPdf(design, data) {
  const canvas = drawPoster(document.createElement("canvas"), design, data, 2);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the poster"))), "image/jpeg", 0.92));
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height, designOf(design).orientation);
  return new Blob([pdf], { type: "application/pdf" });
}
