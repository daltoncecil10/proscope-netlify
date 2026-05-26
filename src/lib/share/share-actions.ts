export function buildShareMessage(title: string, url: string): string {
  return `ProScope inspection — ${title}\nView online: ${url}`;
}

export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Clipboard not available");
}

export function openSmsShare(message: string): void {
  const href = `sms:?&body=${encodeURIComponent(message)}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

export async function shareLink(title: string, url: string): Promise<void> {
  const message = buildShareMessage(title, url);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text: message, url });
      return;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
  }
  await copyToClipboard(url);
}
