import { headersFor } from "./headers.js";
import { redirectTarget } from "./redirect.js";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const target = redirectTarget(request.url);
    if (target) return Response.redirect(target, 301);
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    for (const [name, value] of Object.entries(headersFor(new URL(request.url).pathname, asset.status))) {
      response.headers.set(name, value);
    }
    return response;
  },
};
