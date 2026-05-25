import Link from "next/link";
import styles from "./office.module.css";
import { SUPABASE_SETUP_MESSAGE } from "@/lib/supabase/client";

export function SupabaseSetupNotice() {
  return (
    <div className={styles.loading} style={{ maxWidth: 520, margin: "48px auto", textAlign: "left" }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Supabase not configured</h2>
      <p style={{ color: "#b5bcc6", lineHeight: 1.6 }}>{SUPABASE_SETUP_MESSAGE}</p>
      <p style={{ fontSize: 12, color: "#7a838f" }}>
        Copy <code>.env.example</code> to <code>.env.local</code> and paste your project URL and{" "}
        <strong>anon public</strong> key. Do not use the service role key in the browser.
      </p>
      <Link href="/login" className={styles.linkBtn}>
        Back to login
      </Link>
    </div>
  );
}
