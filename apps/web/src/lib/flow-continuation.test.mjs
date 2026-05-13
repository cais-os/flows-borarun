import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTypeScriptModule(relativePath, requireOverrides = {}) {
  const filename = path.join(import.meta.dirname, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const cjsModule = { exports: {} };
  const customRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(requireOverrides, specifier)) {
      return requireOverrides[specifier];
    }
    return require(specifier);
  };

  vm.runInNewContext(output, {
    exports: cjsModule.exports,
    module: cjsModule,
    require: customRequire,
    console,
    AbortSignal,
    JSON,
    setTimeout,
  });
  return cjsModule.exports;
}

const { triggerFlowContinuation } = loadTypeScriptModule(
  "./flow-continuation.ts",
  {
    "@/lib/internal-auth": { getCronSecret: () => "secret" },
    "@/lib/strava": { resolveAppOrigin: () => "https://web.example.com" },
  }
);

test("waits until the continuation endpoint accepts the queued flow", async () => {
  let fetchResolved = false;
  let requestedUrl = "";
  let requestInit;

  const resultPromise = triggerFlowContinuation(
    {
      conversationId: "conv-1",
      contactPhone: "555181447811",
      organizationId: "org-1",
    },
    {
      fetchImpl: async (url, init) => {
        requestedUrl = url;
        requestInit = init;
        await new Promise((resolve) => setTimeout(resolve, 15));
        fetchResolved = true;
        return { ok: true, status: 200, text: async () => "" };
      },
      getSecret: () => "secret",
      resolveOrigin: () => "https://web.example.com",
    }
  );

  assert.equal(fetchResolved, false);
  assert.equal(await resultPromise, true);
  assert.equal(fetchResolved, true);
  assert.equal(requestedUrl, "https://web.example.com/api/flow/continue");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.headers["x-internal-secret"], "secret");
  assert.deepEqual(JSON.parse(requestInit.body), {
    conversationId: "conv-1",
    contactPhone: "555181447811",
    organizationId: "org-1",
  });
});

test("does not call the continuation endpoint without CRON_SECRET", async () => {
  let fetchCalled = false;
  const originalConsoleError = console.error;
  console.error = () => {};

  let result;
  try {
    result = await triggerFlowContinuation(
      {
        conversationId: "conv-1",
        contactPhone: "555181447811",
        organizationId: "org-1",
      },
      {
        fetchImpl: async () => {
          fetchCalled = true;
          return { ok: true, status: 200, text: async () => "" };
        },
        getSecret: () => null,
        resolveOrigin: () => "https://web.example.com",
      }
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(result, false);
  assert.equal(fetchCalled, false);
});
