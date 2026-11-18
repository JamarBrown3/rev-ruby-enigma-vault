// In production Express serves the built React app (client/dist) as well as
// the API. These tests use a tiny fake build in a temporary folder.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../app.js";

async function withSite(run) {
  const clientDir = await mkdtemp(path.join(tmpdir(), "rev-client-"));
  await mkdir(path.join(clientDir, "assets"));
  await writeFile(path.join(clientDir, "index.html"), "<!doctype html><title>REV page</title>");
  await writeFile(path.join(clientDir, "assets", "app-abc123.js"), "console.log('rev');");
  await writeFile(path.join(clientDir, "favicon.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");

  const server = createApp({ checkDatabase: async () => true, clientOrigin: "https://example.com", clientDir })
    .listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(clientDir, { recursive: true, force: true });
  }
}

test("page addresses get index.html so React Router can show the page", async () => {
  await withSite(async (base) => {
    for (const page of ["/", "/about", "/games/123", "/dashboard?range=7"]) {
      const response = await fetch(`${base}${page}`);
      assert.equal(response.status, 200, page);
      assert.match(response.headers.get("content-type"), /text\/html/);
      assert.equal(response.headers.get("cache-control"), "no-cache");
      assert.match(await response.text(), /REV page/);
    }
  });
});

test("built files are served, and hashed /assets files are cached for a year", async () => {
  await withSite(async (base) => {
    const asset = await fetch(`${base}/assets/app-abc123.js`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");

    const icon = await fetch(`${base}/favicon.svg`);
    assert.equal(icon.status, 200);
    assert.notEqual(icon.headers.get("cache-control"), "public, max-age=31536000, immutable");
  });
});

test("unknown /api addresses still get the JSON 404, never the web page", async () => {
  await withSite(async (base) => {
    for (const address of ["/api", "/api/nope", "/api/posts/x/y/z"]) {
      const response = await fetch(`${base}${address}`);
      assert.equal(response.status, 404, address);
      assert.deepEqual(await response.json(), { error: "Route not found." });
    }
    const health = await fetch(`${base}/api/health`);
    assert.deepEqual(await health.json(), { status: "ok", service: "rev-api" });
  });
});

test("only GET gets the page: a POST to a page address is a 404", async () => {
  await withSite(async (base) => {
    const response = await fetch(`${base}/about`, { method: "POST" });
    assert.equal(response.status, 404);
  });
});

test("files outside the build folder can't be reached", async () => {
  await withSite(async (base) => {
    // %2e%2e is "..": the browser can't normalize it away, so it reaches Express.
    const response = await fetch(`${base}/%2e%2e/%2e%2e/package.json`);
    assert.doesNotMatch(await response.text(), /rev-server/);
  });
});

test("the security policy allows https images but keeps scripts on this site", async () => {
  await withSite(async (base) => {
    const policy = (await fetch(`${base}/`)).headers.get("content-security-policy");
    assert.match(policy, /img-src 'self' data: https:/);
    assert.match(policy, /script-src 'self'(;|$)/);
    assert.match(policy, /object-src 'none'/);
  });
});

test("without a build folder the API keeps its JSON home route", async () => {
  const server = createApp({ checkDatabase: async () => true, clientOrigin: "https://example.com" })
    .listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/about`);
    assert.equal(response.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
