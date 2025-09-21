import { jsonResponse } from "../lib/respond.js";
import { countSuggestions, listSuggestions, clearSuggestions } from "../lib/db.js";

export async function handleApi(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/count") {
    const count = await countSuggestions(env);
    return jsonResponse({ count }, { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" });
  }

  if (request.method === "GET" && url.pathname === "/api/suggestions") {
    const words = await listSuggestions(env);
    return jsonResponse({ words }, { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" });
  }

  if (request.method === "POST" && url.pathname === "/api/init") {
    await clearSuggestions(env);
    return jsonResponse({ ok: true });
  }

  return new Response("Not found", { status: 404 });
}