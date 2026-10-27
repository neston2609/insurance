import assert from "node:assert/strict";
import test from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { once } from "node:events";
import path from "node:path";
import os from "node:os";

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
async function launch() {
  const folder = await mkdtemp(path.join(os.tmpdir(), "independent-app-"));
  const port = await freePort();
  let output = "";
  const child: ChildProcess = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(port),
        DATA_DIR: path.join(folder, "data"),
        BACKUPS_DIR: path.join(folder, "backups"),
        EXPORTS_DIR: path.join(folder, "exports"),
        APP_SECRET: "isolated-test-app-secret",
        SESSION_SECRET: "isolated-test-session-secret",
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "TestPassword123!",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (chunk) => (output += String(chunk)));
  child.stderr?.on("data", (chunk) => (output += String(chunk)));
  const origin = "http://127.0.0.1:" + port;
  const request = (
    url: string,
    method = "GET",
    body?: unknown,
    cookie?: string,
    extraHeaders: Record<string, string> = {},
  ) =>
    fetch(origin + url, {
      method,
      headers: {
        "X-Forwarded-Proto": "https",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  const stop = async () => {
    if (child.exitCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
    await rm(folder, { recursive: true, force: true });
  };
  try {
    let ready = false;
    for (let index = 0; index < 100; index++) {
      if (child.exitCode !== null) break;
      try {
        ready = (await request("/api/health")).ok;
        if (ready) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Application did not start: " + output);
    return { folder, request, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

test(
  "demo runs alone, stores inquiries locally, and exposes no management APIs",
  { timeout: 30000 },
  async () => {
    const { folder, request, stop } = await launch();
    try {
      assert.equal(
        (await (await request("/api/health")).json()).service,
        "insurance-demo",
      );
      const products = await (await request("/api/public/products")).json();
      assert.ok(products.items.length >= 8);
      assert.equal(
        (await request("/api/public/products/" + products.items[0].slug))
          .status,
        200,
      );
      const inquiry = {
        firstName: "Demo",
        lastName: "Customer",
        phone: "0812345678",
        productId: products.items[0].productId,
        preferredChannel: "VOICE",
        preferredContactTime: "10:00",
        consent: true,
      };
      const invalid = await request("/api/public/inquiries", "POST", {
        ...inquiry,
        consent: false,
      });
      assert.equal(invalid.status, 400);
      assert.equal(
        (await request("/api/public/inquiries", "POST", inquiry)).status,
        201,
      );
      const saved = JSON.parse(
        await readFile(path.join(folder, "data/inquiries.json"), "utf8"),
      );
      assert.ok(
        saved.some((row: { firstName: string }) => row.firstName === "Demo"),
      );
      for (const url of [
        "/api/admin/customers",
        "/api/admin/genesys/config",
        "/manage",
        "/genesys",
      ])
        assert.equal((await request(url)).status, 404, url);
      assert.equal(
        (
          await request("/api/public/policies/renew", "POST", {
            policyNumber: "fake",
          })
        ).status,
        404,
      );
      for (const url of ["/", "/products", "/recommend", "/contact"]) {
        const page = await request(url);
        assert.equal(page.status, 200, url);
        assert.match(await page.text(), /<div id="root">/);
      }
    } finally {
      await stop();
    }
  },
);
