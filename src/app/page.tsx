"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="page">
      <section className="dashboard-auth-wrap">
        <div className="dashboard-auth-card">
          <p className="muted">Loading ProScope...</p>
        </div>
      </section>
    </main>
  );
}
