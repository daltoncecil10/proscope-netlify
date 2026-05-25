"use client";

import { useState } from "react";
import { OfficeShell } from "@/components/office/office-shell";
import styles from "@/components/office/office.module.css";
import { useOfficeAuth } from "@/hooks/useOfficeAuth";

const BEI_CERT_URL =
  "https://www.buildingexperts.institute/certifications-repairabilityassessor";

export function SettingsClient() {
  const { user } = useOfficeAuth();
  const [beiId, setBeiId] = useState("");
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);

  const saveBei = () => {
    if (!beiId.trim()) {
      setVerified(false);
      setPending(false);
      return;
    }
    setPending(true);
    setVerified(false);
  };

  const verifyBei = () => {
    if (beiId.trim().length >= 4) {
      setVerified(true);
      setPending(false);
    }
  };

  return (
    <OfficeShell
      activeNav="settings"
      user={user}
      crumbs={
        <>
          <span>ProScope Office</span>
          <span className={styles.crumbsHere}>/ Settings</span>
        </>
      }
    >
      <div className={styles.content}>
        <h1 className={styles.pageH1}>Settings</h1>
        <p className={styles.pageMeta}>Office preferences and Repairability certification.</p>

        <section className={`${styles.card} ${styles.settingsCard}`}>
          <div className={styles.cardHeader}>Account</div>
          <div style={{ padding: "14px 18px" }}>
            <div className={styles.settingsRow}>
              <span>Email</span>
              <span className={styles.mono}>{user?.email ?? "—"}</span>
            </div>
          </div>
        </section>

        <section className={`${styles.card} ${styles.settingsCard}`}>
          <div className={`${styles.cardHeader} ${styles.repairHeader}`}>
            Repair Assessment (BEI)
          </div>
          <div style={{ padding: "14px 18px" }}>
            <p style={{ fontSize: 13, color: "var(--ink-mute)", marginTop: 0 }}>
              Enter your BEI Assessor ID to unlock Repairability in the mobile app and
              office dashboard.
            </p>
            <div className={styles.field}>
              <label htmlFor="bei-id">BEI Assessor ID</label>
              <input
                id="bei-id"
                value={beiId}
                onChange={(e) => {
                  setBeiId(e.target.value);
                  setPending(true);
                  setVerified(false);
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              Status:{" "}
              {verified ? (
                <span style={{ color: "var(--ok)" }}>Verified</span>
              ) : pending && beiId.trim() ? (
                <span style={{ color: "var(--warn)" }}>Pending verification</span>
              ) : (
                <span style={{ color: "#ff9a9a" }}>Required — feature locked</span>
              )}
            </p>
            <div className={styles.saveRow}>
              <button type="button" className={styles.btnSecondary} onClick={saveBei}>
                Save ID
              </button>
              <button type="button" className={styles.btnPrimary} onClick={verifyBei}>
                Verify (demo)
              </button>
            </div>
            <a
              href={BEI_CERT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkBtn}
              style={{ display: "inline-block", marginTop: 12 }}
            >
              Get certified at Building Experts Institute →
            </a>
          </div>
        </section>
      </div>
    </OfficeShell>
  );
}
