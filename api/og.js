/**
 * The picture WhatsApp shows for a shared property.
 *
 * A link preview gets exactly one image, so "four photos" means compositing them
 * into one — a 2×2 grid, or the best arrangement for however many the listing
 * actually has. Rendered on demand and cached hard at the edge, so only the
 * first fetch of a given link costs anything.
 *
 * Written with a tiny `h()` helper rather than JSX on purpose: this is a plain
 * Vite project, not Next, so nothing here is guaranteed to run a JSX transform
 * over /api. Satori accepts these plain element objects directly.
 */
import { ImageResponse } from "@vercel/og";
import { fetchListing, photosOf, inr } from "./_listing.js";

export const config = { runtime: "edge" };

/**
 * Satori cannot lay out a single character without a real font file, and unlike
 * the Next.js integration nothing bundles one for us here — without this the
 * renderer fails and returns a zero-byte PNG, which previews as a broken image.
 * Fetched once per warm instance from the same Inter the site ships.
 */
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff";
let fontCache = null;

async function interBold() {
  if (!fontCache) {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
    fontCache = await res.arrayBuffer();
  }
  return fontCache;
}

const h = (type, props = {}, ...children) => ({
  type,
  props: { ...props, children: children.flat().filter((c) => c !== null && c !== false) },
  key: null,
});

const INK = "#04211D";
const MINT = "#5EEAD4";
const CREAM = "#F4F2ED";
const W = 1200;
const H = 630;
const GAP = 6;

const tile = (src, width, height) =>
  h(
    "div",
    { style: { display: "flex", width, height, overflow: "hidden", background: "#0A2B25" } },
    h("img", { src, width, height, style: { objectFit: "cover" } }),
  );

/**
 * Arrange 1–4 photos so none of them look like a mistake: one fills the frame,
 * two split it, three give the first the left half, four make a grid.
 */
function collage(photos) {
  if (photos.length === 1) return tile(photos[0], W, H);

  const halfW = (W - GAP) / 2;
  const halfH = (H - GAP) / 2;

  if (photos.length === 2) {
    return h(
      "div",
      { style: { display: "flex", width: W, height: H, gap: GAP } },
      tile(photos[0], halfW, H),
      tile(photos[1], halfW, H),
    );
  }
  if (photos.length === 3) {
    return h(
      "div",
      { style: { display: "flex", width: W, height: H, gap: GAP } },
      tile(photos[0], halfW, H),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", width: halfW, height: H, gap: GAP } },
        tile(photos[1], halfW, halfH),
        tile(photos[2], halfW, halfH),
      ),
    );
  }
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", width: W, height: H, gap: GAP } },
    photos.slice(0, 4).map((src) => tile(src, halfW, halfH)),
  );
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const listing = await fetchListing(searchParams.get("listingId"));
  const photos = photosOf(listing, 4);

  const rent = inr(listing?.rent);
  const line = [listing?.flat_type, listing?.area].filter(Boolean).join(" · ");

  const body = photos.length
    ? collage(photos)
    : h(
        "div",
        {
          style: {
            display: "flex", width: W, height: H, alignItems: "center",
            justifyContent: "center", background: INK, color: MINT,
            fontSize: 64, fontWeight: 700,
          },
        },
        "MovEazy",
      );

  // Price burned into the image: a WhatsApp preview truncates the caption on a
  // narrow screen, but the picture always shows in full.
  const overlay =
    rent || line
      ? h(
          "div",
          {
            style: {
              position: "absolute", left: 0, right: 0, bottom: 0,
              display: "flex", alignItems: "flex-end", justifyContent: "space-between",
              padding: "28px 36px",
              background: "linear-gradient(transparent, rgba(4,33,29,0.92))",
            },
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column" } },
            rent && h("div", { style: { color: CREAM, fontSize: 60, fontWeight: 700 } }, rent),
            line && h("div", { style: { color: MINT, fontSize: 30, marginTop: 6 } }, line),
          ),
          h("div", { style: { color: CREAM, fontSize: 26, opacity: 0.85 } }, "moveazy.co.in"),
        )
      : null;

  const image = h(
    "div",
    { style: { display: "flex", position: "relative", width: W, height: H, background: INK, fontFamily: "Inter" } },
    body,
    overlay,
  );

  const cache = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

  try {
    return new ImageResponse(image, {
      width: W,
      height: H,
      fonts: [{ name: "Inter", data: await interBold(), weight: 700, style: "normal" }],
      headers: { "cache-control": cache },
    });
  } catch {
    // Never hand a crawler a broken image. One real photo of the flat beats a
    // zero-byte PNG, and the logo beats nothing at all.
    const fallback = photos[0] || `${new URL(req.url).origin}/logo-moveazy-bar.png`;
    return new Response(null, {
      status: 302,
      headers: { location: fallback, "cache-control": "public, max-age=60" },
    });
  }
}
