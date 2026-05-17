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
    fetch,
  });

  return cjsModule.exports;
}

const { prepareMediaFileForNode } = loadTypeScriptModule(
  "./media-upload-client.ts",
  {
    "@/lib/supabase/client": {
      createClient: () => {
        throw new Error("Supabase client should be injected in tests");
      },
    },
  }
);

function createFile(overrides = {}) {
  return {
    name: "treino.mp4",
    type: "video/mp4",
    size: 7 * 1024 * 1024,
    ...overrides,
  };
}

test("uploads video through signed storage instead of serializing it as a data URL", async () => {
  const calls = [];
  const file = createFile();

  const result = await prepareMediaFileForNode({
    type: "video",
    file,
    readDataUrl: async () => {
      throw new Error("video uploads must not read the file as a data URL");
    },
    requestSignedUpload: async (request) => {
      calls.push(["request", request]);
      return {
        bucket: "images",
        path: "org-1/flow-media/video/file.mp4",
        token: "upload-token",
        publicUrl: "https://cdn.example.com/file.mp4",
      };
    },
    uploadToSignedUrl: async (upload) => {
      calls.push(["upload", upload]);
    },
  });

  assert.equal(result.url, "https://cdn.example.com/file.mp4");
  assert.equal(result.fileName, "treino.mp4");
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "request");
  assert.equal(calls[0][1].type, "video");
  assert.equal(calls[0][1].fileName, "treino.mp4");
  assert.equal(calls[0][1].contentType, "video/mp4");
  assert.equal(calls[0][1].sizeBytes, 7 * 1024 * 1024);
  assert.equal(calls[1][1].bucket, "images");
  assert.equal(calls[1][1].path, "org-1/flow-media/video/file.mp4");
  assert.equal(calls[1][1].token, "upload-token");
  assert.equal(calls[1][1].file, file);
  assert.equal(calls[1][1].contentType, "video/mp4");
});

test("keeps non-video uploads as inline data URLs", async () => {
  const file = createFile({
    name: "foto.png",
    type: "image/png",
    size: 128,
  });

  const result = await prepareMediaFileForNode({
    type: "image",
    file,
    readDataUrl: async () => "data:image/png;base64,abc",
    requestSignedUpload: async () => {
      throw new Error("image uploads should keep the existing data URL path");
    },
    uploadToSignedUrl: async () => {
      throw new Error("image uploads should keep the existing data URL path");
    },
  });

  assert.equal(result.url, "data:image/png;base64,abc");
  assert.equal(result.fileName, "foto.png");
});
