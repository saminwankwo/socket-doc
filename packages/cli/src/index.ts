#!/usr/bin/env node
import fs from "fs"
import path from "path"
import http from "http"
import { Command } from "commander"

const program = new Command()

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
        require("ts-node").register()
      }
      
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
      if (req.url === "/api/spec") {
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Content-Type", "application/json")
        res.end(JSON.stringify(spec, null, 2))
        return
      }

      res.setHeader("Content-Type", "text/html")
      res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>SocketDocs - ${spec.info.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 1000px; margin: 0 auto; padding: 40px; background: #f8f9fa; color: #212529; }
    .card { background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 30px; border: 1px solid #e9ecef; }
    h1 { color: #007bff; font-size: 2.5rem; margin-bottom: 10px; }
    h2 { border-bottom: 2px solid #e9ecef; padding-bottom: 10px; margin-top: 0; color: #343a40; }
    .namespace { margin-bottom: 50px; }
    .event { border-left: 5px solid #007bff; padding: 20px; margin-bottom: 25px; background: #fff; border-radius: 0 8px 8px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .direction { font-weight: bold; font-size: 0.75rem; text-transform: uppercase; color: #6c757d; margin-bottom: 5px; letter-spacing: 0.05em; }
    .type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; background: #e7f1ff; color: #007bff; margin-left: 10px; vertical-align: middle; }
    pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 0.9rem; }
    .auth-badge { background: #ffc107; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-left: 10px; }
    .role-badge { background: #6c757d; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; margin-left: 5px; }
  </style>
</head>
<body>
  <div class="header card">
    <h1>SocketDocs: ${spec.info.name}</h1>
    <div style="color: #6c757d;">Version: ${spec.info.version}</div>
    <p>${spec.info.description || "No description provided."}</p>
  </div>
  
  <div id="content">
    ${Object.entries(spec.namespaces).map(([name, ns]: [string, any]) => `
      <div class="namespace">
        <h2>Namespace: ${name}</h2>
        ${Object.entries(ns.events).map(([eventName, event]: [string, any]) => `
          <div class="event card">
            <div class="direction">
              ${event.direction.replace(/_/g, " ")}
              <span class="type">${event.type.replace(/_/g, " ")}</span>
              ${event.authRequired ? '<span class="auth-badge">AUTH REQUIRED</span>' : ""}
              ${(event.roles || []).map((r: string) => `<span class="role-badge">${r}</span>`).join("")}
            </div>
            <h3 style="margin-top: 5px; margin-bottom: 10px;">${eventName}</h3>
            <p style="color: #495057;">${event.summary || event.description || "No description."}</p>
            ${event.payloadSchema ? `<h4>Payload Schema</h4><pre>${JSON.stringify(event.payloadSchema, null, 2)}</pre>` : ""}
            ${event.responseSchema ? `<h4>Response Schema</h4><pre>${JSON.stringify(event.responseSchema, null, 2)}</pre>` : ""}
          </div>
        `).join("")}
      </div>
    `).join("")}
  </div>
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
    
    if (options.lang === "ts" || options.lang === "js") {
      let sdkCode = `// Generated by SocketDocs SDK Generator v${spec.specVersion}\n\n`
      sdkCode += `export class SocketDocsClient {\n`
      sdkCode += `  constructor(private socket: any) {}\n\n`

      for (const nsName in spec.namespaces) {
        const ns = spec.namespaces[nsName]
        sdkCode += `  // Namespace: ${nsName}\n`
        for (const eventName in ns.events) {
          const event = ns.events[eventName]
          if (event.direction === "client_to_server" || event.direction === "bidirectional") {
            const isRequestResponse = event.type === "request_response"
            
            sdkCode += `  ${eventName}(payload: any): ${isRequestResponse ? 'Promise<any>' : 'void'} {\n`
            if (isRequestResponse) {
              sdkCode += `    return new Promise((resolve, reject) => {\n`
              sdkCode += `      this.socket.emit("${eventName}", payload, (response: any) => {\n`
              sdkCode += `        if (response && response.status === "error") reject(response);\n`
              sdkCode += `        else resolve(response);\n`
              sdkCode += `      });\n`
              sdkCode += `    });\n`
            } else {
              sdkCode += `    this.socket.emit("${eventName}", payload);\n`
            }
            sdkCode += `  }\n`
          }
        }
        sdkCode += `\n`
      }
      sdkCode += `}\n`

      const ext = options.lang === "ts" ? ".ts" : ".js"
      const outputPath = options.output.endsWith(ext) ? options.output : options.output + ext
      fs.writeFileSync(outputPath, sdkCode)
      console.log(`SDK generated at ${outputPath}`)
    } else {
      console.error(`SDK generation for ${options.lang} is not yet implemented.`)
    }
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
        require("ts-node").register()
      }
      const mod = require(contractFilePath)
      const contract = mod.contract || mod.default
      if (!contract) throw new Error("Contract not found")
      console.log("Contract is valid.")
    } catch (err) {
      console.error("Contract validation failed:", err)
      process.exit(1)
    }
  })

program.parse(process.argv)
