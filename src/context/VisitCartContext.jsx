import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

/**
 * The "site visit" cart — listings the user added to visit. Persisted to
 * localStorage per user so it survives navigation/refresh. Each item keeps a
 * lightweight snapshot of the listing so the /visits page can render without
 * refetching. Scheduling status lives in the DB (visit_bookings); the cart is
 * just the set of listings the user is considering visiting.
 */
const VisitCartContext = createContext(null);

const keyFor = (uid) => `moveazy_visit_cart_${uid || "guest"}`;

function snapshot(listing) {
  return {
    property_id: listing.property_id,
    title: listing.title || `${listing.flat_type || "Home"} in ${listing.area || "Bengaluru"}`,
    area: listing.area,
    flat_type: listing.flat_type,
    rent: listing.rent,
    cover: listing.cover_image_url || (Array.isArray(listing.images) ? listing.images[0] : "") || "",
    latitude: listing.latitude,
    longitude: listing.longitude,
    landmark: listing.landmark,
  };
}

export function VisitCartProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid || "guest";
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(uid));
      setItems(raw ? JSON.parse(raw) : []);
    } catch { setItems([]); }
  }, [uid]);

  // Every mutation writes localStorage inside the updater — no persist-effect race.
  const write = useCallback((updater) => {
    setItems((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(keyFor(uid), JSON.stringify(next)); } catch { /* ignore quota */ }
      return next;
    });
  }, [uid]);

  const add = useCallback((listing) => {
    if (!listing?.property_id) return;
    write((prev) => (prev.some((x) => x.property_id === listing.property_id) ? prev : [...prev, snapshot(listing)]));
  }, [write]);

  const remove = useCallback((propertyId) => write((prev) => prev.filter((x) => x.property_id !== propertyId)), [write]);
  const clear = useCallback(() => write([]), [write]);
  const has = useCallback((propertyId) => items.some((x) => x.property_id === propertyId), [items]);

  const value = useMemo(
    () => ({ items, count: items.length, add, remove, has, clear }),
    [items, add, remove, has, clear]
  );

  return <VisitCartContext.Provider value={value}>{children}</VisitCartContext.Provider>;
}

export function useVisitCart() {
  const ctx = useContext(VisitCartContext);
  if (!ctx) throw new Error("useVisitCart must be used within VisitCartProvider");
  return ctx;
}
