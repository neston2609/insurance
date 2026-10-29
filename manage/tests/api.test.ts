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
  "manage runs independently with isolated authentication, records, backups and routes",
  { timeout: 30000 },
  async () => {
    const { folder, request, stop } = await launch();
    try {
      assert.equal(
        (await (await request("/api/health")).json()).service,
        "insurance-manage",
      );
      assert.equal((await request("/")).headers.get("location"), "/manage");
      assert.equal((await request("/genesys")).status, 404);
      assert.equal((await request("/api/admin/customers")).status, 401);
      assert.equal((await request("/api/admin/policies/all")).status, 401);
      assert.equal(
        (
          await request("/api/admin/auth/login", "POST", {
            username: "admin",
            password: "TestPassword123!",
            portal: "genesys",
          })
        ).status,
        400,
      );
      const login = await request("/api/admin/auth/login", "POST", {
        username: "admin",
        password: "TestPassword123!",
        portal: "manage",
      });
      assert.equal(login.status, 200);
      const setCookie = login.headers.get("set-cookie")!;
      assert.match(setCookie, /^manage\.sid=/);
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /Secure/);
      const cookie = setCookie.split(";")[0];
      const policyListResponse = await request(
        "/api/admin/policies/all",
        "GET",
        undefined,
        cookie,
      );
      assert.equal(policyListResponse.status, 200);
      assert.equal(policyListResponse.headers.get("cache-control"), "no-store");
      assert.match(policyListResponse.headers.get("vary") || "", /Cookie/);
      const policyList = await policyListResponse.json();
      const storedPolicies = JSON.parse(
        await readFile(path.join(folder, "data/policies.json"), "utf8"),
      );
      const storedCustomers = JSON.parse(
        await readFile(path.join(folder, "data/customers.json"), "utf8"),
      );
      const storedProducts = JSON.parse(
        await readFile(path.join(folder, "data/products.json"), "utf8"),
      );
      const { CONTACT_COLUMNS, daysUntilExpiry, normalizeThaiPhone } =
        await import("../server/domain/campaign-contact");
      assert.equal(policyList.total, storedPolicies.length);
      assert.equal(policyList.items.length, storedPolicies.length);
      for (const item of policyList.items) {
        assert.deepEqual(Object.keys(item), [...CONTACT_COLUMNS]);
        const policy = storedPolicies.find(
          (row: { policyId: string }) => row.policyId === item.policyId,
        );
        const customer = storedCustomers.find(
          (row: { customerId: string }) => row.customerId === policy.customerId,
        );
        const product = storedProducts.find(
          (row: { productId: string }) => row.productId === policy.productId,
        );
        assert.equal(item.firstName, customer.firstName);
        assert.equal(item.productName, product.productName);
        assert.equal(item.phone, normalizeThaiPhone(customer.phone));
        assert.equal(item.premium, policy.premium);
        assert.equal(item.daysUntilExpiry, daysUntilExpiry(policy.expiryDate));
        assert.equal(typeof item.digitalSent, "boolean");
        assert.equal(typeof item.voiceCalled, "boolean");
        assert.equal(item.dnc, customer.dnc);
        assert.equal(item.callbackDateTime, policy.callbackDateTime || null);
      }
      assert.ok(
        policyList.items.some((row: { dnc: boolean }) => row.dnc),
        "All policies includes DNC customers",
      );
      assert.equal(
        (await request("/api/admin/policies", "GET", undefined, cookie)).status,
        200,
        "Existing paginated API remains available",
      );
      assert.equal(
        (
          await (
            await request(
              "/api/admin/auth/session?portal=manage",
              "GET",
              undefined,
              cookie,
            )
          ).json()
        ).authenticated,
        true,
      );
      assert.equal(
        (
          await request(
            "/api/admin/customers",
            "GET",
            undefined,
            cookie.replace("manage.sid", "genesys.sid"),
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await request(
            "/api/admin/customers/CUST00001",
            "PUT",
            { firstName: "Blocked" },
            cookie,
            { Origin: "https://unrelated.example" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "/api/admin/customers/CUST00001",
            "PUT",
            { firstName: "Standalone" },
            cookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await (
            await request(
              "/api/admin/customers/CUST00001",
              "GET",
              undefined,
              cookie,
            )
          ).json()
        ).firstName,
        "Standalone",
      );
      const saved = JSON.parse(
        await readFile(path.join(folder, "data/customers.json"), "utf8"),
      );
      assert.ok(
        saved.some(
          (row: { firstName: string }) => row.firstName === "Standalone",
        ),
      );
      const campaignResponse = await request(
        "/api/admin/campaigns",
        "POST",
        {
          name: "Independent campaign",
          description: "Local source",
          filters: { excludeDnc: true },
        },
        cookie,
      );
      assert.equal(campaignResponse.status, 201);
      const campaign = await campaignResponse.json();
      const preview = await (
        await request(
          "/api/admin/campaigns/" + campaign.campaignListId + "/preview",
          "POST",
          {},
          cookie,
        )
      ).json();
      assert.ok(preview.summary.eligible > 0);
      const exported = await request(
        "/api/admin/campaigns/" + campaign.campaignListId + "/export",
        "POST",
        {},
        cookie,
      );
      assert.equal(exported.status, 200);
      assert.match(exported.headers.get("content-type") || "", /csv/);
      assert.ok((await exported.text()).includes("customerId"));
      const backupResponse = await request(
        "/api/admin/settings/backup",
        "POST",
        {},
        cookie,
      );
      assert.equal(backupResponse.status, 201);
      const backup = await backupResponse.json();
      const download = await (
        await request(backup.downloadUrl, "GET", undefined, cookie)
      ).json();
      assert.ok(download.files["customers.json"]);
      assert.equal(download.files[".auth/admin.json"], undefined);

      assert.equal(
        (await request("/api/admin/genesys/config", "GET", undefined, cookie))
          .status,
        404,
      );
      assert.equal(
        (await request("/api/admin/genesys/sync/bulk", "POST", {}, cookie))
          .status,
        404,
      );
      const policy = await (
        await request("/api/admin/policies/POL00001", "GET", undefined, cookie)
      ).json();
      const renewal = await request("/api/public/policies/renew", "POST", {
        policyNumber: policy.policyNumber,
      });
      assert.equal(renewal.status, 200);
      const repeated = await (
        await request("/api/public/policies/renew", "POST", {
          policyNumber: policy.policyNumber,
        })
      ).json();
      assert.equal(repeated.alreadyRenewed, true);

      const passwordResponse = await request(
        "/api/admin/auth/change-password",
        "POST",
        {
          currentPassword: "TestPassword123!",
          newPassword: "NewPassword456!",
          confirmPassword: "NewPassword456!",
        },
        cookie,
      );
      assert.equal(passwordResponse.status, 204);
      assert.match(
        passwordResponse.headers.get("set-cookie") || "",
        /^manage\.sid=/,
      );
      assert.equal(
        (await request("/api/admin/customers", "GET", undefined, cookie))
          .status,
        401,
      );
      const pageHtml = await (await request("/manage")).text();
      const assetPath = pageHtml.match(
        /src="(\/manage\/assets\/[^\"]+\.js)"/,
      )?.[1];
      assert.ok(assetPath, "Production scripts must use the /manage/ prefix");
      const asset = await request(assetPath);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("content-type") || "", /javascript/);
      for (const url of [
        "/manage",
        "/manage/customers",
        "/manage/campaigns",
        "/manage/settings",
      ])
        assert.equal((await request(url)).status, 200, url);
    } finally {
      await stop();
    }
  },
);
