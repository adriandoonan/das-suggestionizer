-- Raw suggestion events (we never reject; we aggregate when starting a set)
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  client_id TEXT -- anonymous cookie id
);

-- Currently running set snapshot + schedule
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  length_ms INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0,
  ended_at INTEGER,
  schedule_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suggestions_word ON suggestions(word);
CREATE INDEX IF NOT EXISTS idx_suggestions_client_time ON suggestions(client_id, created_at);