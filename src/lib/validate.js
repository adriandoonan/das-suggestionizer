export function normalizeWord(w) {
  return (w ?? "").toString().trim();
}

export function validateWord(word) {
  if (!word) return "Please enter a word.";
  if (word.length > 30) return "Please keep it to 30 characters.";
  //if (/\s/.test(word)) return "Please enter just one word (no spaces).";
  //if (!/^[A-Za-z0-9_-]+$/.test(word)) return "Use letters, numbers, hyphen or underscore only.";
  return null;
}