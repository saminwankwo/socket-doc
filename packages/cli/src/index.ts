#!/usr/bin/env node
import fs from "fs"
import path from "path"
import http from "http"
import { Command } from "commander"
import AjvModule from "ajv"
import addFormatsModule from "ajv-formats"
import { faker } from "@faker-js/faker"
import { Server } from "socket.io"
import { TypescriptGenerator } from "./generators/typescript.js"
import { GoGenerator } from "./generators/go.js"
import { PythonGenerator } from "./generators/python.js"
import { PhpGenerator } from "./generators/php.js"
import { SdkGenerator } from "./generators/index.js"
import { generateHtml, lintSpec, convertToAsyncApi, LintIssue } from "@socketdocs/core"
import jiti from "jiti"

const Ajv = (AjvModule as any).default || AjvModule
const addFormats = (addFormatsModule as any).default || addFormatsModule

const ajv = new Ajv()
addFormats(ajv)

const program = new Command()

/**
 * Generate mock data from a JSON schema
 */
function generateMockData(schema: any): any {
  if (!schema) return undefined

  switch (schema.type) {
    case "string":
      if (schema.format === "email") return faker.internet.email()
      if (schema.format === "uri") return faker.internet.url()
      if (schema.format === "uuid") return faker.string.uuid()
      if (schema.format === "date-time") return faker.date.anytime().toISOString()
      if (schema.enum && schema.enum.length > 0) {
        return faker.helpers.arrayElement(schema.enum)
      }
      if (schema.pattern) {
        // Simple fallback for patterns
        return faker.string.alphanumeric(10)
      }
      const minLength = schema.minLength || 5
      const maxLength = schema.maxLength || 20
      return faker.lorem.words(
        Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength
      )

    case "number":
    case "integer":
      const min = schema.minimum || 0
      const max = schema.maximum || 100
      const num = faker.number.int({ min, max })
      return schema.type === "integer" ? Math.floor(num) : num

    case "boolean":
      return faker.datatype.boolean()

    case "array":
      const minItems = schema.minItems || 1
      const maxItems = schema.maxItems || 5
      const items = []
      const count = faker.number.int({ min: minItems, max: maxItems })
      for (let i = 0; i < count; i++) {
        items.push(generateMockData(schema.items))
      }
      return items

    case "object":
      const obj: any = {}
      const required = schema.required || []
      const properties = schema.properties || {}
      
      // Include required properties
      for (const key of required) {
        if (properties[key]) {
          obj[key] = generateMockData(properties[key])
        }
      }
      
      // Include some optional properties
      const optionalKeys = Object.keys(properties).filter(k => !required.includes(k))
      const numOptional = Math.min(
        optionalKeys.length,
        faker.number.int({ min: 0, max: optionalKeys.length })
      )
      const selectedOptional = faker.helpers.arrayElements(optionalKeys, numOptional)
      for (const key of selectedOptional) {
        obj[key] = generateMockData(properties[key])
      }
      
      return obj

    case "null":
      return null

    default:
      // If no type specified or it's a union, try to generate something reasonable
      if (schema.oneOf && schema.oneOf.length > 0) {
        return generateMockData(faker.helpers.arrayElement(schema.oneOf))
      }
      if (schema.anyOf && schema.anyOf.length > 0) {
        return generateMockData(faker.helpers.arrayElement(schema.anyOf))
      }
      return faker.lorem.word()
  }
}

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
  .action(async (options: any) => {
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
  .action((options: any) => {
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
  .action((options: any) => {
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
    console.log("🔍 Validating contract...")
    const configPath = path.resolve(process.cwd(), options.config)
    
    if (!fs.existsSync(configPath)) {
      console.error(`❌ Config file not found at ${configPath}`)
      process.exit(1)
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    const contractFilePath = path.resolve(process.cwd(), config.contractFile)
    
    try {
      const load = jiti(import.meta.url, { interopDefault: true })
      const contract = load(contractFilePath)
      
      if (!contract) {
        throw new Error("Contract not found - make sure your contract file exports the contract object")
      }

      const issues: { type: "error" | "warning"; message: string; path?: string }[] = []
      
      // Validate contract structure
      if (typeof contract !== "object") {
        issues.push({ type: "error", message: "Contract must be an object" })
      }
      
      if (!contract._namespaces) {
        issues.push({ type: "error", message: "Contract is missing _namespaces property" })
      } else if (!(contract._namespaces instanceof Map)) {
        issues.push({ type: "error", message: "_namespaces must be a Map object" })
      }
      
      if (typeof contract.generateSpec !== "function") {
        issues.push({ type: "error", message: "Contract is missing generateSpec method" })
      }
      
      if (!contract.options) {
        issues.push({ type: "warning", message: "Contract is missing options property" })
      } else {
        if (!contract.options.name) {
          issues.push({ type: "warning", message: "Contract options.name is missing", path: "options.name" })
        }
        if (!contract.options.version) {
          issues.push({ type: "warning", message: "Contract options.version is missing", path: "options.version" })
        }
      }
      
      // Validate namespaces
      if (contract._namespaces) {
        if (contract._namespaces.size === 0) {
          issues.push({ type: "warning", message: "Contract has no namespaces defined" })
        }
        
        for (const [nsName, ns] of contract._namespaces) {
          if (!ns.events || typeof ns !== "object") {
            issues.push({ type: "error", message: `Namespace ${nsName} is invalid`, path: `namespaces.${nsName}` })
            continue
          }
          
          if (!ns.events || !(ns.events instanceof Map)) {
            issues.push({ type: "error", message: `Namespace ${nsName}.events must be a Map`, path: `namespaces.${nsName}.events` })
            continue
          }
          
          if (ns.events.size === 0) {
            issues.push({ type: "warning", message: `Namespace ${nsName} has no events defined`, path: `namespaces.${nsName}` })
          }
          
          // Validate events
          for (const [evtName, evt] of ns.events) {
            const evtPath = `namespaces.${nsName}.events.${evtName}`
            
            if (!evt.name || typeof evt !== "object") {
              issues.push({ type: "error", message: `Event ${evtName} is invalid`, path: evtPath })
              continue
            }
            
            if (!evt.direction) {
              issues.push({ type: "error", message: `Event ${evtName} is missing direction`, path: `${evtPath}.direction` })
            } else if (!["client_to_server", "server_to_client", "bidirectional"].includes(evt.direction)) {
              issues.push({ type: "error", message: `Event ${evtName} has invalid direction: ${evt.direction}`, path: `${evtPath}.direction` })
            }
            
            if (evt.type && !["fire_and_forget", "request_response"].includes(evt.type)) {
              issues.push({ type: "warning", message: `Event ${evtName} has invalid type: ${evt.type}`, path: `${evtPath}.type` })
            }
            
            // Validate that request_response events have response schemas
            if (evt.type === "request_response" && !evt.response && !evt.responseSchema) {
              issues.push({ type: "warning", message: `Request-response event ${evtName} should have a response schema`, path: evtPath })
            }
            
            // Validate errors
            if (evt.errors) {
              if (!Array.isArray(evt.errors)) {
                issues.push({ type: "error", message: `Event ${evtName}.errors must be an array`, path: `${evtPath}.errors` })
              } else {
                for (let i = 0; i < evt.errors.length; i++) {
                  const err = evt.errors[i]
                  if (!err.code) {
                    issues.push({ type: "error", message: `Error ${i} for event ${evtName} is missing code`, path: `${evtPath}.errors[${i}].code` })
                  }
                  if (!err.description) {
                    issues.push({ type: "warning", message: `Error ${i} for event ${evtName} is missing description`, path: `${evtPath}.errors[${i}].description` })
                  }
                }
              }
            }
          }
        }
      }
      
      // Try to generate spec to ensure it works
      try {
        const spec = contract.generateSpec()
        if (!spec) {
          issues.push({ type: "error", message: "generateSpec returned null or undefined" })
        } else {
          console.log("✅ generateSpec works correctly")
        }
        // Also run the linter on the generated spec
        const lintIssues = lintSpec(spec)
        for (const issue of lintIssues) {
          issues.push(issue)
        }
      } catch (err) {
        issues.push({ type: "error", message: `generateSpec failed: ${(err as Error).message}` })
      }
      
      // Report results
      if (issues.length === 0) {
        console.log("\n✅ Contract is valid!")
        return
      }
      
      console.log(`\nFound ${issues.length} issue(s):`)
      let hasErrors = false
      
      for (const issue of issues) {
        const icon = issue.type === "error" ? "❌" : "⚠️"
        console.log(`  ${icon} ${issue.message}${issue.path ? ` (${issue.path})` : ""}`)
        if (issue.type === "error") hasErrors = true
      }
      
      if (hasErrors) {
        process.exit(1)
      }
      
    } catch (err) {
      console.error("\n❌ Contract validation failed:", (err as Error).message)
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
    const port = parseInt(options.port)
    console.log(`Starting mock server for ${spec.info.name} on port ${port}...`)

    const httpServer = http.createServer()
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })

    // Set up namespaces
    for (const [nsName, ns] of Object.entries(spec.namespaces)) {
      const namespace = nsName === "default" ? io : io.of(`/${nsName}`)
      
      console.log(`  Setting up namespace: /${nsName === "default" ? "" : nsName}`)
      
      namespace.on("connection", (socket) => {
        console.log(`  [${nsName}] Client connected: ${socket.id}`)

        // Listen to client-to-server and bidirectional events
        for (const [evtName, evt] of Object.entries((ns as any).events)) {
          const eventDef = evt as any
          if (eventDef.direction === "client_to_server" || eventDef.direction === "bidirectional") {
            console.log(`    Listening for event: ${evtName}`)
            
            socket.on(evtName, (payload, ack) => {
              console.log(`  [${nsName}] Received event: ${evtName}`, payload)

              // Validate payload if schema exists
              let isValid = true
              if (eventDef.payloadSchema) {
                const validate = ajv.compile(eventDef.payloadSchema)
                isValid = validate(payload)
                if (!isValid) {
                  console.error(`  [${nsName}] Invalid payload:`, validate.errors)
                  if (ack) {
                    ack({ status: "error", message: "Invalid payload", errors: validate.errors })
                  }
                  return
                }
              }

              // Generate mock response if it's request-response
              if (eventDef.type === "request_response" && eventDef.responseSchema) {
                const mockResponse = generateMockData(eventDef.responseSchema)
                console.log(`  [${nsName}] Sending mock response:`, mockResponse)
                if (ack) {
                  ack(mockResponse)
                }
              }

              // Emit a corresponding server-to-client event if it exists
              if (eventDef.direction === "bidirectional") {
                const mockServerPayload = eventDef.payloadSchema 
                  ? generateMockData(eventDef.payloadSchema) 
                  : {}
                console.log(`  [${nsName}] Emitting mock bidirectional response:`, mockServerPayload)
                socket.emit(evtName, mockServerPayload)
              }

              // Emit random server-to-client events periodically
              const serverEvents = Object.entries((ns as any).events).filter(
                ([_, e]: [string, any]) => e.direction === "server_to_client"
              )
              if (serverEvents.length > 0) {
                const randomDelay = faker.number.int({ min: 1000, max: 5000 })
                setTimeout(() => {
                  const [randomEventName, randomEvent] = faker.helpers.arrayElement(serverEvents)
                  const mockEventData = (randomEvent as any).payloadSchema 
                    ? generateMockData((randomEvent as any).payloadSchema) 
                    : {}
                  console.log(`  [${nsName}] Emitting mock server event: ${randomEventName}`, mockEventData)
                  socket.emit(randomEventName, mockEventData)
                }, randomDelay)
              }
            })
          }
        }

        socket.on("disconnect", () => {
          console.log(`  [${nsName}] Client disconnected: ${socket.id}`)
        })
      })
    }

    httpServer.listen(port, () => {
      console.log(`\n✅ Mock server is running at http://localhost:${port}`)
      console.log(`   Connect with Socket.IO client to start testing!`)
    })
  })

program
  .command("lint")
  .description("Lint the contract for common mistakes and missing documentation")
  .option("-c, --config <path>", "Path to config file", "./socketdocs.config.json")
  .action(async (options: any) => {
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
      issues.forEach((issue: LintIssue) => {
        const icon = issue.type === 'error' ? '❌' : '⚠️'
        console.log(`${icon} [${issue.path}] ${issue.message}`)
      })

      if (issues.some((i: LintIssue) => i.type === 'error')) {
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
