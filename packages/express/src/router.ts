import { Router, static as expressStatic } from "express";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { EventRegistry } from "@socketdocs/core";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

export interface DocsRouterOptions {
  path?: string;
  auth?: { username: string; password: string } | RequestHandler;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function basicAuthMiddleware(auth: { username: string; password: string }): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader("WWW-Authenticate", 'Basic realm="SocketDocs"');
      res.status(401).send("Unauthorized");
      return;
    }

    const [type, credentials] = authHeader.split(" ");
    if (type !== "Basic" || !credentials) {
      res.setHeader("WWW-Authenticate", 'Basic realm="SocketDocs"');
      res.status(401).send("Unauthorized");
      return;
    }

    const [username, password] = Buffer.from(credentials, "base64").toString().split(":");
    if (username === auth.username && password === auth.password) {
      next();
      return;
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="SocketDocs"');
    res.status(401).send("Unauthorized");
  };
}

const MISSING_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SocketDocs UI Not Found</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .box { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 500px; }
    h1 { color: #f87171; font-size: 20px; margin-top: 0; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-family: monospace; }
  </style>
</head>
<body>
  <div class="box">
    <h1>SocketDocs UI Bundle Missing</h1>
    <p>The UI bundle was not found at <code>ui-dist/index.html</code>.</p>
    <p>If running from source, run <code>npm run build</code> in the root repository to build the UI and copy the assets.</p>
  </div>
</body>
</html>`;

/**
 * Creates the Express router that serves spec.json and the bundled UI.
 */
export function createDocsRouter(
  registry: EventRegistry,
  options: DocsRouterOptions = {}
): Router {
  const router = Router();

  // 1. Auth middleware (if configured) applies to ALL routes
  if (options.auth) {
    if (typeof options.auth === "function") {
      router.use(options.auth);
    } else {
      router.use(basicAuthMiddleware(options.auth));
    }
  }

  // 2. Spec endpoint: GET spec.json
  router.get("/spec.json", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.json(registry.toSpec());
  });

  // 3. Resolve ui-dist directory relative to this package's dist folder: ../ui-dist
  const uiDistPath = join(__dirname, "../ui-dist");
  const hasUiDist = existsSync(uiDistPath);

  if (hasUiDist) {
    // Serve static files
    router.use(expressStatic(uiDistPath));

    // SPA fallback. A plain middleware (instead of a "*" route) keeps this
    // working on both Express 4 and Express 5.
    router.use((_req: Request, res: Response) => {
      res.sendFile(join(uiDistPath, "index.html"));
    });
  } else {
    // Fallback if ui-dist is missing
    router.use((_req: Request, res: Response) => {
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(MISSING_UI_HTML);
    });
  }

  return router;
}

export interface MountDocsOptions {
  /** Mount path of the docs UI, e.g. "/socket-docs". */
  path?: string;
  auth?: { username: string; password: string } | RequestHandler;
}

/** Minimal shape of an Express app (or Nest's Express adapter instance). */
export type ExpressAppLike = {
  get: (...args: any[]) => any;
  use: (...args: any[]) => any;
};

/**
 * Mounts the docs UI at `path` on an Express app:
 *
 * - `GET <path>` (no trailing slash) 301-redirects to `<path>/` so that the
 *   relative `./spec.json` and asset URLs in the UI resolve correctly.
 * - `GET <path>/spec.json` serves the live spec.
 * - everything else under `<path>` is served from the bundled UI.
 *
 * This is the single implementation of routes, auth and static serving shared
 * by `@socketdocs/express` and `@socketdocs/nestjs`.
 */
export function mountDocs(
  app: ExpressAppLike,
  registry: EventRegistry,
  options: MountDocsOptions = {}
): string {
  const mountPath = options.path ?? "/socket-docs";
  const stripped = mountPath.replace(/^\/+|\/+$/g, "");
  const normalizedPath = stripped ? `/${stripped}` : "/socket-docs";

  app.get(normalizedPath, (req: any, res: any, next: any) => {
    // Express treats "/path" and "/path/" as the same route, so only redirect
    // requests that are actually missing the trailing slash.
    if (typeof req.path === "string" && req.path !== normalizedPath) {
      return next();
    }
    const queryIndex = typeof req.url === "string" ? req.url.indexOf("?") : -1;
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    res.redirect(301, `${normalizedPath}/${query}`);
  });

  const router = createDocsRouter(registry, { auth: options.auth });
  app.use(normalizedPath, router);

  return normalizedPath;
}
