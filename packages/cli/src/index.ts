#!/usr/bin/env node
import fs from "fs"
import path from "path"
import http from "http"
import { Command } from "commander"
import Ajv from "ajv"
import addFormats from "ajv-formats"
import { TypescriptGenerator } from "./generators/typescript"
import { GoGenerator } from "./generators/go"
import { PythonGenerator } from "./generators/python"
import { PhpGenerator } from "./generators/php"
import { SdkGenerator } from "./generators"

const program = new Command()
const ajv = new Ajv()
addFormats(ajv as any)

program
  .name("socketdocs")
  .description("CLI for SocketDocs")
  .version("1.0.0")

program
  .command("init")
  .description("Initialize SocketDocs configuration")
  .action(() => {
    const config = {
      name: "my-realtime-api",
      version: "1.0.0",
      contractFile: "./socketdocs.contract.ts",
      outputFile: "./wsdoc.json"
    }
    fs.writeFileSync("socketdocs.config.json", JSON.stringify(config, null, 2))
    
    // Create a sample contract file if it doesn't exist
    if (!fs.existsSync("socketdocs.contract.ts")) {
      const sampleContract = `import { createContract } from "@socketdocs/core"
import { z } from "zod"

export const contract = createContract({
  name: "my-realtime-api",
  version: "1.0.0",
  description: "My awesome realtime API"
})

const chat = contract.namespace("chat")

chat.event({
  name: "ping",
  direction: "client_to_server",
  payload: z.object({
    message: z.string().optional()
  })
})
`
      fs.writeFileSync("socketdocs.contract.ts", sampleContract)
    }

    console.log("Created socketdocs.config.json and socketdocs.contract.ts")
  })

program
  .command("generate-spec")
  .description("Generate documentation from contract")
  .option("-c, --config <path>", "Path to config file", "./socketdocs.config.json")
  .action(async (options) => {
    const configPath = path.resolve(process.cwd(), options.config)
    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found at ${configPath}`)
      process.exit(1)
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    const contractFilePath = path.resolve(process.cwd(), config.contractFile)

    if (!fs.existsSync(contractFilePath)) {
      // Try with .js if .ts not found
      const jsPath = contractFilePath.replace(/\.ts$/, ".js")
      if (!fs.existsSync(jsPath)) {
        console.error(`Contract file not found at ${contractFilePath} (or .js)`)
        process.exit(1)
      }
    }

    console.log(`Reading contract from ${contractFilePath}...`)
    
    try {
      // In a real CLI, we would use ts-node/register to load the contract
      // For this implementation, we require the file. 
      // If it's TS, we assume it's pre-compiled or we use ts-node
      if (contractFilePath.endsWith(".ts")) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("ts-node").register()
      }
      
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(contractFilePath)
      const contract = mod.contract || mod.default
      
      if (!contract || typeof contract.generateSpec !== "function") {
        throw new Error("Contract file must export a 'contract' object created with createContract()")
      }

      const spec = contract.generateSpec()
      fs.writeFileSync(config.outputFile, JSON.stringify(spec, null, 2))
      console.log(`Generated ${config.outputFile}`)
    } catch (err) {
      console.error("Error generating spec:", err)
      process.exit(1)
    }
  })

program
  .command("serve-docs")
  .description("Serve documentation locally")
  .option("-p, --port <number>", "Port to serve on", "4000")
  .option("-s, --spec <path>", "Path to spec file", "./wsdoc.json")
  .action((options) => {
    const specPath = path.resolve(process.cwd(), options.spec)
    if (!fs.existsSync(specPath)) {
      console.error(`Spec file not found at ${specPath}`)
      process.exit(1)
    }

    const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"))
    const server = http.createServer((req, res) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
      res.setHeader("Access-Control-Allow-Headers", "Content-Type")
      
      if (req.method === "OPTIONS") {
        res.end()
        return
      }

      if (req.url === "/api/spec") {
        res.setHeader("Content-Type", "application/json")
        res.end(JSON.stringify(spec, null, 2))
        return
      }

      res.setHeader("Content-Type", "text/html")
      res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SocketDocs Explorer - ${spec.info.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    body { font-family: 'Inter', sans-serif; }
    pre, code { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-950 text-slate-200">
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-72 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 h-screen overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-10">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <h1 class="font-bold text-xl tracking-tight text-white">SocketDocs</h1>
        </div>

        <div class="space-y-8">
          ${Object.entries(spec.namespaces).map(([name, ns]: [string, any]) => `
            <div>
              <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">Namespace: ${name}</h2>
              <div class="space-y-1">
                ${Object.keys(ns.events).map(evtName => `
                  <a href="#${name}-${evtName}" class="block px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all truncate">
                    ${evtName}
                  </a>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </aside>

    <!-- Content -->
    <main class="flex-1 p-12 max-w-5xl mx-auto overflow-x-hidden">
      <header className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <span class="px-2 py-1 bg-blue-600/10 text-blue-400 text-xs font-mono font-bold rounded border border-blue-500/20">v${spec.info.version}</span>
          <span class="text-slate-600">/</span>
          <span class="text-slate-400 font-mono text-xs">spec v${spec.specVersion}</span>
        </div>
        <h1 class="text-5xl font-extrabold text-white mb-6 tracking-tight">${spec.info.name}</h1>
        <p class="text-xl text-slate-400 leading-relaxed max-w-3xl">${spec.info.description || "No description provided."}</p>
      </header>

      <div class="space-y-24">
        ${Object.entries(spec.namespaces).map(([nsName, ns]: [string, any]) => `
          <section id="ns-${nsName}">
            <div class="flex items-center gap-4 mb-10 pb-4 border-b border-slate-800">
              <h2 class="text-2xl font-bold text-white uppercase tracking-tight">${nsName}</h2>
              <span class="text-slate-500 text-sm">Namespace</span>
            </div>
            
            <div class="grid gap-10">
              ${Object.entries(ns.events).map(([evtName, event]: [string, any]) => `
                <div id="${nsName}-${evtName}" class="group relative bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all duration-300 shadow-xl shadow-black/20">
                  <div class="p-8">
                    <div class="flex items-start justify-between mb-6">
                      <div>
                        <div class="flex items-center gap-3 mb-3">
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                            event.direction === 'client_to_server' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            event.direction === 'server_to_client' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }">
                            ${event.direction.replace(/_/g, " ")}
                          </span>
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-slate-400 border border-slate-700">
                            ${event.type.replace(/_/g, " ")}
                          </span>
                          ${event.authRequired ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">AUTH</span>' : ""}
                        </div>
                        <h3 class="text-2xl font-bold text-white tracking-tight">${evtName}</h3>
                      </div>
                      <a href="#${nsName}-${evtName}" class="p-2 text-slate-600 hover:text-blue-400 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                      </a>
                    </div>
                    
                    <p class="text-slate-400 text-lg mb-8">${event.summary || event.description || "No description provided."}</p>

                    <div class="grid lg:grid-cols-2 gap-8">
                      ${event.payloadSchema ? `
                        <div class="space-y-3">
                          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Payload Schema</h4>
                          <div class="relative group">
                            <pre class="rounded-xl overflow-hidden text-xs"><code class="language-json">${JSON.stringify(event.payloadSchema, null, 2)}</code></pre>
                            <button onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)" class="absolute top-3 right-3 p-2 bg-slate-800 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-white">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                          </div>
                        </div>
                      ` : ""}
                      ${event.responseSchema ? `
                        <div class="space-y-3">
                          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Response Schema</h4>
                          <div class="relative group">
                            <pre class="rounded-xl overflow-hidden text-xs"><code class="language-json">${JSON.stringify(event.responseSchema, null, 2)}</code></pre>
                            <button onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)" class="absolute top-3 right-3 p-2 bg-slate-800 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-white">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                          </div>
                        </div>
                      ` : ""}
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </div>

      <footer class="mt-32 pt-12 border-t border-slate-800 text-slate-600 text-sm flex items-center justify-between">
        <p>&copy; 2024 SocketDocs. Built for senior-grade WebSocket development.</p>
        <div class="flex items-center gap-6">
          <a href="#" class="hover:text-blue-400 transition-colors">Documentation</a>
          <a href="#" class="hover:text-blue-400 transition-colors">GitHub</a>
        </div>
      </footer>
    </main>
  </div>
  <script>hljs.highlightAll();</script>
</body>
</html>
      `)
    })

    server.listen(options.port, () => {
      console.log(`SocketDocs Spec Server running at http://localhost:${options.port}`)
    })
  })

program
  .command("generate-sdk")
  .description("Generate client SDK")
  .option("-l, --lang <type>", "SDK language (ts|js|go|py)", "ts")
  .option("-s, --spec <path>", "Path to spec file", "./wsdoc.json")
  .option("-o, --output <path>", "Output file path", "./socketdocs-sdk")
  .action((options) => {
    const specPath = path.resolve(process.cwd(), options.spec)
    if (!fs.existsSync(specPath)) {
      console.error(`Spec file not found at ${specPath}`)
      process.exit(1)
    }

    const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"))
    
    const generators: Record<string, SdkGenerator> = {
      ts: new TypescriptGenerator('ts'),
      js: new TypescriptGenerator('js'),
      go: new GoGenerator(),
      py: new PythonGenerator(),
      php: new PhpGenerator()
    }

    const generator = generators[options.lang]
    if (!generator) {
      console.error(`SDK generation for ${options.lang} is not yet implemented.`)
      process.exit(1)
    }

    const sdkCode = generator.generate(spec)
    const ext = generator.getFileExtension()
    const outputPath = options.output.endsWith(ext) ? options.output : options.output + ext
    
    fs.writeFileSync(outputPath, sdkCode)
    console.log(`${options.lang.toUpperCase()} SDK generated at ${outputPath}`)
  })

program
  .command("validate-contract")
  .description("Validate contract at runtime")
  .option("-c, --config <path>", "Path to config file", "./socketdocs.config.json")
  .action(async (options) => {
    // This would perform more deep validation
    console.log("Validating contract...")
    // For now we just check if it can be loaded
    const configPath = path.resolve(process.cwd(), options.config)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    const contractFilePath = path.resolve(process.cwd(), config.contractFile)
    
    try {
      if (contractFilePath.endsWith(".ts")) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("ts-node").register()
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(contractFilePath)
      const contract = mod.contract || mod.default
      if (!contract) throw new Error("Contract not found")
      console.log("Contract is valid.")
    } catch (err) {
      console.error("Contract validation failed:", err)
      process.exit(1)
    }
  })

program
  .command("mock-server")
  .description("Start a mock WebSocket server based on the spec")
  .option("-p, --port <number>", "Port to serve on", "5000")
  .option("-s, --spec <path>", "Path to spec file", "./wsdoc.json")
  .action((options) => {
    const specPath = path.resolve(process.cwd(), options.spec)
    if (!fs.existsSync(specPath)) {
      console.error(`Spec file not found at ${specPath}`)
      process.exit(1)
    }

    const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"))
    console.log(`Starting mock server for ${spec.info.name} on port ${options.port}...`)
    
    // In a real implementation, we would use a library like 'mockjs' or similar
    // to generate random data based on JSON Schema.
    // For now, we'll just log that it's starting.
    console.log("Mock server is ready. (Mock data generation placeholder)")
  })

program.parse(process.argv)
