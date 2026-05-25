# Repairability & related work — session archive

**Purpose:** Preserve the substance of the Cursor chat for you and your engineer. This is **not** a verbatim export of the UI thread (see “How to save the raw chat” below).

**Date context:** Work discussed through early 2026; mobile app path referenced as `~/Desktop/ProScopePackage` (Expo / React Native).

---

## How to save the raw chat in Cursor

1. Open the **chat panel** for this conversation.
2. Use the **conversation menu** (often `⋯` or right-click on the chat title) and look for **Export**, **Copy**, or **Save** if your Cursor version exposes it.
3. If there is no export: **select all messages** (or scroll and copy in chunks) and paste into a `.md` or `.txt` file you keep in source control.

Cursor’s exact menu labels change by version; if something isn’t visible, check **Cursor Settings** or Help for “export chat.”

---

## 1. Repairability Test — app implementation (ProScopePackage)

### Goals (from product spec)

- Guided **step-based** workflow (not a long scrolling form): **Subject → 9 test shingles → Summary**; strict sequence; no skipping.
- **Subject shingle:** photo required; pre-existing defects (multi-select); notes optional; slope label.
- **Test shingles 1–9:** photo required; **Damaged during assessment?** Yes/No; if Yes → defects **required** (multi-select); **“No Change”** mutually exclusive with all other defect options; notes optional.
- **Defect list:** fixed canonical options in `constants/repairability.ts` (`REPAIRABILITY_DEFECT_OPTIONS`).
- **Draft storage** keyed by job — **do not** change core claim/job DB schema; use repairability draft namespace.
- **Settings:** optional **Repairability Assessor Number** on profile; include in PDF / company rows when set (inspector / HAAG area).
- **PDF:** repairability section when there is content; text summary + per-test lines; use existing `wrapText` helper (no duplicate PDF text wrapper).

### Key files (typical locations)

| Area | Path (under ProScopePackage) |
|------|-------------------------------|
| Constants, payload, helpers | `constants/repairability.ts` |
| Draft load/save | `services/repairabilityDraft.ts` |
| Full-screen workflow | `app/repairability.tsx` |
| Stack route | `app/_layout.tsx` (repairability screen) |
| Home entry | `app/(tabs)/index.tsx` — “Start Repairability Test” quick action |
| Slopes entry | `app/roof-slopes.tsx` — card `{activeSide} Slope - Repairability` with **Start test** only (other slope repairability fields removed from that card) |
| Profile field | `app/profile-modal.tsx` + profile types/services/constants |
| PDF | `services/export.ts` — `loadRepairabilityDraft`, `drawRepairabilityTestPage`, assessor row |

### UX refinements implemented in thread

- **Defect selection:** modal with large checkbox-style rows (not long inline chip wall); mutual exclusivity for “No Change” enforced in UI via `toggleRepairabilityDefects`.
- **Photo first** on steps; copy clarifies inputs describe **that** photo.
- **`normalizeRepairabilityPayload`** / **`isRepairabilityPayloadComplete`**; normalize on **persist** and **load**; completion gate before `completedAt`.
- **Slope from roof screen:** `router.push` to `/repairability` with `slopeLabel` param; `repairability.tsx` reads `useLocalSearchParams` and merges into draft on load.

### Photo types & captions (later in thread)

- **`REPAIRABILITY_PHOTO_KINDS`:** Overview | During | Post (short labels on chips; longer phrase in captions).
- Stored per capture: **`photoKind`** on subject and each test entry.
- **`formatRepairabilityPhotoCaption(slopeLabel, role, kind, testIndex?)`** builds strings like `{Slope} — Subject shingle — …` and `{Slope} — Test shingle N of 9 — …`.
- Shown in UI preview, summary, and PDF **“Photo captions”** block.

---

## 2. Dev / device (terminal)

- Project expects **Node 20** (`package.json` engines).
- **Wrong:** `nvm install nvm` — install nvm via official installer, then `nvm install 20` / `nvm use 20`.
- **npm EINVALIDTAGNAME with `#`:** don’t paste comment fragments into `npm install`.
- Run on device: `npm start` or `npx expo start --dev-client`; same Wi‑Fi as Mac; if tunnel fails, try **LAN** without `--tunnel` or fix firewall/VPN.

---

## 3. Tyler Schmidt PDF (friend’s repairability assessment)

**Source:** `Tyler Schmidt - Repairability Assessment.pdf` (Downloads / Desktop copies analyzed).

**Structure (from embedded text):**

- Cover: company, date, photo count, title.
- **Overview of test area** → **Shingle 1–8 overview** + **Test shingle overview** → **Control area** → **Shingle temperature**.
- **No delamination observed** (multiple frames).
- **Shingle X damaged due to …** (mat transfer, nail pull through, delamination, creasing) — often **multiple photos** per caption.
- **Test shingle removed**; **technician demonstrating** nail pull-through / deflection for flush fastener.
- **Post repairability assessment** overviews for shingles + test shingle.
- **Damage counts** summary (e.g. pull-through, mat transfer by shingle numbers, etc.).

Used as reference for **report narrative** and optional future parity (extra albums, dedicated steps).

---

## 4. Field SOP you and the assistant walked through (narrative)

**Order discussed:**

1. **Overview of tested area** — marked/bounded zone where all repairability work happens.
2. **Tools in area** — same zone (or clearly same job), equipment used for the protocol.
3. **Numbered shingles 1–9** — **precondition** before testing: one photo each with **label visible** in frame.
4. **Control area** — **random shingle** (not necessarily on the 1–9 grid): shows **overall condition** of a typical shingle for baseline context.
5. **Temperature** — **photo of the gauge** (condition at time of assessment).
6. **Break all shingles loose** — unseal, nails pulled **before** pulling out **shingle X**; only then retrieve individual shingles per protocol.
7. **Per shingle 1–9 after manipulation** — document **whether** damaged and **check all that apply** for damage types (matches app: Yes/No + multi-select defects).

**Pause:** You planned to **practice on your house** and return with friction points to improve the flow.

---

## 5. What’s *not* in this file

- Full verbatim Cursor message history (use UI export / copy as above).
- Every line of code — use `git log` / `git diff` on the branches where ProScopePackage changes landed.

---

## 6. Suggested next session when you’re back from practice

- Reorder or add steps: **area → tools → 1–9 precondition → control → temp → then 9 post-manipulation** (vs current subject-first if you want strict PDF parity).
- Optional **second photo** per shingle (pre vs post manipulate) vs single photo + photo type.
- Copy/hints tuned to your real roof run-through.

---

*End of archive. Add your house-practice notes below this line.*

```text

```
