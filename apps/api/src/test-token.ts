// Shared test-only publish token, injected as a miniflare binding in
// vitest.config.ts and used by the integration tests. Kept in a standalone
// module so importing it never pulls Node-only config code into workerd.
export const TEST_PUBLISH_TOKEN = 'test-only-publish-token-not-a-secret';
