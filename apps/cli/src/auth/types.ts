export type OAuthServer = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  authorization_response_iss_parameter_supported?: boolean;
};

export interface Identity {
  kind: 'user' | 'service' | 'token';
  subject?: string;
  email?: string;
}
export interface OAuthCredential {
  version: 1;
  apiUrl: string;
  resource: string;
  issuer: string;
  server: OAuthServer;
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  identity: Identity;
  /** Set before refresh I/O. An interrupted exchange requires re-login. */
  refreshPending?: boolean;
}
export interface AuthHeaders {
  headers: Record<string, string>;
  mode: 'token' | 'oauth' | 'service';
}
