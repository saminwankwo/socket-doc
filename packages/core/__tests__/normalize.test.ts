import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { normalizeSchema } from '../src/normalize.js';

describe('normalizeSchema', () => {
  it('converts a Zod object to JSON Schema', () => {
    const schema = z.object({ text: z.string(), roomId: z.string() });
    const result = normalizeSchema(schema);
    expect(result).toBeDefined();
    expect(result!.type).toBe('object');
    expect(result!.properties).toBeDefined();
    expect((result!.properties as any).text).toBeDefined();
  });

  it('converts nested Zod', () => {
    const schema = z.object({
      user: z.object({ name: z.string(), age: z.number() }),
    });
    const result = normalizeSchema(schema);
    expect((result!.properties as any).user.type).toBe('object');
    expect((result!.properties as any).user.properties.name).toBeDefined();
  });

  it('passes through raw JSON Schema', () => {
    const raw = { type: 'string', maxLength: 10 };
    const result = normalizeSchema(raw);
    expect(result).toBe(raw);
  });

  it('returns undefined for undefined input', () => {
    expect(normalizeSchema(undefined)).toBeUndefined();
    expect(normalizeSchema(null as any)).toBeUndefined();
  });
});
