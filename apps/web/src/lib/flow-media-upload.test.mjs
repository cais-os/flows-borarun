import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTypeScriptModule(relativePath) {
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

  vm.runInNewContext(output, {
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  });

  return cjsModule.exports;
}

const {
  FLOW_MEDIA_UPLOAD_BUCKET,
  buildFlowMediaUploadPath,
  ensureFlowMediaUploadBucket,
  getFlowMediaUploadValidationError,
} = loadTypeScriptModule("./flow-media-upload.ts");

test("stores uploaded videos in the public media bucket", () => {
  assert.equal(FLOW_MEDIA_UPLOAD_BUCKET, "images");
});

test("builds a safe storage path for video uploads", () => {
  assert.equal(
    buildFlowMediaUploadPath({
      organizationId: "org_123",
      mediaType: "video",
      fileName: "../Meu Treino Final!!.MP4",
      contentType: "video/mp4",
      uniqueId: "upload-1",
    }),
    "org_123/flow-media/video/upload-1-meu-treino-final.mp4"
  );
});

test("validates video upload metadata before creating a signed URL", () => {
  assert.equal(
    getFlowMediaUploadValidationError({
      mediaType: "video",
      fileName: "treino.mp4",
      contentType: "video/mp4",
      sizeBytes: 1024,
    }),
    null
  );

  assert.match(
    getFlowMediaUploadValidationError({
      mediaType: "video",
      fileName: "treino.txt",
      contentType: "text/plain",
      sizeBytes: 1024,
    }) || "",
    /video/i
  );
});

test("creates the public media bucket when it is missing", async () => {
  const calls = [];

  await ensureFlowMediaUploadBucket({
    async getBucket(bucket) {
      calls.push({ method: "getBucket", bucket });
      return {
        data: null,
        error: {
          message: "The related resource does not exist",
          statusCode: "404",
        },
      };
    },
    async createBucket(bucket, options) {
      calls.push({ method: "createBucket", bucket, options });
      return { data: { name: bucket }, error: null };
    },
  });

  assert.equal(
    JSON.stringify(calls),
    JSON.stringify([
      { method: "getBucket", bucket: "images" },
      { method: "createBucket", bucket: "images", options: { public: true } },
    ])
  );
});

test("does not recreate the media bucket when it already exists", async () => {
  const calls = [];

  await ensureFlowMediaUploadBucket({
    async getBucket(bucket) {
      calls.push({ method: "getBucket", bucket });
      return { data: { id: bucket }, error: null };
    },
    async createBucket(bucket, options) {
      calls.push({ method: "createBucket", bucket, options });
      return { data: { name: bucket }, error: null };
    },
  });

  assert.deepEqual(calls, [{ method: "getBucket", bucket: "images" }]);
});
