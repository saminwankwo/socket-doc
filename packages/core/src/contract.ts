import { zodToJsonSchema } from "zod-to-json-schema"

export function createContract(options:any){

 const namespaces = new Map()

 function namespace(name:string){

  if(!namespaces.has(name)){
   namespaces.set(name,new Map())
  }

  const events = namespaces.get(name)

  return {
   event(def:any){
    events.set(def.name,def)
   }
  }
 }

 function generateSpec(){

  const spec:any={
   specVersion:"0.1",
   contract:options,
   namespaces:{}
  }

  for(const [ns,events] of namespaces){

   spec.namespaces[ns]={events:{}}

   for(const [name,def] of events){

    spec.namespaces[ns].events[name]={
     direction:def.direction,
     payloadSchema:def.payload?zodToJsonSchema(def.payload):null,
     responseSchema:def.response?zodToJsonSchema(def.response):null
    }

   }

  }

  return spec
 }

 return{
  namespace,
  generateSpec,
  _namespaces:namespaces
 }

}
