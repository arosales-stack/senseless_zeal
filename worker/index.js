// Worker entry: serves the static site and the order endpoint.
// The order logic lives in functions/api/order.js so the same file also works on Cloudflare Pages.
import { onRequestPost } from "../functions/api/order.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/order") {
      if (request.method === "POST") return onRequestPost({ request, env, ctx });
      return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    }
    return env.ASSETS.fetch(request);
  },
};
