// SPA fallback for Cloudflare Pages.
//
// Cloudflare's _redirects validator rejects catch-all rewrites to /index.html
// or / (error 10021 "infinite loop detected"), so SPA routing is handled by a
// Pages Function instead. Unmatched navigation routes get index.html so React
// Router works on refresh and deep links; real file paths (with a file
// extension) still 404 normally. Static assets (sw.js, manifest.webmanifest,
// /assets/*, /icons/*) are excluded from this function via public/_routes.json
// and are served directly by Cloudflare, so the PWA is unaffected.
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const response = await next();

  // Only rewrite requests that aren't real files and don't look like files.
  if (response.status === 404 && !/\.[a-zA-Z0-9]{2,5}$/.test(url.pathname)) {
    const index = env.ASSETS
      ? await env.ASSETS.fetch(new URL('/index.html', url))
      : await fetch(new URL('/index.html', url));
    return new Response(index.body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    });
  }

  return response;
}
