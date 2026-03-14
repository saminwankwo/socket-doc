import {createServer} from "http"
import {Server} from "socket.io"
import {createContract} from "@socketdocs/core"
import {z} from "zod"

const httpServer = createServer()
const io = new Server(httpServer)

const contract = createContract({
 name:"realtime-api",
 version:"1.0.0"
})

const chat = contract.namespace("chat")

chat.event({
 name:"send_message",
 direction:"client_to_server",
 payload:z.object({
  message:z.string(),
  userId:z.string()
 })
})

io.on("connection",(socket)=>{

 socket.on("send_message",(payload)=>{

  console.log("message received",payload)

 })

})

httpServer.listen(3000)
