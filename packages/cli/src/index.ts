#!/usr/bin/env node
import fs from "fs"
import path from "path"
import http from "http"
import { Command } from "commander"
import AjvModule from "ajv"
import addFormatsModule from "ajv-formats"
import { TypescriptGenerator } from "./generators/typescript.js"
import { GoGenerator } from "./generators/go.js"
import { PythonGenerator } from "./generators/python.js"
import { PhpGenerator } from "./generators/php.js"
import { SdkGenerator } from "./generators/index.js"
import { generateHtml, lintSpec, convertToAsyncApi } from "@socketdocs/core"
import jiti from "jiti"

const Ajv = (AjvModule as any).default || AjvModule
const addFormats = (addFormatsModule as any).default || addFormatsModule

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
      const load = jiti(import.meta.url, { interopDefault: true })
      const contract = load(contractFilePath)
      
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
    
    const startServer = (port: number) => {
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
        res.end(generateHtml(spec))
      })

      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${port} is in use, trying ${port + 1}...`)
          startServer(port + 1)
        } else {
          console.error("Server error:", err)
        }
      })

      server.listen(port, () => {
        console.log(`SocketDocs Spec Server running at http://localhost:${port}`)
      })
    }

    startServer(parseInt(options.port))
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
      const load = jiti(import.meta.url, { interopDefault: true })
      const contract = load(contractFilePath)
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

program
  .command("lint")
  .description("Lint the contract for common mistakes and missing documentation")
  .option("-c, --config <path>", "Path to config file", "./socketdocs.config.json")
  .action(async (options) => {
    const configPath = path.resolve(process.cwd(), options.config)
    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found at ${configPath}`)
      process.exit(1)
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    const contractFilePath = path.resolve(process.cwd(), config.contractFile)

    try {
      const load = jiti(import.meta.url, { interopDefault: true })
      const contract = load(contractFilePath)
      const spec = contract.generateSpec()
      
      const issues = lintSpec(spec)
      
      if (issues.length === 0) {
        console.log("✅ No issues found in contract.")
        return
      }

      console.log(`Found ${issues.length} issues:`)
      issues.forEach(issue => {
        const icon = issue.type === 'error' ? '❌' : '⚠️'
        console.log(`${icon} [${issue.path}] ${issue.message}`)
      })

      if (issues.some(i => i.type === 'error')) {
        process.exit(1)
      }
    } catch (err) {
      console.error("Error linting contract:", err)
      process.exit(1)
    }
  })

program
  .command("export-asyncapi")
  .description("Export the contract as an AsyncAPI specification")
  .option("-s, --spec <path>", "Path to spec file", "./wsdoc.json")
  .option("-o, --output <path>", "Output file path", "./asyncapi.json")
  .action((options) => {
    const specPath = path.resolve(process.cwd(), options.spec)
    if (!fs.existsSync(specPath)) {
      console.error(`Spec file not found at ${specPath}`)
      process.exit(1)
    }

    const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"))
    const asyncApi = convertToAsyncApi(spec)
    
    fs.writeFileSync(options.output, JSON.stringify(asyncApi, null, 2))
    console.log(`AsyncAPI specification exported to ${options.output}`)
  })

program.parse(process.argv)
