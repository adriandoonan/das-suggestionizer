import { htmlResponse } from "../lib/respond.js";
import { renderSubmitPage, renderCountPage } from "../lib/pages.js";
import { renderShowPage } from "../lib/show_page.js";
import { readSuggestionCooldown, suggestionCooldownCookie, clearSuggestionCookies } from "../lib/cookies.js";
import { normalizeWord, validateWord } from "../lib/validate.js";
import { insertSuggestion } from "../lib/db.js";

function setManyCookies(cookieArray) {
  const h = new Headers();
  for (const c of cookieArray) h.append("Set-Cookie", c);
  return h;
}

export async function handleWeb(request, env) {
  const url = new URL(request.url);

  // Pages
  if (request.method === "GET" && url.pathname === "/") {
    const { disabled, word } = readSuggestionCooldown(request.headers.get("Cookie"));
    return htmlResponse(renderSubmitPage({ disabled, value: word || "" }));
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
        { status: 400, headers: setManyCookies(clearSuggestionCookies()) }
      );
    }

    try {
      await insertSuggestion(env, word);
      return htmlResponse(
        renderSubmitPage({ disabled: true, value: word, success: "Thanks! Your suggestion was saved." }),
        { headers: setManyCookies(suggestionCooldownCookie(word, 30)) }
      );
    } catch (e) {
      console.error("DB error:", e);
      const msg = /no such table/i.test(String(e)) ? "Database not initialized." : "Failed to save your suggestion.";
      return htmlResponse(
        renderSubmitPage({ disabled: false, value: word, error: msg }),
        { status: 500, headers: setManyCookies(clearSuggestionCookies()) }
      );
    }
  }

  return new Response("Not found", { status: 404 });
}