/**
 * "Arrange photos" — the screen between Submit and publishing, on every upload
 * channel (CRM, owner app, partner app, List my flat; flats and buildings).
 *
 *   - swipe through the photos full-size, the way a renter will see them;
 *   - drag the strip at the bottom to change their order;
 *   - pick the cover and frame it: a 4:3 frame, slid and zoomed (pinch, wheel
 *     or the slider) until the right part shows. It starts on the first photo,
 *     centred, so a poster who only reorders still gets a sensible cover.
 *
 * Presentation only: the caller passes its items ({ key, src, isVideo }) and
 * gets back { order: keys, cover: { key, crop } }; it uploads the framed cover
 * itself (lib/coverCrop.js makeCoverBlob + lib/inventory.js uploadCoverImage).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { moveByKey, useDragReorder } from "../hooks/useDragReorder";
import { COVER_ASPECT, DEFAULT_CROP, MAX_ZOOM, clampCrop, cropRect } from "../lib/coverCrop";

/** The framed part of a photo, drawn with CSS (no canvas until publishing). */
function Framed({ src, crop, natural, width }) {
  if (!natural) return <div style={{ width, height: width / COVER_ASPECT, background: "#222" }} />;
  const { sx, sy, sw } = cropRect(natural.w, natural.h, crop);
  const s = width / sw;
  return (
    <div style={{ position: "relative", width, height: width / COVER_ASPECT, overflow: "hidden", background: "#111" }}>
      <img src={src} alt="" draggable={false}
        style={{ position: "absolute", left: -sx * s, top: -sy * s, width: natural.w * s, height: natural.h * s, maxWidth: "none", pointerEvents: "none" }} />
    </div>
  );
}

/** Slide and zoom the 4:3 frame over one photo. */
function CropEditor({ src, natural, initial, onDone, onCancel }) {
  const [crop, setCrop] = useState(() => clampCrop(natural.w, natural.h, initial));
  const box = useRef(null);
  const [vw, setVw] = useState(320);
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  useEffect(() => {
    const fit = () => setVw(Math.min(640, (box.current?.parentElement?.clientWidth || window.innerWidth) - 32));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const { sx, sy, sw } = cropRect(natural.w, natural.h, crop);
  const s = vw / sw;
  const set = (next) => setCrop(clampCrop(natural.w, natural.h, next));

  const start = () => {
    const pts = [...pointers.current.values()];
    gesture.current = {
      crop,
      pts: pts.map((p) => ({ ...p })),
      dist: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
    };
  };
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start();
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length > 1 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      set({ ...g.crop, zoom: g.crop.zoom * (d / g.dist) });
    } else {
      const p0 = g.pts[0];
      const scale = vw / cropRect(natural.w, natural.h, g.crop).sw;
      set({ ...g.crop, cx: g.crop.cx - (pts[0].x - p0.x) / (scale * natural.w), cy: g.crop.cy - (pts[0].y - p0.y) / (scale * natural.h) });
    }
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) start(); else gesture.current = null;
  };
  const onWheel = (e) => set({ ...crop, zoom: crop.zoom * (1 - e.deltaY * 0.0015) });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%" }} ref={box}>
      <p style={{ margin: 0, color: "#d1d5db", fontSize: 13.5 }}>Drag to move · pinch or scroll to zoom</p>
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
        style={{ position: "relative", width: vw, height: vw / COVER_ASPECT, overflow: "hidden", borderRadius: 12, touchAction: "none", cursor: "grab", background: "#111" }}
      >
        <img src={src} alt="" draggable={false}
          style={{ position: "absolute", left: -sx * s, top: -sy * s, width: natural.w * s, height: natural.h * s, maxWidth: "none", userSelect: "none", pointerEvents: "none" }} />
        {/* Thirds, like a camera's grid: where a doorway or a window sits best. */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(to right, transparent 33.2%, rgba(255,255,255,.45) 33.3%, transparent 33.4%, transparent 66.6%, rgba(255,255,255,.45) 66.7%, transparent 66.8%), linear-gradient(to bottom, transparent 33.2%, rgba(255,255,255,.45) 33.3%, transparent 33.4%, transparent 66.6%, rgba(255,255,255,.45) 66.7%, transparent 66.8%)",
          boxShadow: "inset 0 0 0 2px rgba(255,255,255,.85)", borderRadius: 12 }} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, color: "#e5e7eb", fontSize: 13, width: vw }}>
        Zoom
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} aria-label="Zoom"
          onChange={(e) => set({ ...crop, zoom: Number(e.target.value) })} style={{ flex: 1 }} />
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="pr-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="pr-btn pr-btn--go" onClick={() => onDone(crop)}>Use this frame</button>
      </div>
    </div>
  );
}

export default function PhotoReview({ items, initialCover = null, onConfirm, onCancel, confirmLabel = "Publish", busy = false, title = "Arrange photos" }) {
  const [order, setOrder] = useState(() => items.map((m) => m.key));
  const byKey = useMemo(() => new Map(items.map((m) => [m.key, m])), [items]);
  const firstPhoto = order.find((k) => !byKey.get(k)?.isVideo);
  const [cover, setCover] = useState(() =>
    initialCover && byKey.has(initialCover.key) && !byKey.get(initialCover.key)?.isVideo
      ? initialCover : (firstPhoto ? { key: firstPhoto, crop: { ...DEFAULT_CROP } } : null));
  const [index, setIndex] = useState(0);
  const [cropping, setCropping] = useState(false);
  const [natural, setNatural] = useState({}); // key -> { w, h }
  const track = useRef(null);
  const sort = useDragReorder((from, to) => setOrder((cur) => moveByKey(cur, from, to)));

  // Natural sizes, for framing (and so the frame survives a reorder).
  useEffect(() => {
    let alive = true;
    for (const m of items) {
      if (m.isVideo || natural[m.key]) continue;
      const img = new Image();
      img.onload = () => alive && setNatural((n) => ({ ...n, [m.key]: { w: img.naturalWidth, h: img.naturalHeight } }));
      img.src = m.src;
    }
    return () => { alive = false; };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e) => { if (e.key === "Escape" && !busy) (cropping ? setCropping(false) : onCancel()); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [busy, cropping, onCancel]);

  const go = (i) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(order.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    setIndex(n);
  };
  const currentKey = order[index];
  const current = byKey.get(currentKey);
  const isCover = cover?.key === currentKey;
  const coverItem = cover ? byKey.get(cover.key) : null;

  const node = (
    <div className="pr" role="dialog" aria-modal="true" aria-label={title}>
      <style>{CSS}</style>
      <header className="pr-top">
        <button type="button" className="pr-link" onClick={cropping ? () => setCropping(false) : onCancel} disabled={busy}>
          ‹ {cropping ? "Back" : "Edit"}
        </button>
        <strong>{cropping ? "Frame the cover" : title}</strong>
        {cropping ? <span style={{ width: 60 }} /> : (
          <button type="button" className="pr-btn pr-btn--go" disabled={busy || !order.length}
            onClick={() => onConfirm({ order, cover })}>
            {busy ? "Saving…" : confirmLabel}
          </button>
        )}
      </header>

      {cropping && coverItem && natural[coverItem.key] ? (
        <div className="pr-body">
          <CropEditor src={coverItem.src} natural={natural[coverItem.key]} initial={cover.key === currentKey ? cover.crop : DEFAULT_CROP}
            onCancel={() => setCropping(false)}
            onDone={(crop) => { setCover({ key: coverItem.key, crop }); setCropping(false); }} />
        </div>
      ) : (
        <div className="pr-body">
          <div className="pr-stage">
            <div className="pr-track" ref={track}
              onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}>
              {order.map((k) => {
                const m = byKey.get(k);
                return (
                  <div key={k} className="pr-slide">
                    {m.isVideo
                      ? <video src={m.src} muted playsInline controls preload="metadata" />
                      : <img src={m.src} alt="" draggable={false} />}
                  </div>
                );
              })}
            </div>
            {order.length > 1 && (
              <>
                <button type="button" className="pr-nav pr-nav--l" aria-label="Previous photo" onClick={() => go(index - 1)} disabled={index === 0}>‹</button>
                <button type="button" className="pr-nav pr-nav--r" aria-label="Next photo" onClick={() => go(index + 1)} disabled={index === order.length - 1}>›</button>
              </>
            )}
            <span className="pr-count">{index + 1}/{order.length}</span>
            {isCover && <span className="pr-badge">★ Cover</span>}
          </div>

          <div className="pr-actions">
            {coverItem && (
              <button type="button" className="pr-cover" title="The cover — how the listing shows on cards and in WhatsApp"
                onClick={() => go(order.indexOf(cover.key))}>
                <Framed src={coverItem.src} crop={cover.crop} natural={natural[coverItem.key]} width={104} />
                <span>Cover</span>
              </button>
            )}
            {current && !current.isVideo && (isCover ? (
              <button type="button" className="pr-btn" onClick={() => setCropping(true)} disabled={!natural[currentKey]}>Adjust cover frame</button>
            ) : (
              <button type="button" className="pr-btn" disabled={!natural[currentKey]}
                onClick={() => { setCover({ key: currentKey, crop: { ...DEFAULT_CROP } }); setCropping(true); }}>
                ★ Make this the cover
              </button>
            ))}
            {current?.isVideo && <span className="pr-hint">Videos play in the gallery; the cover is a photo.</span>}
          </div>

          <div className="pr-strip" aria-label="Drag to reorder">
            {order.map((k, i) => {
              const m = byKey.get(k);
              return (
                <div key={k} {...sort.bind(k)} className={`pr-thumb${i === index ? " is-on" : ""}`}
                  style={sort.dragStyle(k)} onClick={() => go(i)}>
                  {m.isVideo ? <video src={m.src} muted preload="metadata" /> : <img src={m.src} alt="" draggable={false} />}
                  {cover?.key === k && <span className="pr-star">★</span>}
                  <span className="pr-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
          <p className="pr-hint" style={{ textAlign: "center" }}>Swipe to look through · drag the photos below to change their order</p>
        </div>
      )}
    </div>
  );
  return createPortal(node, document.body);
}

const CSS = `
.pr { position: fixed; inset: 0; z-index: 2147482000; background: #0b0b0c; color: #fff; display: flex; flex-direction: column; font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
.pr-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #222; }
.pr-top strong { font-size: 16px; }
.pr-link { background: none; border: 0; color: #e5e7eb; font: inherit; font-size: 15px; cursor: pointer; padding: 6px 4px; }
.pr-btn { border: 1px solid #3f3f46; background: #18181b; color: #fff; border-radius: 10px; padding: 9px 14px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.pr-btn:disabled { opacity: .5; cursor: default; }
.pr-btn--go { background: #10B981; border-color: #10B981; color: #04221a; }
.pr-body { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 0 12px; overflow-y: auto; }
.pr-stage { position: relative; width: 100%; max-width: 900px; }
.pr-track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.pr-track::-webkit-scrollbar { display: none; }
.pr-slide { flex: 0 0 100%; scroll-snap-align: center; height: min(46vh, 560px); display: grid; place-items: center; }
.pr-slide img, .pr-slide video { max-width: 100%; max-height: 100%; object-fit: contain; user-select: none; }
.pr-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 99px; border: 0; background: rgba(0,0,0,.55); color: #fff; font-size: 24px; cursor: pointer; }
.pr-nav:disabled { opacity: .25; }
.pr-nav--l { left: 10px; } .pr-nav--r { right: 10px; }
.pr-count { position: absolute; right: 12px; bottom: 10px; background: rgba(0,0,0,.6); border-radius: 99px; padding: 3px 10px; font-size: 12.5px; }
.pr-badge { position: absolute; left: 12px; bottom: 10px; background: #F5C542; color: #1f1605; border-radius: 99px; padding: 3px 10px; font-size: 12.5px; font-weight: 700; }
.pr-actions { display: flex; gap: 14px; align-items: center; justify-content: center; min-height: 40px; flex-wrap: wrap; padding: 0 16px; }
.pr-cover { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: 0; padding: 0; color: #F5C542; font: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; }
.pr-cover > div { border-radius: 8px; box-shadow: 0 0 0 2px #F5C542; }
.pr-hint { color: #a1a1aa; font-size: 12.5px; margin: 0; padding: 0 16px; }
.pr-strip { display: flex; gap: 8px; overflow-x: auto; padding: 4px 16px; max-width: 100%; }
.pr-thumb { position: relative; flex: none; width: 64px; height: 64px; border-radius: 10px; overflow: hidden; border: 2px solid transparent; background: #222; }
.pr-thumb.is-on { border-color: #fff; }
.pr-thumb img, .pr-thumb video { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.pr-star { position: absolute; top: 2px; left: 4px; color: #F5C542; font-size: 15px; text-shadow: 0 1px 2px #000; }
.pr-num { position: absolute; right: 3px; bottom: 2px; font-size: 10.5px; font-weight: 700; background: rgba(0,0,0,.6); border-radius: 6px; padding: 0 4px; }
`;
