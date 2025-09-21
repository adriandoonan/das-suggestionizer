// HTML/JSON response helpers + escaping

export function htmlResponse(html, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(html, { ...init, headers });
}

export function jsonResponse(obj, extraHeaders = {}, init = {}) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", ...extraHeaders });
  return new Response(JSON.stringify(obj), { ...init, headers });
}

export function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
  );
}

export function escapeAttr(s) {
  return escapeHtml(s);
}