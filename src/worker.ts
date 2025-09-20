export interface Env {
  DB: D1Database;
  CONTROL_PASSWORD?: string;
}

const html = (
  body: string,
  title = "Improv Show"
) => `<!doctype html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { margin:0; font-family:sans-serif; background:#0f172a; color:#e2e8f0; display:grid; place-items:center; min-height:100vh; }
  .card { background:#111827; padding:24px; border-radius:16px; max-width:900px; width:100%; display:grid; gap:16px; }
  input,button { font-size:18px; padding:8px; }
  button { border-radius:8px; }
  .big { font-size:clamp(48px,10vw,128px); font-weight:bold; text-align:center; margin:40px 0; }
  pre { background:#0b1220; padding:12px; border-radius:8px; }
</style>
</head><body><div class="card">${body}</div></body></html>`;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/" || p === "/suggest") return suggestPage();
    if (p === "/show") return showPage();

    if (p === "/api/suggest" && req.method === "POST")
      return apiSuggest(req, env);
    if (p === "/api/clear" && req.method === "POST")
      return guard(env, req, () => apiClear(env));
    if (p === "/api/stats") return apiStats(env);
    if (p === "/api/start" && req.method === "POST")
      return guard(env, req, () => apiStart(req, env));
    if (p === "/api/pause" && req.method === "POST")
      return guard(env, req, () => apiPause(env, true));
    if (p === "/api/resume" && req.method === "POST")
      return guard(env, req, () => apiPause(env, false));
    if (p === "/api/current-set") return apiCurrentSet(env);

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function suggestPage() {
  const body = `
    <h1>One‑Word Suggestion</h1>
    <form id=f><input id=word required maxlength=48 /><button>Submit</button></form>
    <div id=msg></div>
    <script>
      f.onsubmit=async e=>{e.preventDefault();
        let w=word.value.trim().split(/\s+/)[0];
        if(!w) return;
        let r=await fetch('/api/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:w})});
        msg.textContent=r.ok?'Thanks!':'Error'; word.value='';}
    </script>`;
  return new Response(html(body, "Suggest a Word"), {
    headers: { "content-type": "text/html" },
  });
}

function showPage() {
  const body = `
    <h1>Improv Show Control & Display</h1>
    <div>
      <input id=len type=number value=300 /> seconds <button id=start>Start</button>
      <button id=pause>Pause</button> <button id=resume>Resume</button>
      <button id=clear>Clear</button>
    </div>
    <pre id=stats></pre>
    <div class=big id=word>Waiting…</div>
    <script>
      let sched=[],i=0,unit=1000,paused=false;
      async function stats(){let r=await fetch('/api/stats');statsEl.textContent=JSON.stringify(await r.json(),null,2)}
      const statsEl=document.getElementById('stats');stats();setInterval(stats,4000)

      start.onclick=async()=>{await fetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seconds:+len.value})});load()}
      pause.onclick=()=>fetch('/api/pause',{method:'POST'})
      resume.onclick=()=>fetch('/api/resume',{method:'POST'})
      clear.onclick=()=>fetch('/api/clear',{method:'POST'})

      async function load(){let r=await fetch('/api/current-set',{cache:'no-store'});if(!r.ok){setTimeout(load,800);return}
        let j=await r.json();if(!j||!j.schedule){setTimeout(load,800);return}
        sched=j.schedule.words;unit=j.schedule.unitMs;paused=j.paused;i=0;tick();}
      function tick(){if(!sched.length){word.textContent='(no suggestions)';return}
        if(paused){setTimeout(tick,300);return}word.textContent=sched[i%sched.length];i++;setTimeout(tick,unit)}
      setInterval(async()=>{let r=await fetch('/api/current-set');if(r.ok){let j=await r.json();paused=j.paused}},1200)
      load()
    </script>`;
  return new Response(html(body, "Show"), {
    headers: { "content-type": "text/html" },
  });
}

// Helpers
function parseCookies(h: string | null) {
  const out: Record<string, string> = {};
  if (!h) return out;
  for (const part of h.split(";")) {
    const [k, ...v] = part.split("=");
    out[k.trim()] = decodeURIComponent(v.join("=") || "");
  }
  return out;
}
function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function ensureClientId(req: Request) {
  const cookies = parseCookies(req.headers.get("cookie"));
  let id = cookies["cid"];
  if (!id) {
    id = randomHex(16);
    return {
      id,
      setCookie: `cid=${id}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`,
    };
  }
  return { id };
}

// API
async function apiSuggest(req: Request, env: Env) {
  const { word } = await req.json().catch(() => ({ word: "" }));
  const trimmed = (word || "").trim().split(/\s+/)[0];
  if (!trimmed) return json({ ok: false }, 400);
  const { id, setCookie } = ensureClientId(req);
  await env.DB.prepare(
    "INSERT INTO suggestions (word,created_at,client_id) VALUES (?,?,?)"
  )
    .bind(trimmed, Date.now(), id)
    .run();
  const res = json({ ok: true });
  if (setCookie) res.headers.set("set-cookie", setCookie);
  return res;
}
async function apiClear(env: Env) {
  await env.DB.prepare("DELETE FROM suggestions").run();
  return json({ ok: true });
}
async function apiStats(env: Env) {
  const q = `SELECT word,COUNT(DISTINCT COALESCE(client_id,CAST(id AS TEXT))||':'||CAST(created_at/5000 AS INT)) as n FROM suggestions GROUP BY word ORDER BY n DESC`;
  const rs = await env.DB.prepare(q).all<{ word: string; n: number }>();
  return json({
    total: rs.results?.reduce((a, r) => a + (r.n || 0), 0) || 0,
    words: rs.results || [],
  });
}
async function apiStart(req: Request, env: Env) {
  const { seconds } = await req.json().catch(() => ({ seconds: 300 }));
  const lenMs = Math.max(10, seconds || 300) * 1000;
  const q = `SELECT word,COUNT(DISTINCT COALESCE(client_id,CAST(id AS TEXT))||':'||CAST(created_at/5000 AS INT)) as n FROM suggestions GROUP BY word`;
  const rs = await env.DB.prepare(q).all<{ word: string; n: number }>();
  const words = (rs.results || []).filter((r) => r.word && r.n > 0);
  const totalUnits = words.reduce((a, r) => a + r.n, 0);
  const unitMs = totalUnits ? Math.floor(lenMs / totalUnits) : lenMs;
  const sched: string[] = [];
  for (const { word, n } of words) {
    for (let i = 0; i < n; i++) sched.push(word);
  }
  shuffle(sched);
  const schedule = { unitMs, words: sched };
  await env.DB.prepare("UPDATE sets SET ended_at=? WHERE ended_at IS NULL")
    .bind(Date.now())
    .run();
  await env.DB.prepare(
    "INSERT INTO sets (length_ms,started_at,paused,ended_at,schedule_json) VALUES (?,?,?,?,?)"
  )
    .bind(lenMs, Date.now(), 0, null, JSON.stringify(schedule))
    .run();
  return json({ ok: true, schedule });
}
async function apiPause(env: Env, pause: boolean) {
  await env.DB.prepare("UPDATE sets SET paused=? WHERE ended_at IS NULL")
    .bind(pause ? 1 : 0)
    .run();
  return json({ ok: true, paused: pause });
}
async function apiCurrentSet(env: Env) {
  const r = await env.DB.prepare(
    "SELECT * FROM sets WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1"
  ).get();
  if (!r) return json({ error: "no-active-set" }, 404);
  return json({
    id: r.id,
    paused: !!r.paused,
    schedule: JSON.parse(r.schedule_json),
  });
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// Guard
async function guard(env: Env, req: Request, fn: () => Promise<Response>) {
  const configured = (env.CONTROL_PASSWORD || "").trim();
  if (!configured) return fn();
  const h = (req.headers.get("x-control-password") || "").trim();
  if (h === configured) return fn();
  return json({ error: "forbidden" }, 403);
}
