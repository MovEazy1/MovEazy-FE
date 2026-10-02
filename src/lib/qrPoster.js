/**
 * The broker's printable QR poster, drawn on a canvas so the preview in the
 * app and the A4 PDF are the same pixels.
 *
 *   profile   A4 landscape. The broker on the left (photo, name, rating,
 *             number); the QR on the right. The design on partners.moveazy.co.in.
 *   premium   A4 portrait. "Looking for a Premium Home?" over one big QR, the
 *             broker small at the foot.
 *   street, speed, door
 *             A1 landscape, for the front of a house: "Street Tape" (huge
 *             type, a band of tape, a rent sticker), "Speed Lane" (deep green
 *             speed streaks, a glowing QR) and "Open Door" (the QR is the
 *             door of a drawn house).
 *   classic   A4 landscape, white. "Premium 2BHK for Rent" in a serif, one QR
 *             in a green-edged card, "Scan to View Property" — for a building
 *             or a flat, chosen in the CRM next to the photo poster.
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
const SERIF = "\"Playfair Display\", Georgia, \"Times New Roman\", serif";
const C = { deep: "#0A3A2A", deep2: "#05241A", acc: "#15803D", gold: "#E4B659", gold2: "#F7E9C6", gold3: "#8A6419", ink: "#13201B", dim: "#56655F", cream: "#F7F5EE" };

/** The owner app's poster for one property (owner_buildings.sql): its photo, its name, one big QR. No contact on it. */
export const BUILDING_POSTER = { id: "building", label: "Property", orientation: "portrait" };
/** One flat's door poster: the same layout, its own words (flat_insights.sql). */
export const FLAT_POSTER = { id: "flat", label: "Flat", orientation: "portrait" };
/** The white landscape poster: headline, QR, "Scan to View Property". For a building or a flat. */
export const CLASSIC_POSTER = { id: "classic", label: "Classic", orientation: "landscape" };

/** The two looks a building's or flat's poster comes in. */
export const PROPERTY_POSTER_STYLES = [
  { id: "photo", label: "Photo poster", hint: "A4 portrait · photo & QR" },
  { id: "classic", label: "Classic", hint: "A4 landscape · headline & QR" },
  { id: "street", label: "Street Tape", hint: "A1 landscape · big type, tape" },
  { id: "speed", label: "Speed Lane", hint: "A1 landscape · bold brand" },
  { id: "door", label: "Open Door", hint: "A1 landscape · the house" },
];

/** A1 landscape street posters, for the front of the house: seen from across the road. */
export const STREET_POSTERS = [
  { id: "street", label: "Street Tape", orientation: "landscape", paper: "A1" },
  { id: "speed", label: "Speed Lane", orientation: "landscape", paper: "A1" },
  { id: "door", label: "Open Door", orientation: "landscape", paper: "A1" },
];

export const designOf = (id) => [...POSTER_DESIGNS, BUILDING_POSTER, FLAT_POSTER, CLASSIC_POSTER, ...STREET_POSTERS].find((d) => d.id === id) || POSTER_DESIGNS[0];
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
    await Promise.all(["800 40px Manrope", "700 40px Manrope", "600 40px Manrope", "500 40px Manrope", "700 40px \"Playfair Display\"", "italic 600 40px \"Playfair Display\""].map((f) => document.fonts?.load(f)));
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

/* ── A1 street posters: big enough to read from across the road ──────────── */

const DEEP = "#0A3A2A";
const DEEP2 = "#04241A";
const MINT = "#34D399";
const GOLD = "#D9A55A";
const GOLD_DK = "#B07D35";

/** The facts the street posters can shout: type, rent, how many. */
function shout(data) {
  const type = data.headline?.accent || "Homes";
  const rent = data.rentFrom || "";
  const n = Number(data.available) || 0;
  return { type, rent, n, rentIsFrom: data.rentIsFrom !== false };
}

function fitSize(ctx, s, maxW, start, weight = 800, family = FONT, min = 20) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > min && ctx.measureText(s).width > maxW) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function spaced(ctx, s, x, y, { size, weight = 800, color, align = "left", spacing = 0, family = FONT }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
  ctx.restore();
}

function goldFill(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#E9C27A");
  g.addColorStop(0.5, "#C8903F");
  g.addColorStop(1, "#9C6B2C");
  return g;
}

/** The QR in a viewfinder: white card, four corner brackets. */
function viewfinder(ctx, url, x, y, card, color) {
  ctx.save();
  ctx.shadowColor = "rgba(10,58,42,.22)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, x, y, card, card, 26);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
  drawQr(ctx, url, x + 32, y + 32, card - 64);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  const o = 20;
  const L = 62;
  [[x - o, y - o, 1, 1], [x + card + o, y - o, -1, 1], [x - o, y + card + o, 1, -1], [x + card + o, y + card + o, -1, -1]].forEach(([px, py, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(px, py + dy * L);
    ctx.lineTo(px, py);
    ctx.lineTo(px + dx * L, py);
    ctx.stroke();
  });
  ctx.restore();
}

/** A gold starburst sticker with the rent, at (x, y), tilted. */
function rentSticker(ctx, x, y, r, { rent, rentIsFrom }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.2);
  ctx.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rr = i % 2 ? r * 0.89 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = goldFill(ctx, -r, -r, r, r);
  ctx.shadowColor = "rgba(0,0,0,.25)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.shadowColor = "transparent";
  if (rent) {
    if (rentIsFrom) text(ctx, "from", 0, -r * 0.3, { size: r * 0.22, weight: 700, color: DEEP2, align: "center" });
    const rs = fitSize(ctx, rent, r * 1.55, r * 0.46);
    text(ctx, rent, 0, r * 0.16, { size: rs, weight: 800, color: DEEP2, align: "center" });
    text(ctx, "/ month", 0, r * 0.47, { size: r * 0.22, weight: 700, color: DEEP2, align: "center" });
  } else {
    text(ctx, "MovEazy", 0, -r * 0.04, { size: r * 0.3, weight: 800, color: DEEP2, align: "center" });
    text(ctx, "ASSURED", 0, r * 0.3, { size: r * 0.25, weight: 800, color: DEEP2, align: "center" });
  }
  ctx.restore();
}

/**
 * 1 · "Street Tape" — a to-let sign that can't be missed: the flat type in
 * huge type, FOR RENT in gold, the QR in a viewfinder, a band of tape across
 * and a gold rent sticker slapped on it.
 */
function drawStreet(ctx, data) {
  const [W, H] = SIZE.landscape;
  const { type, rent, n, rentIsFrom } = shout(data);
  ctx.fillStyle = "#F4EEDD";
  ctx.fillRect(0, 0, W, H);

  // Huge type, left.
  const colW = 600;
  const big = fitSize(ctx, type, colW, 290, 800, FONT, 120);
  spaced(ctx, type, 56, 300, { size: big, color: DEEP, spacing: -big * 0.045 });
  const fr = fitSize(ctx, "FOR RENT", colW, 140, 800, FONT, 60);
  ctx.save();
  ctx.font = `800 ${fr}px ${FONT}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${-fr * 0.02}px`;
  ctx.fillStyle = goldFill(ctx, 56, 320, 56 + colW, 440);
  ctx.fillText("FOR RENT", 56, 300 + fr * 1.02);
  ctx.restore();

  // The QR, right.
  const card = 360;
  const qx = W - card - 92;
  const qy = 74;
  viewfinder(ctx, data.url, qx, qy, card, DEEP);
  text(ctx, "Point your camera here", qx + card / 2, qy + card + 70, { size: 26, weight: 800, color: DEEP, align: "center" });

  // Tape across.
  ctx.save();
  ctx.translate(W / 2, 616);
  ctx.rotate(-0.045);
  ctx.fillStyle = DEEP;
  ctx.fillRect(-W, -38, W * 2, 76);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-W, -38, W * 2, 5);
  ctx.fillRect(-W, 33, W * 2, 5);
  const tape = `SCAN  •  SEE INSIDE  •  BOOK A VISIT  •  ${n > 1 ? `${n} FLATS AVAILABLE  •  ` : ""}`;
  ctx.font = `800 26px ${FONT}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(tape).width;
  for (let x = -W; x < W; x += tw) ctx.fillText(tape, x, 2);
  ctx.restore();

  rentSticker(ctx, 150, 600, 92, { rent, rentIsFrom });

  // The brand bar.
  ctx.fillStyle = DEEP2;
  ctx.fillRect(0, H - 82, W, 82);
  if (data.logoDark) {
    const lh = 42;
    ctx.drawImage(data.logoDark, 44, H - 82 + (82 - lh) / 2, (data.logoDark.width / data.logoDark.height) * lh, lh);
  }
  // The line sits centred in what the logo and the link leave free.
  const link = data.displayUrl || "moveazy.co.in";
  ctx.font = `600 18px ${FONT}`;
  const linkW = ctx.measureText(link).width;
  spaced(ctx, "INDIA’S FIRST SPEED RENTING PLATFORM", (250 + W - 44 - linkW - 24) / 2, H - 34, { size: 15, weight: 800, color: GOLD, align: "center", spacing: 1.6 });
  text(ctx, link, W - 44, H - 34, { size: 18, weight: 600, color: "rgba(255,255,255,.7)", align: "right" });
}

/**
 * 2 · "Speed Lane" — the brand promise as motion: deep green, mint and gold
 * speed streaks, the QR glowing at the end of chevrons that point at it.
 */
function drawSpeed(ctx, data) {
  const [W, H] = SIZE.landscape;
  const { type, rent, n, rentIsFrom } = shout(data);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0E4A35");
  bg.addColorStop(1, DEEP2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.36);
  const streaks = [
    [-900, -380, 900, 10, MINT, 0.32], [-760, -330, 520, 4, GOLD, 0.7], [-980, -250, 760, 22, MINT, 0.12],
    [-700, -170, 380, 6, MINT, 0.4], [-1000, 260, 900, 16, MINT, 0.16], [-760, 320, 480, 5, GOLD, 0.7],
    [-900, 390, 640, 9, MINT, 0.3], [300, -520, 700, 7, MINT, 0.26], [380, 470, 560, 12, GOLD, 0.3],
    [-1100, 470, 600, 30, MINT, 0.08], [260, 560, 760, 4, MINT, 0.45],
  ];
  for (const [x, y, w, h, c, a] of streaks) {
    ctx.globalAlpha = a;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = c;
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  if (data.logoDark) {
    const lh = 48;
    ctx.drawImage(data.logoDark, 60, 56, (data.logoDark.width / data.logoDark.height) * lh, lh);
  }

  // Left: the line, the facts, the steps.
  const colW = 530;
  const l1 = "Your next home";
  const l2 = "is one scan away.";
  const hs = Math.min(fitSize(ctx, l1, colW, 88), fitSize(ctx, l2, colW, 88));
  spaced(ctx, l1, 60, 250, { size: hs, color: "#fff", spacing: -hs * 0.03 });
  ctx.save();
  ctx.font = `800 ${hs}px ${FONT}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${-hs * 0.03}px`;
  ctx.fillStyle = goldFill(ctx, 60, 260, 60 + colW, 350);
  ctx.fillText(l2, 60, 250 + hs * 1.1);
  ctx.restore();
  const facts = [type, n > 1 ? `${n} flats available` : "", rent ? `${rentIsFrom ? "from " : ""}${rent}/mo` : ""].filter(Boolean).join("  ·  ");
  text(ctx, facts, 60, 250 + hs * 1.1 + 66, { size: fitSize(ctx, facts, colW, 30, 700), weight: 700, color: MINT });

  const steps = ["Scan", "Pick a flat", "Book a visit"];
  const sy = 560;
  const sw = 600 / 3;
  steps.forEach((s, k) => {
    const x = 60 + sw * k;
    roundRect(ctx, x, sy, sw - 14, 62, 31);
    ctx.fillStyle = k === 2 ? GOLD : "rgba(255,255,255,.1)";
    ctx.fill();
    text(ctx, `${k + 1}  ${s}`, x + (sw - 14) / 2, sy + 41, { size: 23, weight: 800, color: k === 2 ? DEEP2 : "#fff", align: "center", maxWidth: sw - 30 });
  });

  // Right: the QR, glowing, with chevrons leading in.
  const card = 420;
  const cx = W - card - 80;
  const cy = 150;
  ctx.save();
  ctx.shadowColor = "rgba(52,211,153,.55)";
  ctx.shadowBlur = 70;
  roundRect(ctx, cx, cy, card, card, 34);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
  drawQr(ctx, data.url, cx + 34, cy + 34, card - 68);
  [0, 1, 2].forEach((k) => {
    const x = cx - 78 + k * 24;
    const y = cy + card / 2;
    ctx.save();
    ctx.globalAlpha = 0.35 + k * 0.3;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 28);
    ctx.lineTo(x + 15, y);
    ctx.lineTo(x - 15, y + 28);
    ctx.stroke();
    ctx.restore();
  });
  roundRect(ctx, cx + card / 2 - 124, cy - 76, 248, 44, 22);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  spaced(ctx, "SPEED RENTING", cx + card / 2, cy - 46, { size: 18, weight: 800, color: GOLD, align: "center", spacing: 3 });

  spaced(ctx, "INDIA’S FIRST SPEED RENTING PLATFORM", 60, H - 52, { size: 17, weight: 800, color: GOLD, spacing: 2.4 });
  text(ctx, data.displayUrl || "moveazy.co.in", W - 80, H - 52, { size: 20, weight: 600, color: "rgba(255,255,255,.6)", align: "right" });
}

/**
 * 3 · "Open Door" — the house is the poster: a deep green home under a gold
 * roofline, lit windows, and the QR is its front door. "Knock knock."
 */
function drawDoor(ctx, data) {
  const [W, H] = SIZE.landscape;
  const { type, rent, rentIsFrom } = shout(data);
  ctx.fillStyle = "#F7F2E6";
  ctx.fillRect(0, 0, W, H);

  // The house sits right; the sunburst comes from its door.
  const left = 600;
  const right = W - 64;
  const mid = (left + right) / 2;
  const apex = 70;
  const eave = 300;
  const floor = 760;

  ctx.save();
  ctx.translate(mid, 560);
  for (let i = 0; i < 28; i++) {
    ctx.rotate((Math.PI * 2) / 28);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-70, -1300);
    ctx.lineTo(70, -1300);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? "rgba(201,154,74,.07)" : "rgba(201,154,74,0)";
    ctx.fill();
  }
  ctx.restore();

  // Left: the knock, the line, the flat.
  ctx.save();
  ctx.font = `italic 600 ${fitSize(ctx, "Knock knock.", 490, 100, "italic 600", SERIF)}px ${SERIF}`;
  ctx.fillStyle = GOLD_DK;
  ctx.textAlign = "left";
  ctx.fillText("Knock knock.", 60, 200);
  ctx.restore();
  text(ctx, "Your next home is right here.", 64, 262, { size: 34, weight: 700, color: DEEP, maxWidth: 500 });
  const head = `${type} FOR RENT`;
  const hs = fitSize(ctx, head, 500, 62);
  spaced(ctx, head, 64, 410, { size: hs, color: DEEP, spacing: -hs * 0.02 });
  if (rent) text(ctx, `${rentIsFrom ? "from " : ""}${rent} / month`, 64, 462, { size: 34, weight: 700, color: GOLD_DK });
  spaced(ctx, "SCAN THE DOOR TO STEP INSIDE  →", 64, 540, { size: 20, color: DEEP, spacing: 2.2 });

  // The house.
  ctx.fillStyle = DEEP;
  ctx.fillRect(right - 150, 110, 52, 150);
  ctx.save();
  ctx.shadowColor = "rgba(4,36,26,.25)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.beginPath();
  ctx.moveTo(mid, apex);
  ctx.lineTo(right + 18, eave);
  ctx.lineTo(right, eave);
  ctx.lineTo(right, floor);
  ctx.lineTo(left, floor);
  ctx.lineTo(left, eave);
  ctx.lineTo(left - 18, eave);
  ctx.closePath();
  const hg = ctx.createLinearGradient(0, apex, 0, floor);
  hg.addColorStop(0, "#155C42");
  hg.addColorStop(1, DEEP2);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(left - 30, eave + 10);
  ctx.lineTo(mid, apex - 20);
  ctx.lineTo(right + 30, eave + 10);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Lit windows.
  const win = (x, y) => {
    roundRect(ctx, x, y, 62, 80, 7);
    ctx.fillStyle = "#F6D27A";
    ctx.fill();
    ctx.fillStyle = DEEP;
    ctx.fillRect(x + 28, y, 6, 80);
    ctx.fillRect(x, y + 37, 62, 6);
  };
  win(left + 14, 400);
  win(right - 14 - 62, 400);

  // The door: an arch, and the QR inside it.
  const dw = 320;
  const dx = mid - dw / 2;
  const dtop = 250;
  const r = dw / 2;
  ctx.beginPath();
  ctx.moveTo(dx, floor);
  ctx.lineTo(dx, dtop + r);
  ctx.arc(mid, dtop + r, r, Math.PI, 0);
  ctx.lineTo(dx + dw, floor);
  ctx.closePath();
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 7;
  ctx.stroke();
  spaced(ctx, "SCAN TO STEP INSIDE", mid, dtop + 88, { size: 16, color: DEEP, align: "center", spacing: 1.8 });
  const q = 272;
  drawQr(ctx, data.url, mid - q / 2, dtop + 112, q);
  ctx.beginPath();
  ctx.arc(dx + dw - 18, dtop + 112 + q / 2 + 30, 7, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();

  // Ground and brand.
  ctx.fillStyle = GOLD;
  ctx.fillRect(40, floor, W - 80, 6);
  if (data.logo) {
    const lh = 50;
    ctx.drawImage(data.logo, 64, 640, (data.logo.width / data.logo.height) * lh, lh);
  }
  spaced(ctx, "INDIA’S FIRST SPEED RENTING PLATFORM", W / 2, floor + 50, { size: 17, weight: 800, color: GOLD_DK, align: "center", spacing: 2.6 });
}

/** "2 BHK" → "2BHK", as the headline writes it. */
export const headlineBhk = (t) => String(t || "").replace(/\s+(BHK|RK)\b/i, "$1").trim();

/**
 * The white landscape poster. `data.headline`: { lead, accent, tail } — e.g.
 * "Premium", "2BHK", "for Rent"; the accent is set in gold.
 */
function drawClassic(ctx, { headline = {}, url, logo }) {
  const [W, H] = SIZE.landscape;
  const green = "#0B3D2C";
  const greenDeep = "#062A1E";

  // A white ground, a breath darker at the edges.
  const bg = ctx.createRadialGradient(W / 2, H * 0.45, 120, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, "#FFFFFF");
  bg.addColorStop(1, "#F1F2EF");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Bottom-left: overlapping greens and one gold line.
  ctx.save();
  const arc = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  arc(-250, 1010, 560, "rgba(214,222,214,.55)");
  const g1 = ctx.createLinearGradient(-120, 420, 260, 840);
  g1.addColorStop(0, "#1C6B4D");
  g1.addColorStop(1, greenDeep);
  arc(-330, 1030, 560, g1);
  arc(-300, 1130, 470, "rgba(120,170,140,.32)");
  arc(-260, 1230, 400, "rgba(255,255,255,.10)");
  ctx.beginPath();
  ctx.arc(-260, 1060, 640, -Math.PI / 2.2, 0.02);
  ctx.strokeStyle = "rgba(201,154,74,.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // The headline, fitted to the width: lead · accent (gold) · tail.
  const parts = [
    { t: headline.lead ?? "Premium", gold: false },
    { t: headline.accent ?? "Homes", gold: true },
    { t: headline.tail ?? "for Rent", gold: false },
  ].filter((p) => p.t);
  let size = 104;
  const gap = () => size * 0.22;
  const widthAt = () => {
    ctx.font = `700 ${size}px ${SERIF}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${-size * 0.02}px`;
    return parts.reduce((w, p) => w + ctx.measureText(p.t).width, 0) + gap() * (parts.length - 1);
  };
  while (size > 48 && widthAt() > W - 150) size -= 2;
  let x = (W - widthAt()) / 2;
  const base = 190;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const p of parts) {
    ctx.font = `700 ${size}px ${SERIF}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${-size * 0.02}px`;
    const w = ctx.measureText(p.t).width;
    if (p.gold) {
      const gg = ctx.createLinearGradient(x, base - size, x + w, base);
      gg.addColorStop(0, "#C08A3E");
      gg.addColorStop(0.5, "#D9A55A");
      gg.addColorStop(1, "#9C6B2C");
      ctx.fillStyle = gg;
    } else {
      ctx.fillStyle = greenDeep;
    }
    ctx.fillText(p.t, x, base);
    x += w + gap();
  }
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  // The code, in a white card with a deep green edge.
  const card = 372;
  const cx = (W - card) / 2;
  const cy = 236;
  ctx.save();
  ctx.shadowColor = "rgba(6,42,30,.20)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, cx, cy, card, card, 30);
  ctx.fillStyle = green;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, cx + 8, cy + 8, card - 16, card - 16, 23);
  ctx.fillStyle = "#fff";
  ctx.fill();
  drawQr(ctx, url, cx + 36, cy + 36, card - 72);

  // "Scan to View Property ↗" in a deep green pill.
  const label = "Scan to View Property";
  ctx.font = `600 30px ${FONT}`;
  const lw = ctx.measureText(label).width;
  const pw = lw + 46 + 70;
  const pxx = (W - pw) / 2;
  const py = cy + card + 40;
  const ph = 66;
  ctx.save();
  ctx.shadowColor = "rgba(6,42,30,.28)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, pxx, py, pw, ph, ph / 2);
  const pg = ctx.createLinearGradient(pxx, py, pxx, py + ph);
  pg.addColorStop(0, "#14533C");
  pg.addColorStop(1, greenDeep);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();
  text(ctx, label, pxx + 36, py + ph / 2 + 11, { size: 30, weight: 600, color: "#fff" });
  // The arrow, drawn so it doesn't depend on a font having it.
  const ax = pxx + 36 + lw + 26;
  const ay = py + ph / 2;
  ctx.save();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(ax, ay + 11);
  ctx.lineTo(ax + 22, ay - 11);
  ctx.moveTo(ax + 6, ay - 11);
  ctx.lineTo(ax + 22, ay - 11);
  ctx.lineTo(ax + 22, ay + 5);
  ctx.stroke();
  ctx.restore();

  // Bottom right: the wordmark, "Assured Property", a gold rule, the line.
  const rx = W - 210;
  if (logo) {
    const lh = 54;
    const lwid = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, rx - lwid / 2, 640, lwid, lh);
  }
  text(ctx, "Assured Property", rx, 726, { size: 21, weight: 600, color: "#2B3A34", align: "center" });
  ctx.fillStyle = "rgba(192,138,62,.85)";
  ctx.fillRect(rx - 175, 744, 350, 1.5);
  ctx.save();
  ctx.font = `700 13px ${FONT}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
  ctx.fillStyle = "#B07D35";
  ctx.textAlign = "center";
  ctx.fillText("INDIA’S FIRST SPEED RENTING PLATFORM", rx, 774);
  ctx.restore();
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
  else if (id === "classic") drawClassic(ctx, data);
  else if (id === "street") drawStreet(ctx, data);
  else if (id === "speed") drawSpeed(ctx, data);
  else if (id === "door") drawDoor(ctx, data);
  else if (id === "building" || id === "flat") drawBuilding(ctx, data);
  else drawProfile(ctx, data);
  return canvas;
}

/** The poster as a PDF Blob: A4 at about 200 dpi, A1 at about 145 dpi. */
export async function posterPdf(design, data) {
  const { paper = "A4" } = designOf(design);
  const canvas = drawPoster(document.createElement("canvas"), design, data, paper === "A1" ? 4 : 2);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the poster"))), "image/jpeg", 0.92));
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height, designOf(design).orientation, paper);
  return new Blob([pdf], { type: "application/pdf" });
}
