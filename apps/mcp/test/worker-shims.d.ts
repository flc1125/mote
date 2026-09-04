/**
 * Minimal Worker type shims for compiling apps/api and apps/viewer sources
 * inside the CLI's Node test program (the E2E test invokes both workers
 * directly against a Miniflare R2 bucket). Only the surface our workers
 * actually use is declared.
 */
declare type R2Bucket = {
  get(key: string): Promise<{
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    body: ReadableStream;
    httpMetadata?: { contentType?: string | undefined } | undefined;
  } | null>;
  head(key: string): Promise<{ key: string } | null>;
  put(key: string, value: unknown, options?: unknown): Promise<unknown>;
};

declare type ExportedHandler<Env = unknown> = {
  fetch: (request: Request, env: Env) => Promise<Response> | Response;
};
