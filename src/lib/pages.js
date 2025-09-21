import { escapeAttr, escapeHtml } from "./respond.js";

export function renderSubmitPage({ disabled, value, error, success }) {
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
    <p style="margin-top:20px">
      <a href="/count" style="color:#8ab4f8">See live count →</a> ·
      <a href="/show" style="color:#8ab4f8">Run show →</a>
    </p>
  </div>
</body></html>`;
}

export function renderCountPage() {
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