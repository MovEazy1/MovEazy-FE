/**
 * A flat's photos, full screen — opened by tapping a photo on any flat page
 * (the renter's property view, building QR pages, the partner and owner apps).
 *
 *   - swipe sideways through them (arrows and ← → on a laptop);
 *   - pinch or double-tap to zoom in, drag to look around a zoomed photo
 *     (ctrl/⌘ + wheel or a trackpad pinch on a laptop);
 *   - swipe down to close, or ×, Esc, or the phone's back;
 *   - "3 / 12" at the top, and the thumbnails at the bottom to jump around.
 *
 * Videos play in place and aren't zoomed. Only the photo on screen and its two
 * neighbours are loaded; the strip uses the small thumbnail copies.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useSnapTrack } from "../hooks/useSnapTrack";
import { useBackClose } from "../hooks/useBackClose";
import { isVideoUrl } from "../lib/listingMedia";
import {
  NO_ZOOM, clampPan, containSize, doubleTapZoom, pinchTo, swipeDownCloses, zoomAround,
} from "../lib/photoGestures";
import ThumbImg from "./ThumbImg";
import SmartImage from "./SmartImage";

const Img = ({ src, alt }) => (/^https?:\/\//i.test(src) || src.startsWith("blob:")
  ? <img src={src} alt={alt} draggable={false} />
  : <SmartImage src={src} alt={alt} loading="eager" />);

/** One photo: pinch, double-tap and drag to zoom; drag down to close. */
function ZoomPhoto({ src, alt, active, onZoomed, onPull, onPullEnd }) {
  const box = useRef(null);
  const pic = useRef(null);
  const z = useRef(NO_ZOOM);
  const zoomedRef = useRef(false);
  const pts = useRef(new Map());
  const g = useRef(null);
  const lastTap = useRef(null);
  const [zoomed, setZoomed] = useState(false);

  const measure = () => {
    const b = box.current.getBoundingClientRect();
    const img = pic.current.querySelector("img");
    return { b, box: { w: b.width, h: b.height }, pic: containSize(img?.naturalWidth, img?.naturalHeight, b.width, b.height) };
  };
  const at = (e, b) => ({ x: e.clientX - (b.left + b.width / 2), y: e.clientY - (b.top + b.height / 2) });
  const apply = (next, animate = false) => {
    const m = measure();
    const c = next.s <= 1.001 ? NO_ZOOM : clampPan(next, m.pic, m.box);
    z.current = c;
    pic.current.style.transition = animate ? "transform .25s ease" : "none";
    pic.current.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.s})`;
    const on = c.s > 1.001;
    if (on !== zoomedRef.current) {
      zoomedRef.current = on;
      setZoomed(on);
      onZoomed(on);
    }
  };

  // Swiped away: back to the whole photo for when they come back to it.
  useEffect(() => {
    if (!active && zoomedRef.current) apply(NO_ZOOM);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // A trackpad pinch arrives as ctrl + wheel; a zoomed photo pans on the wheel.
  useEffect(() => {
    const el = box.current;
    const wheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        apply(zoomAround(z.current, at(e, el.getBoundingClientRect()), z.current.s * Math.exp(-e.deltaY * 0.01)));
      } else if (zoomedRef.current) {
        e.preventDefault();
        apply({ ...z.current, x: z.current.x - e.deltaX, y: z.current.y - e.deltaY });
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pinchStart = () => {
    const [a, b] = [...pts.current.values()];
    const r = box.current.getBoundingClientRect();
    g.current = {
      type: "pinch", z: z.current, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      m0: at({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }, r),
    };
  };
  const down = (e) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      pinchStart();
    } else if (pts.current.size === 1) {
      g.current = { type: "one", x: e.clientX, y: e.clientY, z: z.current, t: performance.now(), moved: false, pull: false };
    }
    if (zoomedRef.current || pts.current.size === 2) {
      try { box.current.setPointerCapture(e.pointerId); } catch { /* gone already */ }
    }
  };
  const move = (e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = g.current;
    if (!s) return;
    if (s.type === "pinch" && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const m1 = at({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }, box.current.getBoundingClientRect());
      apply(pinchTo(s.z, s.m0, m1, Math.hypot(a.x - b.x, a.y - b.y) / s.d0));
      return;
    }
    if (s.type !== "one") return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) s.moved = true;
    if (zoomedRef.current) {
      apply({ ...s.z, x: s.z.x + dx, y: s.z.y + dy });
    } else if (s.pull || (dy > 10 && Math.abs(dy) > Math.abs(dx) * 1.2)) {
      s.pull = true;
      const d = Math.max(0, dy);
      pic.current.style.transition = "none";
      pic.current.style.transform = `translate3d(${dx * 0.3}px, ${d}px, 0) scale(${1 - Math.min(d / 1600, 0.2)})`;
      onPull(d);
    }
  };
  const up = (e, cancelled = false) => {
    if (!pts.current.delete(e.pointerId)) return;
    const s = g.current;
    if (!s) return;
    if (s.type === "pinch") {
      if (pts.current.size === 1) {
        // One finger left on the glass carries on as a drag.
        const [p] = [...pts.current.values()];
        g.current = { type: "one", x: p.x, y: p.y, z: z.current, t: performance.now(), moved: true, pull: false };
      } else if (pts.current.size === 0) {
        g.current = null;
        if (z.current.s < 1.05) apply(NO_ZOOM, true);
      }
      return;
    }
    g.current = null;
    if (s.pull) {
      const dy = e.clientY - s.y;
      const close = !cancelled && swipeDownCloses(dy, performance.now() - s.t);
      if (!close) apply(NO_ZOOM, true);
      onPullEnd(close);
      return;
    }
    if (cancelled || s.moved) return;
    const now = performance.now();
    const t = lastTap.current;
    if (t && now - t.t < 320 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 40) {
      lastTap.current = null;
      apply(doubleTapZoom(z.current, at(e, box.current.getBoundingClientRect())), true);
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  return (
    <div ref={box} className="pv-slide" style={{ touchAction: zoomed ? "none" : "pan-x" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={(e) => up(e)} onPointerCancel={(e) => up(e, true)}>
      <div ref={pic} className="pv-pic"><Img src={src} alt={alt} /></div>
    </div>
  );
}

/**
 * @param {string[]} media    the flat's photos and videos, in order
 * @param {number}   start    which one was tapped
 * @param {string}   title    shown small at the top
 * @param {() => void} onClose
 */
export default function PhotoViewer({ media, start = 0, title = "", onClose }) {
  const [zoomed, setZoomed] = useState(false);
  const [pull, setPull] = useState(0);
  const { index, goTo, trackProps } = useSnapTrack({ disabled: zoomed });
  const strip = useRef(null);
  const n = media.length;
  useBackClose(true, onClose, "photos");

  useLayoutEffect(() => { goTo(start, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Capture, so Esc closes the photos and not the sheet underneath too.
    const key = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [index, goTo, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keep the current thumbnail in the middle of the strip.
  useEffect(() => {
    const el = strip.current;
    const th = el?.children[index];
    if (th) el.scrollTo({ left: th.offsetLeft - el.clientWidth / 2 + th.clientWidth / 2, behavior: "smooth" });
  }, [index]);

  const fade = Math.min(pull / 320, 0.75);
  const chrome = { opacity: pull ? 0 : 1, transition: "opacity .15s" };

  return createPortal(
    <div className="pv" role="dialog" aria-modal="true" aria-label={title ? `Photos of ${title}` : "Photos"}
      style={{ background: `rgba(0,0,0,${1 - fade})` }}>
      <style>{CSS}</style>
      <div className="pv-top" style={chrome}>
        <span className="pv-count">{index + 1} / {n}</span>
        <span className="pv-title">{title}</span>
        <button type="button" className="pv-x" aria-label="Close photos" onClick={onClose}><X size={22} /></button>
      </div>

      <div className="pv-body">
        <div className="mz-snap pv-track" {...trackProps} style={zoomed ? { overflowX: "hidden" } : undefined}>
          {media.map((src, i) => {
            if (Math.abs(i - index) > 1) return <div key={`${src}-${i}`} className="pv-slide" />;
            if (isVideoUrl(src)) {
              return (
                <div key={`${src}-${i}`} className="pv-slide">
                  <div className="pv-pic"><video src={src} controls playsInline preload="metadata" /></div>
                </div>
              );
            }
            return (
              <ZoomPhoto key={`${src}-${i}`} src={src} alt={i === 0 ? title : ""} active={i === index}
                onZoomed={setZoomed} onPull={setPull}
                onPullEnd={(close) => (close ? onClose() : setPull(0))} />
            );
          })}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="pv-nav pv-prev" aria-label="Previous photo" style={chrome}
              disabled={index === 0} onClick={() => goTo(index - 1)}><ChevronLeft size={26} /></button>
            <button type="button" className="pv-nav pv-next" aria-label="Next photo" style={chrome}
              disabled={index === n - 1} onClick={() => goTo(index + 1)}><ChevronRight size={26} /></button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="pv-strip" ref={strip} style={chrome}>
          {media.map((src, i) => (
            <button key={`${src}-${i}`} type="button" className={`pv-th${i === index ? " on" : ""}`}
              aria-label={`Photo ${i + 1}`} aria-current={i === index} onClick={() => goTo(i)}>
              {isVideoUrl(src)
                ? <span className="pv-play"><Play size={18} fill="#fff" /></span>
                : /^https?:\/\//i.test(src) ? <ThumbImg src={src} alt="" draggable={false} /> : <SmartImage src={src} alt="" />}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

const CSS = `
.pv { position: fixed; inset: 0; z-index: 2147483000; display: flex; flex-direction: column; color: #fff;
  overscroll-behavior: contain; -webkit-tap-highlight-color: transparent; font-family: inherit; }
.pv-top { display: flex; align-items: center; gap: 12px; padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 8px 16px; }
.pv-count { font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
.pv-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .75; font-size: 13px; }
.pv-x { width: 42px; height: 42px; border-radius: 99px; border: 0; background: rgba(255,255,255,.14); color: #fff;
  display: grid; place-items: center; cursor: pointer; flex: none; }
.pv-body { position: relative; flex: 1; min-height: 0; display: flex; }
.pv-track { flex: 1; min-width: 0; height: 100%; }
.pv-slide { position: relative; height: 100%; overflow: hidden; }
.pv-pic { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  transform-origin: 50% 50%; will-change: transform; }
.pv-pic img, .pv-pic video { width: 100%; height: 100%; object-fit: contain; display: block; user-select: none; -webkit-user-drag: none; }
.pv-nav { position: absolute; top: 50%; margin-top: -23px; width: 46px; height: 46px; border-radius: 99px; border: 0;
  background: rgba(255,255,255,.16); color: #fff; display: grid; place-items: center; cursor: pointer; z-index: 2; }
.pv-nav:hover:not(:disabled) { background: rgba(255,255,255,.28); }
.pv-nav:disabled { opacity: .25 !important; cursor: default; }
.pv-prev { left: 14px; } .pv-next { right: 14px; }
@media (hover: none) { .pv-nav { display: none; } }
.pv-strip { display: flex; gap: 6px; overflow-x: auto; padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 12px); scrollbar-width: none; flex: none; }
.pv-strip::-webkit-scrollbar { display: none; }
.pv-th { flex: 0 0 auto; width: 58px; height: 58px; border-radius: 9px; overflow: hidden; border: 2px solid transparent; padding: 0;
  background: #222; opacity: .5; cursor: pointer; position: relative; transition: opacity .15s, border-color .15s; }
.pv-th:first-child { margin-left: auto; } .pv-th:last-child { margin-right: auto; }
.pv-th.on { border-color: #fff; opacity: 1; }
.pv-th img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pv-play { position: absolute; inset: 0; display: grid; place-items: center; background: #333; }
`;
