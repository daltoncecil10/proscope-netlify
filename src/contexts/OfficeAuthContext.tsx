"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { SupabaseSetupNotice } from "@/components/office/supabase-setup";
import styles from "@/components/office/office.module.css";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export type OfficeSessionUser = { id: string; email: string | null };

type OfficeAuthContextValue = {
  authLoading: boolean;
  user: OfficeSessionUser | null;
  authError: string | null;
  needsSupabaseConfig: boolean;
  refreshSession: () => Promise<void>;
};

const OfficeAuthContext = createContext<OfficeAuthContextValue | null>(null);

export function OfficeAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const needsSupabaseConfig = !isSupabaseConfigured;
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<OfficeSessionUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    if (needsSupabaseConfig) {
      setAuthLoading(false);
      setUser(null);
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const session = data.session;
      if (!session?.user) {
        setUser(null);
        return;
      }
      setUser({ id: session.user.id, email: session.user.email ?? null });
    } catch (err) {
      setAuthError((err as Error)?.message ?? "Authentication failed");
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [needsSupabaseConfig]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (needsSupabaseConfig) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null });
        setAuthLoading(false);
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [needsSupabaseConfig]);

  useEffect(() => {
    if (needsSupabaseConfig || authLoading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [needsSupabaseConfig, authLoading, user, pathname, router]);

  const value = useMemo(
    () => ({
      authLoading,
      user,
      authError,
      needsSupabaseConfig,
      refreshSession,
    }),
    [authLoading, user, authError, needsSupabaseConfig, refreshSession]
  );

  if (needsSupabaseConfig) {
    return <SupabaseSetupNotice />;
  }

  if (authLoading) {
    return <div className={styles.loading}>Loading office…</div>;
  }

  if (!user) {
    return <div className={styles.loading}>Redirecting to sign in…</div>;
  }

  return (
    <OfficeAuthContext.Provider value={value}>
      <div className={styles.officeRoot}>{children}</div>
    </OfficeAuthContext.Provider>
  );
}

export function useOfficeAuth(): OfficeAuthContextValue {
  const ctx = useContext(OfficeAuthContext);
  if (!ctx) {
    throw new Error("useOfficeAuth must be used within OfficeAuthProvider");
  }
  return ctx;
}
