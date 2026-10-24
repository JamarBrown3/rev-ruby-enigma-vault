import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../app.js";

async function withServer(checkDatabase, run) {
  const server = createApp({ checkDatabase, clientOrigin: "http://localhost:5173" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("liveness returns JSON and does not expose Express", async () => {
  await withServer(async () => true, async (base) => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.deepEqual(await response.json(), { status: "ok", service: "rev-api" });
  });
});

test("readiness checks a successful database dependency", async () => {
  let calls = 0;
  await withServer(async () => { calls += 1; }, async (base) => {
    const response = await fetch(`${base}/api/health/database`);
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.deepEqual(await response.json(), { status: "ok", database: "connected" });
  });
});

test("database outage returns 503 without leaking diagnostic secrets", async () => {
  await withServer(async () => { throw new Error("private-diagnostic-marker"); }, async (base) => {
    const response = await fetch(`${base}/api/health/database`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "error", database: "unavailable" });
  });
});

test("unknown routes return a JSON 404", async () => {
  await withServer(async () => true, async (base) => {
    const response = await fetch(`${base}/api/not-a-route`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Route not found." });
  });
});

test("malformed JSON returns 400 instead of an HTML error page", async () => {
  await withServer(async () => true, async (base) => {
    const response = await fetch(`${base}/api/health`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{broken",
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid JSON request body." });
  });
});

test("configured frontend receives credentialed CORS headers", async () => {
  await withServer(async () => true, async (base) => {
    const response = await fetch(`${base}/api/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  });
});

test("unrecognized origin receives no CORS permission", async () => {
  await withServer(async () => true, async (base) => {
    const response = await fetch(`${base}/api/health`, {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(response.headers.get("access-control-allow-credentials"), null);
  });
});

test("frontend JSON request preflight succeeds", async () => {
  await withServer(async () => true, async (base) => {
    const response = await fetch(`${base}/api/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.match(response.headers.get("access-control-allow-headers"), /content-type/i);
  });
});
