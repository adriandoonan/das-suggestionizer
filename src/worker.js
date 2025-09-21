import { handleApi } from "./routes/api.js";
import { handleWeb } from "./routes/web.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API endpoints first
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, ctx);
    }

    // Web pages
    return handleWeb(request, env, ctx);
  },
};