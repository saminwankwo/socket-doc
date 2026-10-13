import type { ZodTypeAny } from "zod";

export type JSONSchema = Record<string, unknown>;

export function normalizeSchema(
  input: ZodTypeAny | JSONSchema | undefined
): JSONSchema | undefined {
  if (input === undefined || input === null) return undefined;

  if (typeof input === "object" && typeof (input as any).toJSONSchema === "function") {
    return (input as any).toJSONSchema() as JSONSchema;
  }

  if (typeof input === "object" && !Array.isArray(input)) {
    return input as JSONSchema;
  }

  return undefined;
}
