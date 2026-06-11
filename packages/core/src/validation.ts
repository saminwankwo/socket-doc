import AjvModule from "ajv"
import { ZodTypeAny } from "zod"

const Ajv = (AjvModule as any).default || AjvModule
const ajv = new Ajv()

export interface Validator {
  validate: (data: any) => { success: boolean; data?: any; error?: any }
}

export function createValidator(eventDef: any, type: 'payload' | 'response' = 'payload'): Validator {
  const schema = type === 'payload' ? eventDef.payload : eventDef.response;
  const rawSchema = type === 'payload' ? eventDef.payloadSchema : eventDef.responseSchema;

  if (schema) {
    return {
      validate: (data: any) => {
        const result = (schema as ZodTypeAny).safeParse(data)
        if (result.success) {
          return { success: true, data: result.data }
        }
        return { success: false, error: result.error.issues }
      }
    }
  }

  if (rawSchema) {
    const validate = ajv.compile(rawSchema)
    return {
      validate: (data: any) => {
        const valid = validate(data)
        if (valid) {
          return { success: true, data }
        }
        return { success: false, error: validate.errors }
      }
    }
  }

  return {
    validate: (data: any) => ({ success: true, data })
  }
}
