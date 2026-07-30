// Ambient module declarations for `.md` skill imports. These ship with
// @flue/runtime but are not auto-included, so reference them explicitly.
/// <reference path="../node_modules/@flue/runtime/types/skill-md.d.ts" />
/// <reference path="../node_modules/@flue/runtime/types/markdown-md.d.ts" />

// Worker bindings from wrangler.jsonc. Mirrors what `wrangler types` would
// generate for the `ai` binding, so `env.AI` typechecks without a build step.
declare namespace Cloudflare {
  interface Env {
    AI: Ai;
  }
}
