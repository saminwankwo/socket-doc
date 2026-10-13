import { describe, it, expect } from 'vitest';
import { buildHandshake } from '../src/utils/handshake';

describe('buildHandshake', () => {
  it('sends the raw token for bearer auth (no "Bearer " prefix)', () => {
    const { authPayload } = buildHandshake({
      type: 'bearer',
      token: 'demo-token',
    });
    expect(authPayload).toEqual({ token: 'demo-token' });
  });

  it('sends the key for api-key auth', () => {
    const { authPayload } = buildHandshake({ type: 'apiKey', apiKey: 'k-123' });
    expect(authPayload).toEqual({ apiKey: 'k-123' });
  });

  it('merges custom JSON into the auth payload', () => {
    const { authPayload } = buildHandshake({
      type: 'custom',
      customAuthJson: '{"token":"t","role":"admin"}',
    });
    expect(authPayload).toEqual({ token: 't', role: 'admin' });
  });

  it('ignores invalid custom JSON instead of throwing', () => {
    const { authPayload } = buildHandshake({
      type: 'custom',
      customAuthJson: '{ nope',
    });
    expect(authPayload).toEqual({});
  });

  it('sends an empty payload for type none or missing values', () => {
    expect(buildHandshake({ type: 'none' }).authPayload).toEqual({});
    expect(buildHandshake({ type: 'bearer' }).authPayload).toEqual({});
  });

  it('adds query params only when both key and value are set', () => {
    expect(
      buildHandshake({
        type: 'none',
        queryParamKey: 'token',
        queryParamValue: 'abc',
      }).queryParams,
    ).toEqual({ token: 'abc' });
    expect(
      buildHandshake({ type: 'none', queryParamKey: 'token' }).queryParams,
    ).toEqual({});
  });
});
