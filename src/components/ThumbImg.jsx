import { useState } from "react";
import { thumbUrl } from "../lib/imageShrink";

/**
 * A listing photo shown small (a card, a list row, a table tile): its 480 px
 * thumbnail, ~35 KB instead of the full photo. A photo without a thumbnail —
 * uploaded before they existed, or hosted elsewhere — falls back to itself,
 * and `onBroken` hears when that fails too.
 */
export default function ThumbImg({ src, onBroken, loading = "lazy", ...rest }) {
  const small = thumbUrl(src);
  const [current, setCurrent] = useState(small);
  const [forSrc, setForSrc] = useState(src);
  if (forSrc !== src) { setForSrc(src); setCurrent(small); }
  const fail = () => {
    if (current !== src) setCurrent(src);
    else onBroken?.();
  };
  return <img src={current} loading={loading} onError={fail} {...rest} />;
}
