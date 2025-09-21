// Standalone template for /show page
export function renderShowPage() {
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
      <input id="setLength" type="number" step="1" min="1" value="10" />
      <select id="setUnit" style="padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:#0f1115;color:var(--fg)">
        <option value="minutes">minutes</option>
        <option value="seconds" selected>seconds</option>
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

const utterance = new SpeechSynthesisUtterance("Hello world!");
const synth = window.speechSynthesis;


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

const getRandomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;   

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

  // Fit the entire list into the selected set length
  const totalSeconds = unit === 'minutes' ? setLengthVal * 60 : setLengthVal;
  const intervalSeconds = Math.max(0.25, totalSeconds / order.length); // min 250ms

  index = -1;
  running = true; paused = false;
  btnPause.disabled = false; btnReset.disabled = false; btnStart.disabled = true; 

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
    // Restart with same cadence
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
    utterance.text = "and that's our show";
    utterance.voice = synth.getVoices()[getRandomInteger(0,175)]
    synth.speak(utterance);
    status('Complete.');
    return;
  }
  const current = order[index];
  const history = order.slice(Math.max(0, index - 4), index).reverse(); // up to 4 trailing
  renderStack([current, ...history]);
  utterance.text = current;
  utterance.voice = synth.getVoices()[getRandomInteger(0,175)]
  synth.speak(utterance);
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
  btnPause.disabled = true; btnReset.disabled = true; btnStart.disabled = false;
}

function flashStage(msg){ stackEl.innerHTML = '<div class="muted">'+msg+'</div>'; }
function status(t){ statusEl.textContent = t; }

</script>
</body></html>`;
}