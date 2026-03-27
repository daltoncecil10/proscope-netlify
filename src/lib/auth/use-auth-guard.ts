"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export type SessionUser = {
  id: string;
  email: string | null;
};

type UseAuthGuardOptions = {
  redirectTo?: string;
  requireAuth?: boolean;
};

export function useAuthGuard(options?: UseAuthGuardOptions) {
  const router = useRouter();
  const requireAuth = options?.requireAuth ?? true;
  const redirectTo = options?.redirectTo ?? "/login";
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionUser = data.session?.user ?? null;
      setUser(
        sessionUser
          ? {
              id: sessionUser.id,
              email: sessionUser.email ?? null,
            }
          : null
      );
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(
        sessionUser
          ? {
              id: sessionUser.id,
              email: sessionUser.email ?? null,
            }
          : null
      );
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!requireAuth || authLoading) return;
    if (!user) {
      router.replace(redirectTo);
    }
  }, [authLoading, requireAuth, redirectTo, router, user]);

  return { authLoading, user };
}
