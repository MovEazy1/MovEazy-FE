import { useState, useEffect } from "react";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { storage } from "../lib/firebase";

// "listings/abc-ts-nonce.jpg" → "listings/abc/abc-ts-nonce.jpg"
function toFolderPath(flatPath) {
  const m = flatPath.match(/^(listings\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(-.+)$/i);
  if (m) return `${m[1]}${m[2]}/${m[2]}${m[3]}`;
  return null;
}

export default function SmartImage({ src, alt = "", className, style, loading = "lazy", listingId, ...rest }) {
  const [resolvedSrc, setResolvedSrc] = useState(null);

  useEffect(() => {
    let active = true;
    setResolvedSrc(null);
    (async () => {
      if (!src) return;
      try {
        // Non-http path — Firebase Storage path (may be flat or folder-based)
        if (!/^https?:\/\//i.test(src)) {
          // Try folder path first: "listings/uuid-ts-nonce.jpg" → "listings/uuid/uuid-ts-nonce.jpg"
          const folderPath = toFolderPath(src);
          if (folderPath) {
            try {
              const url = await getDownloadURL(ref(storage, folderPath));
              if (active && url) { setResolvedSrc(url); return; }
            } catch { /* try next path */ }
          }
          // Try path as-is (flat)
          try {
            const url = await getDownloadURL(ref(storage, src));
            if (active && url) { setResolvedSrc(url); return; }
          } catch { /* try next path */ }
          // Last resort: listAll on listing folder and use first file
          if (listingId) {
            try {
              const { items } = await listAll(ref(storage, `listings/${listingId}`));
              if (items.length > 0) {
                const url = await getDownloadURL(items[0]);
                if (active && url) { setResolvedSrc(url); return; }
              }
            } catch { /* try next path */ }
          }
        }
        // Old Flatx CDN URL — use listAll on listing folder, fall back to flat paths
        if (/flatxstoragev1\.blob\.core\.windows\.net/i.test(src)) {
          if (listingId) {
            try {
              const { items } = await listAll(ref(storage, `listings/${listingId}`));
              if (items.length > 0) {
                const url = await getDownloadURL(items[0]);
                if (active && url) { setResolvedSrc(url); return; }
              }
            } catch { /* try next path */ }
          }
          const filename = src.split("/").pop().split("?")[0];
          for (const p of [`listings/${filename}`, `listings-images/${filename}`]) {
            try {
              const url = await getDownloadURL(ref(storage, p));
              if (active && url) { setResolvedSrc(url); return; }
            } catch { /* try next path */ }
          }
        }
      } catch { /* resolution failed — fall back to raw src */ }
    })();
    return () => { active = false; };
  }, [src, listingId]);

  return <img src={resolvedSrc || src} alt={alt} className={className} style={style} loading={loading} {...rest} />;
}
