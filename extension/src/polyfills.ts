import { Buffer } from "buffer/";

// Make Buffer and other Node.js globals available in browser
if (typeof window !== "undefined") {
  // Buffer polyfill
  (window as any).Buffer = Buffer;

  // Global polyfill (required by cross-fetch and Lit SDK)
  (window as any).global = window;

  // Process polyfill (required by many Node.js packages)
  (window as any).process = {
    env: { NODE_ENV: "production" },
    version: "v18.0.0",
    versions: {},
    nextTick: (fn: Function, ...args: any[]) =>
      setTimeout(() => fn(...args), 0),
    browser: true,
    cwd: () => "/",
    platform: "browser",
  };
}

// Also set on globalThis for better compatibility
if (typeof globalThis !== "undefined") {
  (globalThis as any).global = globalThis;
  (globalThis as any).Buffer = Buffer;
  if (!(globalThis as any).process) {
    (globalThis as any).process = {
      env: { NODE_ENV: "production" },
      version: "v18.0.0",
      versions: {},
      nextTick: (fn: Function, ...args: any[]) =>
        setTimeout(() => fn(...args), 0),
      browser: true,
      cwd: () => "/",
      platform: "browser",
    };
  }
}

export {};
