export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // -------- API: count (existing from earlier step) ------------------------
    if (request.method === "GET" && url.pathname === "/api/count") {
      await ensureSchema(env);
      const { results } = await env.DB.prepare("SELECT COUNT(*) AS c FROM suggestions;").all();
      const count = results?.[0]?.c ?? 0;
      return jsonResponse({ count }, { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" });
    }

    // -------- API: list all suggestions (NEW) -------------------------------
    if (request.method === "GET" && url.pathname === "/api/suggestions") {
      await ensureSchema(env);
      const { results } = await env.DB.prepare("SELECT word FROM suggestions ORDER BY id ASC;").all();
      const words = (results || []).map(r => r.word);
      return jsonResponse({ words }, { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" });
    }

    // -------- API: initialise / clear DB (NEW) ------------------------------
    if (request.method === "POST" && url.pathname === "/api/init") {
      await ensureSchema(env);
      await env.DB.prepare("DELETE FROM suggestions;").run();
      return jsonResponse({ ok: true });
    }

    // -------- Page: live count UI (existing) --------------------------------
    if (request.method === "GET" && url.pathname === "/count") {
      return htmlResponse(renderCountPage());
    }

    // -------- Page: show runner UI (NEW) ------------------------------------
    if (request.method === "GET" && url.pathname === "/show") {
      return htmlResponse(renderShowPage());
    }

    // -------- Submit page (existing) ----------------------------------------
    if (request.method === "POST" && url.pathname === "/submit") {
      const formData = await request.formData();
      const wordRaw = (formData.get("word") || "").toString().trim();

      const word = normalizeWord(wordRaw);
      const validationError = validateWord(word);
      if (validationError) {
        return htmlResponse(
          renderPage({ disabled: false, value: wordRaw, error: validationError }),
          { status: 400, headers: { "Set-Cookie": clearSuggestedCookie() } }
        );
      }

      try {
        await ensureSchema(env);
        // explicit created_at for your current schema
        await env.DB.prepare(
          "INSERT INTO suggestions (word, created_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'));"
        ).bind(word).run();

        return htmlResponse(
          renderPage({ disabled: true, value: word, success: "Thanks! Your suggestion was saved." }),
          { headers: { "Set-Cookie": suggestedCookie(word) } }
        );
      } catch (e) {
        console.error("DB error:", e);
        const msg = /no such table/i.test(String(e)) ? "Database not initialized." : "Failed to save your suggestion.";
        return htmlResponse(
          renderPage({ disabled: false, value: word, error: msg }),
          { status: 500, headers: { "Set-Cookie": clearSuggestedCookie() } }
        );
      }
    }

    // -------- Home page (existing) ------------------------------------------
    if (url.pathname === "/") {
      const { suggested, word } = readSuggestedCookie(request.headers.get("Cookie"));
      return htmlResponse(renderPage({ disabled: suggested, value: word || "" }));
    }

    return new Response("Not found", { status: 404 });
  },
};

// --- helpers -----------------------------------------------------------------

async function ensureSchema(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `).run();
}

function validateWord(word) {
  if (!word) return "Please enter a word.";
  if (word.length > 30) return "Please keep it to 30 characters.";
  if (!/^[A-Za-z0-9_-]+$/.test(word)) return "Use letters, numbers, hyphen or underscore only.";
  if (/\s/.test(word)) return "Please enter just one word (no spaces).";
  return null;
}
function normalizeWord(w) { return w.trim(); }

function renderCountPage() {
  return /* html */ `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Current Suggestions Count</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; background:#0b0c0f; color:#e6e6e6; }
    .card { max-width: 560px; margin: 0 auto; background:#14161b; border:1px solid #23262d; border-radius: 16px; padding: 20px; }
    .count { font-size: 64px; font-weight: 800; margin: 12px 0; text-align:center; }
    .muted { color:#9aa0a6; text-align:center; }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="margin-top:0;text-align:center">Suggestions in the database</h1>
    <div id="count" class="count">—</div>
    <div class="muted"><span id="status">Connecting…</span></div>
    <p style="text-align:center;margin-top:16px"><a href="/show" style="color:#8ab4f8">Go to Show →</a></p>
  </div>
<script>
const countEl = document.getElementById('count');
const statusEl = document.getElementById('status');
async function refresh(){
  try{
    const r = await fetch('/api/count',{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const {count} = await r.json();
    countEl.textContent = String(count);
    statusEl.textContent = 'Last updated ' + new Date().toLocaleTimeString();
  }catch(e){ statusEl.textContent = 'Error: ' + (e.message||e); }
}
refresh(); setInterval(refresh, 2000);
</script>
</body></html>`;
}

function renderShowPage() {
  return /* html */ `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Show Runner</title>
  <style>
    :root { --bg:#0b0c0f; --card:#14161b; --border:#23262d; --muted:#9aa0a6; --fg:#e6e6e6; --accent:#3a6ff8; }
    body { margin:0; background:var(--bg); color:var(--fg); font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    header { padding:16px; text-align:center; border-bottom:1px solid var(--border); }
    main { display:grid; place-items:center; min-height:calc(100vh - 64px); padding:24px; }
    .stage { width:min(900px, 90vw); text-align:center; }
    .controls { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-bottom:16px; }
    .controls input { width:110px; padding:10px 12px; border-radius:12px; border:1px solid var(--border); background:#0f1115; color:var(--fg); text-align:center; }
    .btn { padding:12px 16px; border-radius:12px; border:none; font-weight:700; color:white; background:var(--accent); cursor:pointer; }
    .btn.secondary { background:#2d3140; }
    .btn.danger { background:#b00020; }
    .btn:disabled { opacity:0.6; cursor:not-allowed; }
    .stack { margin-top:28px; display:flex; flex-direction:column; gap:8px; align-items:center; }
    .word { font-weight:900; line-height:1; }
    .word.current { font-size:min(12vw, 110px); }
    .word.fade1 { font-size:min(7.5vw, 68px); opacity:0.75; }
    .word.fade2 { font-size:min(6vw, 54px); opacity:0.5; }
    .word.fade3 { font-size:min(5vw, 45px); opacity:0.35; }
    .word.fade4 { font-size:min(4.5vw, 38px); opacity:0.25; }
    .muted { color:var(--muted); }
    .row { display:flex; gap:16px; justify-content:center; align-items:center; flex-wrap:wrap; }
    .hint { margin-top:8px; }
    footer { position:fixed; left:0; right:0; bottom:0; padding:10px 16px; text-align:center; color:var(--muted); background:linear-gradient(to top, rgba(0,0,0,0.22), rgba(0,0,0,0)); }
  </style>
</head>
<body>
  <header>
    <div class="row">
      <div class="muted">Set length:</div>
      <input id="setLength" type="number" step="1" min="1" value="20" />
      <select id="setUnit" style="padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:#0f1115;color:var(--fg)">
        <option value="minutes" selected>minutes</option>
        <option value="seconds">seconds</option>
      </select>
      <button class="btn danger" id="btnInit">Initialise</button>
      <button class="btn" id="btnStart">Start</button>
      <button class="btn secondary" id="btnPause" disabled>Pause</button>
      <button class="btn secondary" id="btnReset" disabled>Reset</button>
    </div>
    <div class="hint muted">Initialise clears the current database. Start shuffles all current words and runs the show. Pause stops the timer. Reset clears the stage.</div>
  </header>

  <main>
    <div class="stage">
      <div id="stack" class="stack">
        <div class="muted">Ready. Click <strong>Start</strong> to begin.</div>
      </div>
    </div>
  </main>

  <footer>
    <span id="status" class="muted">Idle</span>
  </footer>

<script>
let timer = null;
let running = false;
let paused = false;
let words = [];
let order = [];
let index = -1;
const stackEl = document.getElementById('stack');
const statusEl = document.getElementById('status');
const btnInit = document.getElementById('btnInit');
const btnStart = document.getElementById('btnStart');
const btnPause = document.getElementById('btnPause');
const btnReset = document.getElementById('btnReset');
const setLen = document.getElementById('setLength');
const setUnit = document.getElementById('setUnit');

btnInit.addEventListener('click', async () => {
  if (running) { alert('Stop the show before initialising.'); return; }
  if (!confirm('This will DELETE all suggestions. Continue?')) return;
  await fetch('/api/init', { method:'POST' });
  status('Database cleared.');
  clearStage();
});

btnStart.addEventListener('click', async () => {
  if (running) { return; }
  const setLengthVal = Math.max(1, parseInt(setLen.value || '1', 10));
  const unit = setUnit.value; // 'minutes' or 'seconds'

  const resp = await fetch('/api/suggestions', { cache:'no-store' });
  if (!resp.ok) { status('Failed to load suggestions'); return; }
  const data = await resp.json();
  words = Array.isArray(data.words) ? data.words.slice() : [];

  if (words.length === 0) { status('No suggestions in DB.'); flashStage('No suggestions yet.'); return; }

  // shuffle (Fisher-Yates)
  order = words.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // Interval calculation:
  // We want to fit the entire list into the selected set length.
  // => intervalSeconds = setLengthSeconds / N
  // If you REALLY want N / setLength seconds, change the next two lines accordingly.
  const totalSeconds = unit === 'minutes' ? setLengthVal * 60 : setLengthVal;
  const intervalSeconds = Math.max(0.25, totalSeconds / order.length); // floor at 250ms

  index = -1;
  running = true; paused = false;
  btnPause.disabled = false; btnReset.disabled = false; btnStart.disabled = true; btnInit.disabled = true;

  status(\`Running (\${order.length} words, \${intervalSeconds.toFixed(2)}s/word)\`);
  nextTick(); // show first immediately
  timer = setInterval(nextTick, Math.round(intervalSeconds * 1000));
});

btnPause.addEventListener('click', () => {
  if (!running) return;
  if (!paused) {
    clearInterval(timer); timer = null; paused = true;
    btnPause.textContent = 'Resume';
    status('Paused');
  } else {
    paused = false;
    status('Resumed');
    btnPause.textContent = 'Pause';
    // compute remaining time precisely is overkill; continue with interval cadence
    // just call setInterval again
    const setLengthVal = Math.max(1, parseInt(setLen.value || '1', 10));
    const unit = setUnit.value;
    const totalSeconds = unit === 'minutes' ? setLengthVal * 60 : setLengthVal;
    const intervalSeconds = Math.max(0.25, totalSeconds / order.length);
    timer = setInterval(nextTick, Math.round(intervalSeconds * 1000));
  }
});

btnReset.addEventListener('click', () => {
  stopShow();
  clearStage();
  status('Reset.');
});

function nextTick() {
  index++;
  if (index >= order.length) {
    stopShow();
    renderStack([], '(and that’s our show)');
    status('Complete.');
    return;
  }
  const current = order[index];
  const history = order.slice(Math.max(0, index - 4), index).reverse(); // up to 4 trailing
  renderStack([current, ...history]);
}

function renderStack(wordsStack, emptyText) {
  stackEl.innerHTML = '';
  if (!wordsStack.length) {
    const p = document.createElement('div');
    p.className = 'muted';
    p.textContent = emptyText || 'Ready.';
    stackEl.appendChild(p);
    return;
  }
  // first is current
  const top = document.createElement('div');
  top.className = 'word current';
  top.textContent = wordsStack[0];
  stackEl.appendChild(top);

  const fades = ['fade1','fade2','fade3','fade4'];
  for (let i = 1; i < wordsStack.length && i <= fades.length; i++) {
    const el = document.createElement('div');
    el.className = 'word ' + fades[i-1];
    el.textContent = wordsStack[i];
    stackEl.appendChild(el);
  }
}

function clearStage() { renderStack([],'Ready.'); }
function stopShow() {
  if (timer) { clearInterval(timer); timer = null; }
  running = false; paused = false; index = -1;
  btnPause.textContent = 'Pause';
  btnPause.disabled = true; btnReset.disabled = true; btnStart.disabled = false; btnInit.disabled = false;
}

function flashStage(msg){
  stackEl.innerHTML = '<div class="muted">'+msg+'</div>';
}
function status(t){ statusEl.textContent = t; }
</script>
</body></html>`;
}

function renderPage({ disabled, value, error, success }) {
  const dis = disabled ? "disabled" : "";
  const disabledClass = disabled ? "opacity-60 cursor-not-allowed" : "";
  const msg =
    error ? `<p style="color:#b00020;margin-top:8px">${escapeHtml(error)}</p>` :
    success ? `<p style="color:#0a7d00;margin-top:8px">${escapeHtml(success)}</p>` : "";

  return /* html */ `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Suggestion</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; background:#0b0c0f; color:#e6e6e6; }
    .card { max-width: 560px; margin: 0 auto; background:#14161b; border:1px solid #23262d; border-radius: 16px; padding: 20px; }
    label { display:block; font-weight:600; margin-bottom: 8px; }
    input[type="text"] { width:100%; padding:12px 14px; border-radius:12px; border:1px solid #2a2f39; background:#0f1115; color:#e6e6e6; }
    button { margin-top: 12px; padding: 12px 16px; border-radius: 12px; background:#3a6ff8; color:white; border:none; font-weight:600; }
    button.${disabledClass} { background:#3a6ff8; }
    small { color:#a7aab3; }
    footer { margin-top: 16px; color:#9aa0a6; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="margin-top:0">Give a one-word suggestion</h1>
    <form method="POST" action="/submit" novalidate>
      <label for="word">Your word</label>
      <input id="word" name="word" type="text" maxlength="30" placeholder="e.g. pineapple"
             value="${escapeAttr(value || "")}" ${dis} />
      <button type="submit" ${dis} class="${disabledClass}">Submit</button>
      <div>${msg}</div>
      <footer>
        <small>${disabled ? "You’ve already submitted a word from this browser." : "One word, 30 characters max."}</small>
      </footer>
    </form>
    <p style="margin-top:20px"><a href="/count" style="color:#8ab4f8">See live count →</a> · <a href="/show" style="color:#8ab4f8">Run show →</a></p>
  </div>
</body></html>`;
}

function htmlResponse(html, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(html, { ...init, headers });
}
function jsonResponse(obj, extraHeaders = {}) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", ...extraHeaders });
  return new Response(JSON.stringify(obj), { headers });
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

function suggestedCookie(word) {
  const v = encodeURIComponent(word || "");
  return `suggested=1; word=${v}; Max-Age=2592000; Path=/; SameSite=Lax`;
}
function clearSuggestedCookie() { return `suggested=; Max-Age=0; Path=/; SameSite=Lax`; }
function readSuggestedCookie(cookieHeader) {
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
