import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchMyAdminRole, roleLabel } from "../lib/adminScopes";
import { DAY_MS } from "../lib/localCache";

/**
 * The role as last read, for 7 days (the CRM's limit for anything it keeps on
 * the device), so the CRM opens without waiting on this lookup. It is always
 * read again; a staff member who lost access is shown the door — and their
 * saved CRM data dropped — the moment that answer arrives.
 */
const ROLE_KEY = (email) => `mz_crm_role_v1:${String(email || "").toLowerCase()}`;
function savedRole(email) {
  try {
    const raw = JSON.parse(localStorage.getItem(ROLE_KEY(email)) || "null");
    return raw && Date.now() - raw.at < 7 * DAY_MS ? raw.row : null;
  } catch {
    return null;
  }
}
function saveRole(email, row) {
  try {
    if (row) localStorage.setItem(ROLE_KEY(email), JSON.stringify({ row, at: Date.now() }));
    else localStorage.removeItem(ROLE_KEY(email));
  } catch {
    /* ignore */
  }
}

/**
 * Who is looking at the CRM, and what may they do.
 *
 * `has(scope)` is the only thing callers should branch on — never the role name,
 * so adding a role later doesn't mean hunting for `role === "crm_manager"`
 * checks scattered through the UI.
 */
export function useCrmAccess() {
  const { user, loading: authLoading } = useAuth();
  const [row, setRow] = useState(() => savedRole(user?.email));
  const [loading, setLoading] = useState(() => !savedRole(user?.email));

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setRow(null);
      setLoading(false);
      return;
    }
    let alive = true;
    const saved = savedRole(user.email);
    if (saved) setRow(saved);
    else setLoading(true);
    fetchMyAdminRole(user.email)
      .then((r) => {
        if (!alive) return;
        setRow(r);
        saveRole(user.email, r?.scopes?.length ? r : null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [authLoading, user?.email]);

  return useMemo(() => {
    const scopes = row?.scopes ?? [];
    return {
      loading: authLoading || loading,
      email: user?.email ?? "",
      name: user?.name ?? "",
      role: row?.role ?? null,
      roleLabel: row ? roleLabel(row.role) : "",
      scopes,
      isStaff: scopes.length > 0,
      has: (scope) => scopes.includes(scope),
    };
  }, [authLoading, loading, row, user?.email, user?.name]);
}
