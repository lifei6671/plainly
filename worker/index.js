export default {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request);

    if (response.status === 404) {
      const accept = request.headers.get("Accept") || "";
      const isHtmlRequest = (request.method === "GET" || request.method === "HEAD") && accept.includes("text/html");

      if (isHtmlRequest) {
        const url = new URL(request.url);
        const indexRequest = new Request(new URL("/index.html", url), request);
        response = await env.ASSETS.fetch(indexRequest);
      }
    }

    return response;
  },
};
