// D1 helpers (all DB I/O lives here)

export async function ensureSchema(env) {
  // Keep it compatible with your current live table (created_at NOT NULL, no default)
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `).run();
}

export async function insertSuggestion(env, word) {
  await ensureSchema(env);
  return env.DB
    .prepare(
      "INSERT INTO suggestions (word, created_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'));"
    )
    .bind(word)
    .run();
}

export async function countSuggestions(env) {
  await ensureSchema(env);
  const { results } = await env.DB
    .prepare("SELECT COUNT(*) AS c FROM suggestions;")
    .all();
  return results?.[0]?.c ?? 0;
}

export async function listSuggestions(env) {
  await ensureSchema(env);
  const { results } = await env.DB
    .prepare("SELECT word FROM suggestions ORDER BY id ASC;")
    .all();
  return (results || []).map(r => r.word);
}

export async function clearSuggestions(env) {
  await ensureSchema(env);
  await env.DB.prepare("DELETE FROM suggestions;").run();
}