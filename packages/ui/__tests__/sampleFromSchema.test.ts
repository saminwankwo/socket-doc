import { describe, it, expect } from 'vitest';
import { sampleFromSchema } from '../src/utils/sampleFromSchema';

describe('sampleFromSchema', () => {
  it('handles primitive types: string, number, integer, boolean, null', () => {
    expect(sampleFromSchema({ type: 'string' })).toBe('string');
    expect(sampleFromSchema({ type: 'number' })).toBe(0.0);
    expect(sampleFromSchema({ type: 'integer' })).toBe(0);
    expect(sampleFromSchema({ type: 'boolean' })).toBe(true);
    expect(sampleFromSchema({ type: 'null' })).toBeNull();
  });

  it('respects default values and examples', () => {
    expect(sampleFromSchema({ type: 'string', default: 'custom' })).toBe('custom');
    expect(sampleFromSchema({ type: 'string', examples: ['sample_val'] })).toBe('sample_val');
    expect(sampleFromSchema({ enum: ['alpha', 'beta'] })).toBe('alpha');
  });

  it('handles string formats: date-time, email, uuid', () => {
    expect(sampleFromSchema({ type: 'string', format: 'email' })).toBe('user@example.com');
    expect(sampleFromSchema({ type: 'string', format: 'uuid' })).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('handles nested objects and arrays', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        count: { type: 'integer' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
        meta: {
          type: 'object',
          properties: {
            active: { type: 'boolean' },
          },
        },
      },
    };

    const sampled = sampleFromSchema(schema);
    expect(sampled).toEqual({
      id: '123e4567-e89b-12d3-a456-426614174000',
      count: 0,
      tags: ['string'],
      meta: {
        active: true,
      },
    });
  });
});

