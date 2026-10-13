/**
 * Builds the Socket.IO handshake `auth` payload and query parameters from the
 * Authorize modal's configuration. Pure so it can be unit-tested: this is
 * exactly what the playground sends when it connects.
 */
export interface AuthConfig {
  type: 'none' | 'bearer' | 'apiKey' | 'custom';
  token?: string;
  apiKey?: string;
  customAuthJson?: string;
  queryParamKey?: string;
  queryParamValue?: string;
}

export interface Handshake {
  authPayload: Record<string, any>;
  queryParams: Record<string, string>;
}

export function buildHandshake(auth: AuthConfig): Handshake {
  const authPayload: Record<string, any> = {};
  const queryParams: Record<string, string> = {};

  if (auth.type === 'bearer' && auth.token) {
    // Raw value: browsers cannot set an Authorization header on the WebSocket
    // handshake, so the token travels as `auth: { token }` (see the docs'
    // Auth section). Servers typically strip/verify it themselves.
    authPayload.token = auth.token;
  } else if (auth.type === 'apiKey' && auth.apiKey) {
    authPayload.apiKey = auth.apiKey;
  } else if (auth.type === 'custom' && auth.customAuthJson) {
    try {
      const parsed = JSON.parse(auth.customAuthJson);
      Object.assign(authPayload, parsed);
    } catch {
      // ignore JSON syntax errors in payload
    }
  }

  if (auth.queryParamKey && auth.queryParamValue) {
    queryParams[auth.queryParamKey] = auth.queryParamValue;
  }

  return { authPayload, queryParams };
}
