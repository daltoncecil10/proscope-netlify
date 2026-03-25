function normalizeUrl(input) {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.toString();
  } catch {
    return null;
  }
}

const form = document.getElementById("lookup-form");
const input = document.getElementById("report-link");
const invalid = document.getElementById("invalid");
const actions = document.getElementById("actions");
const openLink = document.getElementById("open-link");
const downloadLink = document.getElementById("download-link");
const frame = document.getElementById("preview-frame");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const parsed = normalizeUrl(input.value);

  if (!parsed) {
    invalid.style.display = "block";
    actions.style.display = "none";
    frame.style.display = "none";
    return;
  }

  invalid.style.display = "none";
  actions.style.display = "flex";
  frame.style.display = "block";

  openLink.href = parsed;
  downloadLink.href = parsed;
  frame.src = parsed;
});

const params = new URLSearchParams(window.location.search);
const reportParam = params.get("report");
if (reportParam) {
  input.value = reportParam;
  form.dispatchEvent(new Event("submit"));
}
