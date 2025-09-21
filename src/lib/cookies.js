export function suggestedCookie(word) {
  const v = encodeURIComponent(word || "");
  return `suggested=1; word=${v}; Max-Age=2592000; Path=/; SameSite=Lax`;
}

export function clearSuggestedCookie() {
  return `suggested=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function readSuggestedCookie(cookieHeader) {
  const out = { suggested: false, word: "" };
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(/;\s*/);
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    const key = k?.trim();
    const val = rest.join("=");
    if (key === "suggested" && val === "1") out.suggested = true;
    if (key === "word") out.word = safeDecode(val || "");
  }
  return out;
}

function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }