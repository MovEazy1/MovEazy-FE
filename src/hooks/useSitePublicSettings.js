import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "../lib/firebase";
import { DEFAULT_SITE_PUBLIC, fetchSitePublicSettings } from "../lib/sitePublicSettings";

export function useSitePublicSettings() {
  const [sitePublic, setSitePublic] = useState(() => ({
    ...DEFAULT_SITE_PUBLIC,
    contacts: [...DEFAULT_SITE_PUBLIC.contacts],
  }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!isFirebaseConfigured) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        const d = await fetchSitePublicSettings();
        if (alive) {
          setSitePublic({ ...d, contacts: [...(d.contacts || [])] });
        }
      } catch {
        /* keep defaults */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { sitePublic, loading };
}
