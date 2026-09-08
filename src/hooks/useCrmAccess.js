import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchMyAdminRole, roleLabel } from "../lib/adminScopes";

/**
 * Who is looking at the CRM, and what may they do.
 *
 * `has(scope)` is the only thing callers should branch on — never the role name,
 * so adding a role later doesn't mean hunting for `role === "crm_manager"`
 * checks scattered through the UI.
 */
export function useCrmAccess() {
  const { user, loading: authLoading } = useAuth();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setRow(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchMyAdminRole(user.email)
      .then((r) => alive && setRow(r))
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
