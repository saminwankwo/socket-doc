import Ajv from "ajv"
import { ZodTypeAny } from "zod"

const ajv = new Ajv()

export interface Validator {
  validate: (data: any) => { success: boolean; data?: any; error?: any }
}

export function createValidator(eventDef: any): Validator {
  if (eventDef.payload) {
    return {
      validate: (data: any) => {
        const result = (eventDef.payload as ZodTypeAny).safeParse(data)
        if (result.success) {
          return { success: true, data: result.data }
        }
        return { success: false, error: result.error.errors }
      }
    }
  }

  if (eventDef.payloadSchema) {
    const validate = ajv.compile(eventDef.payloadSchema)
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
