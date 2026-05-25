/**
 * Open public/invoice-fillable-template.pdf (absolute path).
 * macOS: tries `open`, then Preview explicitly, then reveals file in Finder.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pdf = join(root, "public", "invoice-fillable-template.pdf");

if (!existsSync(pdf)) {
  console.error("Missing PDF. Run: npm run invoice:pdf\nExpected:", pdf);
  process.exit(1);
}

console.log("Opening:\n", pdf, "\n");

function tryCmd(command, args) {
  const r = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (r.error) {
    console.error(r.error.message);
    return false;
  }
  return r.status === 0;
}

let ok = false;

if (process.platform === "darwin") {
  ok =
    tryCmd("/usr/bin/open", [pdf]) ||
    tryCmd("/usr/bin/open", ["-a", "Preview", pdf]) ||
    tryCmd("/usr/bin/open", ["-R", pdf]);
} else if (process.platform === "win32") {
  ok = tryCmd("cmd", ["/c", "start", "", pdf]);
} else {
  ok = tryCmd("xdg-open", [pdf]);
}

if (!ok) {
  console.error(
    "\nCould not auto-open the PDF. Copy the path above and open it in Finder / Explorer,",
    "or in Cursor: right‑click public/invoice-fillable-template.pdf → Reveal in Finder.\n",
  );
  process.exit(1);
}
