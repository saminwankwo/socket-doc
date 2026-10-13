/**
 * Generates sample data from a JSON Schema object.
 * Handles object, array, string, number, integer, boolean, enum, default, and format basics.
 */
export function sampleFromSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  // 1. Default value takes precedence
  if (schema.default !== undefined) {
    return schema.default;
  }

  // 2. Examples
  if (Array.isArray(schema.examples) && schema.examples.length > 0) {
    return schema.examples[0];
  }

  // 3. Enum
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // 4. AnyOf / AllOf / OneOf
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return sampleFromSchema(schema.anyOf[0]);
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return sampleFromSchema(schema.oneOf[0]);
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged: Record<string, any> = {};
    for (const sub of schema.allOf) {
      Object.assign(merged, sampleFromSchema(sub));
    }
    return merged;
  }

  const type = schema.type;

  if (type === 'string') {
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'date') return '2026-10-13';
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'uri' || schema.format === 'url')
      return 'https://example.com';
    if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
    return 'string';
  }

  if (type === 'number') {
    return 0.0;
  }

  if (type === 'integer') {
    return 0;
  }

  if (type === 'boolean') {
    return true;
  }

  if (type === 'null') {
    return null;
  }

  if (type === 'array') {
    if (schema.items) {
      return [sampleFromSchema(schema.items)];
    }
    return [];
  }

  if (type === 'object' || schema.properties) {
    const result: Record<string, any> = {};
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        result[key] = sampleFromSchema(propSchema);
      }
    }
    return result;
  }

  return {};
}
