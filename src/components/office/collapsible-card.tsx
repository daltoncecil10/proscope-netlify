"use client";

import { useState, type ReactNode } from "react";
import styles from "./office.module.css";

type CollapsibleCardProps = {
  title: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleCard({
  title,
  actions,
  defaultOpen = true,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={styles.collapseChevron}>{open ? "▾" : "▸"}</span>
          {title}
        </button>
        {actions}
      </div>
      {open ? children : null}
    </section>
  );
}
