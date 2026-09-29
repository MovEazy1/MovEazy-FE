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

export const designOf = (id) => POSTER_DESIGNS.find((d) => d.id === id) || POSTER_DESIGNS[0];
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
  if (designOf(design).id === "premium") drawPremium(ctx, data);
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
