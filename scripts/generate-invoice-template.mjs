/**
 * Fillable invoice — layout modeled on Diana Newman invoice (one US Letter page).
 * Run: npm run invoice:pdf  →  public/invoice-fillable-template.pdf
 * Totals: use /invoice in the app → Print → Save as PDF (embedded PDF math is unreliable).
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public");
const OUT_FILE = join(OUT_DIR, "invoice-fillable-template.pdf");

const W = 612;
const H = 792;
const M = 42;
const RIGHT = W - M;

const LABEL = rgb(0.08, 0.09, 0.12);
const BORDER_FIELD = rgb(0.35, 0.37, 0.42);
const BORDER_STRONG = rgb(0.22, 0.24, 0.28);
const TEXT_FIELD = rgb(0, 0, 0);
const BG_FIELD = rgb(1, 1, 1);

/** Vertical gap from label to field (smaller = title closer to the box; keep ≥ ~font size). */
const LABEL_TO_FIELD_TOP = 9;
/** Tighter label→field gap: Name, Phone, Email, Pay to, Mailing, EIN. */
const LABEL_GAP_TIGHT = 3;
const FIELD_H = 19;
const AFTER_FIELD = 6;
const SINGLE_ROW = LABEL_TO_FIELD_TOP + FIELD_H + AFTER_FIELD;

const FS_LABEL = 9;
const FS_SECTION = 10;
const FS_FIELD = 10;

const DESCRIPTION_DROPDOWN_OPTIONS = [
  "— Select —",
  "Custom",
  "Exterior inspection",
  "Safety equipment used",
  "Multi",
  "Tarp",
  "ITEL",
  "Interior inspection",
  "Repair assessment",
];

const TABLE_ROW = 19;
const LINE_ROWS = 8;

function yTop(page, fromTop) {
  return page.getHeight() - fromTop;
}

function fieldOpts(extra = {}) {
  return {
    borderWidth: 1,
    borderColor: BORDER_FIELD,
    backgroundColor: BG_FIELD,
    textColor: TEXT_FIELD,
    ...extra,
  };
}

function sizeTextField(tf, size = FS_FIELD) {
  try {
    tf.setFontSize(size);
  } catch {
    /* ignore */
  }
}

function sizeDropdown(dd, size = FS_FIELD) {
  try {
    dd.setFontSize(size);
  } catch {
    /* ignore */
  }
}

/**
 * Fillable PDF only — no embedded math (Acrobat/Reader often block or ignore it).
 * For automatic totals use the web calculator: /invoice → Print → Save as PDF.
 */
async function main() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([W, H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const form = pdfDoc.getForm();

  const drawLabel = (text, x, fromTop, size = FS_LABEL) => {
    page.drawText(text, {
      x,
      y: yTop(page, fromTop) - size * 0.3,
      size,
      font,
      color: LABEL,
    });
  };

  const drawSection = (text, x, fromTop) => {
    page.drawText(text, {
      x,
      y: yTop(page, fromTop),
      size: FS_SECTION,
      font: fontBold,
      color: rgb(0.06, 0.07, 0.1),
    });
  };

  const drawColHead = (text, x, fromTop) => {
    page.drawText(text, {
      x,
      y: yTop(page, fromTop) - FS_LABEL * 0.3,
      size: FS_LABEL,
      font: fontBold,
      color: LABEL,
    });
  };

  function fieldYFromLabel(pg, labelFromTop) {
    return yTop(pg, labelFromTop + LABEL_TO_FIELD_TOP) - FIELD_H;
  }

  function fieldYFromLabelGap(pg, labelFromTop, gapPt) {
    return yTop(pg, labelFromTop + gapPt) - FIELD_H;
  }

  // --- Header: logo + INVOICE + invoice # / date (right) ---
  const logoW = 108;
  const logoH = 40;
  const logoFromTop = 36;
  drawLabel("Logo", M, logoFromTop - 1, 8);
  page.drawRectangle({
    x: M,
    y: yTop(page, logoFromTop + logoH),
    width: logoW,
    height: logoH,
    borderColor: BORDER_FIELD,
    borderWidth: 1,
  });
  page.drawText("Add image", {
    x: M + 8,
    y: yTop(page, logoFromTop + logoH / 2 + 2),
    size: 8,
    font,
    color: rgb(0.4, 0.42, 0.45),
  });

  page.drawText("INVOICE", {
    x: M + logoW + 14,
    y: yTop(page, 44),
    size: 22,
    font: fontBold,
    color: rgb(0.04, 0.05, 0.08),
  });

  const metaTop = logoFromTop + logoH + 8;
  const invW = 100;
  const dateW = 100;
  const metaGap = 12;
  const dateColX = RIGHT - dateW;
  const invColX = dateColX - metaGap - invW;

  drawLabel("Invoice #", invColX, metaTop);
  const invoiceNo = form.createTextField("invoice_number");
  invoiceNo.addToPage(
    page,
    fieldOpts({
      x: invColX,
      y: fieldYFromLabel(page, metaTop),
      width: invW,
      height: FIELD_H,
    }),
  );
  sizeTextField(invoiceNo);

  drawLabel("Date", dateColX, metaTop);
  const invoiceDate = form.createTextField("invoice_date");
  invoiceDate.addToPage(
    page,
    fieldOpts({
      x: dateColX,
      y: fieldYFromLabel(page, metaTop),
      width: dateW,
      height: FIELD_H,
    }),
  );
  sizeTextField(invoiceDate);

  const metaRowBottom = metaTop + LABEL_TO_FIELD_TOP + FIELD_H;
  let t = metaRowBottom + 10;

  // --- Contact Info: company, contact name, phone | email (Diana-style block) ---
  drawSection("Contact Info:", M, t);
  t += 12;

  drawLabel("Business / DBA", M, t);
  const business = form.createTextField("contact_business");
  business.addToPage(
    page,
    fieldOpts({
      x: M,
      y: fieldYFromLabelGap(page, t, LABEL_GAP_TIGHT),
      width: RIGHT - M,
      height: FIELD_H,
    }),
  );
  sizeTextField(business);
  t += SINGLE_ROW;

  drawLabel("Name", M, t);
  const contactName = form.createTextField("contact_name");
  contactName.addToPage(
    page,
    fieldOpts({
      x: M,
      y: fieldYFromLabelGap(page, t, LABEL_GAP_TIGHT),
      width: RIGHT - M,
      height: FIELD_H,
    }),
  );
  sizeTextField(contactName);
  t += SINGLE_ROW;

  const phoneW = 168;
  const emailColX = M + phoneW + 14;
  drawLabel("Phone", M, t);
  const phone = form.createTextField("contact_phone");
  phone.addToPage(
    page,
    fieldOpts({
      x: M,
      y: fieldYFromLabelGap(page, t, LABEL_GAP_TIGHT),
      width: phoneW,
      height: FIELD_H,
    }),
  );
  sizeTextField(phone);

  drawLabel("Email", emailColX, t);
  const email = form.createTextField("contact_email");
  email.addToPage(
    page,
    fieldOpts({
      x: emailColX,
      y: fieldYFromLabelGap(page, t, LABEL_GAP_TIGHT),
      width: RIGHT - emailColX,
      height: FIELD_H,
    }),
  );
  sizeTextField(email);
  t += SINGLE_ROW;

  // --- Issued to: Client | Adjuster | Claim # ---
  t += 2;
  drawSection("Issued to:", M, t);
  t += 12;
  const issuedGap = 10;
  const issuedColW = (RIGHT - M - 2 * issuedGap) / 3;
  const issuedCol2 = M + issuedColW + issuedGap;
  const issuedCol3 = issuedCol2 + issuedColW + issuedGap;

  drawLabel("Client", M, t);
  drawLabel("Adjuster", issuedCol2, t);
  drawLabel("Claim #", issuedCol3, t);

  const issuedClient = form.createTextField("issued_to_client");
  issuedClient.addToPage(
    page,
    fieldOpts({
      x: M,
      y: fieldYFromLabelGap(page, t, LABEL_GAP_TIGHT),
      width: issuedColW,
      height: FIELD_H,
    }),
  );
  sizeTextField(issuedClient);

  const issuedAdjuster = form.createTextField("issued_to_adjuster");
  issuedAdjuster.addToPage(
    page,
    fieldOpts({
      x: issuedCol2,
      y: fieldYFromLabelGap(page, t, LABEL_GAP_TIGHT),
      width: issuedColW,
      height: FIELD_H,
    }),
  );
  sizeTextField(issuedAdjuster);

  const issuedClaim = form.createTextField("issued_to_claim_number");
  issuedClaim.addToPage(
    page,
    fieldOpts({
      x: issuedCol3,
      y: fieldYFromLabelGap(page, t, LABEL_GAP_TIGHT),
      width: issuedColW,
      height: FIELD_H,
    }),
  );
  sizeTextField(issuedClaim);

  t += SINGLE_ROW + 2;

  // --- Line items: DESCRIPTION (dropdown) | QTY | PRICE | TOTAL ---
  const qtyX = M + 268;
  const priceX = M + 318;
  const totalX = M + 388;
  const descW = qtyX - M - 6;

  const tableTop = t;
  drawColHead("DESCRIPTION", M, tableTop);
  drawColHead("QTY", qtyX, tableTop);
  drawColHead("PRICE", priceX, tableTop);
  drawColHead("TOTAL", totalX + 1, tableTop);

  const rowStart = tableTop + 8;

  for (let i = 0; i < LINE_ROWS; i++) {
    const fromTop = rowStart + i * TABLE_ROW;
    const y = yTop(page, fromTop) - FIELD_H;
    const rowNum = i + 1;

    const service = form.createDropdown(`line_${rowNum}_description`);
    service.setOptions([...DESCRIPTION_DROPDOWN_OPTIONS]);
    service.select(DESCRIPTION_DROPDOWN_OPTIONS[0]);
    service.enableEditing();
    service.addToPage(
      page,
      fieldOpts({ x: M, y, width: descW, height: FIELD_H }),
    );
    sizeDropdown(service);

    const qty = form.createTextField(`line_${rowNum}_qty`);
    qty.addToPage(page, fieldOpts({ x: qtyX, y, width: 40, height: FIELD_H }));
    sizeTextField(qty);

    const price = form.createTextField(`line_${rowNum}_price`);
    price.addToPage(page, fieldOpts({ x: priceX, y, width: 62, height: FIELD_H }));
    sizeTextField(price);

    const lineTot = form.createTextField(`line_${rowNum}_total`);
    lineTot.addToPage(
      page,
      fieldOpts({
        x: totalX,
        y,
        width: RIGHT - totalX,
        height: FIELD_H,
      }),
    );
    sizeTextField(lineTot);
  }

  /* Below last line row: last row top = rowStart + 7*TABLE_ROW; table body height = 8*TABLE_ROW */
  let totalsY = rowStart + LINE_ROWS * TABLE_ROW + 10;
  const gapLeftOfAmount = 5;
  const totalsLabelLeft = (labelText) => {
    const w = font.widthOfTextAtSize(labelText, FS_LABEL);
    const flushRightOfLabel = totalX - gapLeftOfAmount - w;
    const leftOfPriceCol = priceX - 8 - w;
    return Math.min(flushRightOfLabel, leftOfPriceCol);
  };
  drawLabel("SUBTOTAL", totalsLabelLeft("SUBTOTAL"), totalsY);
  const subtotal = form.createTextField("subtotal");
  subtotal.addToPage(
    page,
    fieldOpts({
      x: totalX,
      y: fieldYFromLabel(page, totalsY),
      width: RIGHT - totalX,
      height: FIELD_H,
    }),
  );
  sizeTextField(subtotal);

  const grandLabelTop = totalsY + SINGLE_ROW;
  drawLabel("GRAND TOTAL", totalsLabelLeft("GRAND TOTAL"), grandLabelTop);
  const grand = form.createTextField("grand_total");
  grand.addToPage(
    page,
    fieldOpts({
      x: totalX,
      y: fieldYFromLabel(page, grandLabelTop),
      width: RIGHT - totalX,
      height: FIELD_H + 1,
      borderColor: BORDER_STRONG,
    }),
  );
  sizeTextField(grand);

  // --- Payment Info (compact; matches pay-to + address + EIN pattern) ---
  let payT = grandLabelTop + LABEL_TO_FIELD_TOP + FIELD_H + 1 + AFTER_FIELD;
  drawSection("Payment Info:", M, payT);
  payT += 9;

  drawLabel("Pay to (legal name)", M, payT);
  const payee = form.createTextField("payment_payee_name");
  payee.addToPage(
    page,
    fieldOpts({
      x: M,
      y: fieldYFromLabelGap(page, payT, LABEL_GAP_TIGHT),
      width: RIGHT - M,
      height: FIELD_H,
    }),
  );
  sizeTextField(payee);
  payT += SINGLE_ROW;

  drawLabel("Mailing address", M, payT);
  const payAddr = form.createTextField("payment_address");
  payAddr.enableMultiline();
  payAddr.addToPage(
    page,
    fieldOpts({
      x: M,
      y: fieldYFromLabelGap(page, payT, LABEL_GAP_TIGHT),
      width: RIGHT - M,
      height: FIELD_H,
    }),
  );
  sizeTextField(payAddr, FS_FIELD);

  payT += SINGLE_ROW;

  drawLabel("EIN / Tax ID", M, payT);
  const ein = form.createTextField("payment_ein");
  ein.addToPage(
    page,
    fieldOpts({
      x: M,
      y: fieldYFromLabelGap(page, payT, LABEL_GAP_TIGHT),
      width: RIGHT - M,
      height: FIELD_H,
    }),
  );
  sizeTextField(ein);

  const thankText = "THANK YOU";
  const thankSize = 11;
  const thankW = fontBold.widthOfTextAtSize(thankText, thankSize);
  page.drawText(thankText, {
    x: (W - thankW) / 2,
    y: yTop(page, H - 20),
    size: thankSize,
    font: fontBold,
    color: rgb(0.28, 0.3, 0.34),
  });

  form.updateFieldAppearances(font);

  const bytes = await pdfDoc.save();
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, bytes);
  console.log(`Wrote ${OUT_FILE}`);
  console.log(
    "\nAutomatic totals: start the app and open http://localhost:3000/invoice — then Print → Save as PDF.\n" +
      "To open this PDF only:  npm run invoice:view\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
