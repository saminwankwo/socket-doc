#!/usr/bin/env node
import fs from "fs"

console.log("SocketDocs CLI")

const cmd = process.argv[2]

if(cmd==="init"){
 fs.writeFileSync("socketdocs.config.json",JSON.stringify({
  name:"my-realtime-api",
  version:"1.0.0"
 },null,2))
 console.log("Created socketdocs.config.json")
}

if(cmd==="generate"){
 fs.writeFileSync("wsdoc.json",JSON.stringify({
  message:"spec placeholder"
 },null,2))
 console.log("Generated wsdoc.json")
}
