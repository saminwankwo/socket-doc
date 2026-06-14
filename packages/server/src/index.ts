import { Request, Response, NextFunction, Router, static as expressStatic } from "express";
import { 
  SocketDocsSchema, 
  Contract, 
  convertSocketDocsSchemaToContract, 
  convertContractToSocketDocsSchema,
  generateHtml
} from "@socketdocs/core";
import { fileURLToPath } from "url";
import { dirname, join, existsSync } from "path";
import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";

export interface SocketDocsOptions {
  path?: string;
  schema?: SocketDocsSchema | (() => SocketDocsSchema);
  contract?: Contract | (() => Contract);
  auth?: { username: string; password: string } | ((req: Request, res: Response, next: NextFunction) => void);
  customCss?: string;
  title?: string;
  servers?: Array<{ url: string; label: string }>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Basic authentication middleware
 */
function basicAuthMiddleware(auth: { username: string; password: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader("WWW-Authenticate", 'Basic realm="SocketDocs"');
      res.sendStatus(401);
      return;
    }

    const [type, credentials] = authHeader.split(" ");
    if (type !== "Basic") {
      res.setHeader("WWW-Authenticate", 'Basic realm="SocketDocs"');
      res.sendStatus(401);
      return;
    }

    const [username, password] = Buffer.from(credentials, "base64").toString().split(":");
    if (username === auth.username && password === auth.password) {
      next();
      return;
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="SocketDocs"');
    res.sendStatus(401);
  };
}

/**
 * Express middleware to serve SocketDocs UI and schema
 */
export function socketDocs(options: SocketDocsOptions) {
  const router = Router();
  const basePath = options.path || "/socket-docs";

  // Apply auth middleware if enabled
  if (options.auth) {
    if (typeof options.auth === "function") {
      router.use(options.auth);
    } else {
      router.use(basicAuthMiddleware(options.auth));
    }
  }

  // Helper to get the schema
  const getSchema = (): SocketDocsSchema => {
    if (options.schema) {
      return typeof options.schema === "function" ? options.schema() : options.schema;
    }
    if (options.contract) {
      const contract = typeof options.contract === "function" ? options.contract() : options.contract;
      return convertContractToSocketDocsSchema(contract, options.servers || []);
    }
    throw new Error("Either schema or contract must be provided");
  };

  // Serve schema.json
  router.get("/schema.json", (req: Request, res: Response) => {
    res.json(getSchema());
  });

  // Try to serve docs-server static files first
  const docsDistPath = join(__dirname, "../../docs-server/dist");
  if (existsSync(docsDistPath)) {
    router.use(expressStatic(docsDistPath));
  }

  // Serve UI (SPA fallback)
  router.get("*", (req: Request, res: Response) => {
    if (existsSync(docsDistPath)) {
      res.sendFile(join(docsDistPath, "index.html"));
    } else {
      // Fallback to generateHtml
      const contract = options.contract 
        ? (typeof options.contract === "function" ? options.contract() : options.contract)
        : convertSocketDocsSchemaToContract(getSchema());
      const spec = contract.generateSpec();
      res.send(generateHtml(spec, { customCss: options.customCss, title: options.title }));
    }
  });

  return router;
}

/**
 * NestJS SocketDocsModule with setup method to serve UI and schema
 */
export class SocketDocsModule {
  /**
   * Sets up SocketDocs UI and schema serving in a NestJS application
   */
  static setup(
    path: string,
    app: INestApplication,
    schemaOrContract: SocketDocsSchema | Contract,
    options: Omit<SocketDocsOptions, "path" | "schema" | "contract"> = {}
  ) {
    const expressApp = app.getHttpAdapter().getInstance() as any;

    // Determine if it's a Contract or SocketDocsSchema
    let contract: Contract;
    let schema: SocketDocsSchema | undefined;

    if ("generateSpec" in schemaOrContract) {
      contract = schemaOrContract;
    } else {
      schema = schemaOrContract;
      contract = convertSocketDocsSchemaToContract(schema);
    }

    // Use the Express middleware
    expressApp.use(
      path,
      socketDocs({
        ...options,
        path,
        contract
      })
    );
  }
}
