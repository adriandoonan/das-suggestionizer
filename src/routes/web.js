import { htmlResponse } from "../lib/respond.js";
import { renderSubmitPage, renderCountPage } from "../lib/pages.js";
import { renderShowPage } from "../lib/show_page.js";
import { readSuggestedCookie, suggestedCookie, clearSuggestedCookie } from "../lib/cookies.js";
import { normalizeWord, validateWord } from "../lib/validate.js";
import { insertSuggestion } from "../lib/db.js";

export async function handleWeb(request, env) {
  const url = new URL(request.url);

  // Pages
  if (request.method === "GET" && url.pathname === "/") {
    const { suggested, word } = readSuggestedCookie(request.headers.get("Cookie"));
    return htmlResponse(renderSubmitPage({ disabled: suggested, value: word || "" }));
  }

  if (request.method === "GET" && url.pathname === "/count") {
    return htmlResponse(renderCountPage());
  }

  if (request.method === "GET" && url.pathname === "/show") {
    return htmlResponse(renderShowPage());
  }

  // Submit
  if (request.method === "POST" && url.pathname === "/submit") {
    const formData = await request.formData();
    const wordRaw = (formData.get("word") || "").toString().trim();

    const word = normalizeWord(wordRaw);
    const validationError = validateWord(word);
    if (validationError) {
      return htmlResponse(
        renderSubmitPage({ disabled: false, value: wordRaw, error: validationError }),
        { status: 400, headers: { "Set-Cookie": clearSuggestedCookie() } }
      );
    }

    try {
      await insertSuggestion(env, word);
      return htmlResponse(
        renderSubmitPage({ disabled: true, value: word, success: "Thanks! Your suggestion was saved." }),
        { headers: { "Set-Cookie": suggestedCookie(word) } }
      );
    } catch (e) {
      console.error("DB error:", e);
      const msg = /no such table/i.test(String(e)) ? "Database not initialized." : "Failed to save your suggestion.";
      return htmlResponse(
        renderSubmitPage({ disabled: false, value: word, error: msg }),
        { status: 500, headers: { "Set-Cookie": clearSuggestedCookie() } }
      );
    }
  }

  return new Response("Not found", { status: 404 });
}