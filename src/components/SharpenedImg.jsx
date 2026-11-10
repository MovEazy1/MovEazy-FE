import { useEffect, useState } from "react";
import { thumbUrl } from "../lib/imageShrink";

/**
 * A photo at the top of a page, drawn at once from its 480 px thumbnail
 * (~25 KB — the copy the page's HTML already asked for, api/property-page.js
 * and api/share.js), then swapped for the full photo (~100–250 KB) once that
 * has arrived. Over 4G the photo shows in a moment instead of after the big
 * file, and still ends up sharp. No thumbnail: the photo itself. `onError`
 * hears only when the full photo fails too.
 */
export default function SharpenedImg({ src, onError, ...rest }) {
  const small = thumbUrl(src);
  const [sharp, setSharp] = useState(small === src);
  const [forSrc, setForSrc] = useState(src);
  if (forSrc !== src) { setForSrc(src); setSharp(small === src); }
  useEffect(() => {
    if (sharp) return undefined;
    let live = true;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => { if (live) setSharp(true); };
    img.src = src;
    return () => { live = false; img.onload = null; };
  }, [src, sharp]);
  return <img src={sharp ? src : small} onError={(e) => (sharp ? onError?.(e) : setSharp(true))} {...rest} />;
}
