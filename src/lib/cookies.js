// 30-second cooldown cookie utilities

// Set a cookie that expires in `seconds` (default 30). When present, the UI is disabled.
// We also keep the last word so the field stays filled while disabled.
export function suggestionCooldownCookie(word, seconds = 30) {
  const now = Math.floor(Date.now() / 1000);
  const vWord = encodeURIComponent(word || "");
  return [
    // presence of suggested_at indicates a cooldown
    `suggested_at=${now}; Max-Age=${seconds}; Path=/; SameSite=Lax`,
    // keep last word (same expiry so they go away together)
    `word=${vWord}; Max-Age=${seconds}; Path=/; SameSite=Lax`,
  ];
}

// Clear both cookies immediately (used on validation error, etc.)
export function clearSuggestionCookies() {
  return [
    `suggested_at=; Max-Age=0; Path=/; SameSite=Lax`,
    `word=; Max-Age=0; Path=/; SameSite=Lax`,
  ];
}

// Read cookies → { disabled: boolean, word: string }
// If suggested_at is present, we consider the cooldown active.
// We rely on Max-Age for expiry, so no timestamp math needed here.
export function readSuggestionCooldown(cookieHeader) {
  const out = { disabled: false, word: "" };
  if (!cookieHeader) return out;

  const parts = cookieHeader.split(/;\s*/);
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    const key = k?.trim();
    const val = rest.join("=");
    if (key === "suggested_at" && val) out.disabled = true;
    if (key === "word") out.word = safeDecode(val || "");
  }
  return out;
}

function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }