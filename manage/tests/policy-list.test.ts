import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

test("all-policy feed retains expired, DNC and orphan records and uses Bangkok calendar days", async () => {
  const folder = await mkdtemp(
    path.join(os.tmpdir(), "insurance-policy-feed-"),
  );
  process.env.DATA_DIR = folder;
  try {
    const store = await import("../server/domain/store");
    const { seedCustomers, seedPolicies, seedProducts } =
      await import("../server/domain/seed");
    const { listAllPolicies } =
      await import("../server/services/policy-list.service");
    const customer = {
      ...seedCustomers()[0],
      phone: "081-234-5678",
      dnc: true,
    };
    const product = seedProducts()[0];
    const policy = {
      ...seedPolicies()[0],
      customerId: customer.customerId,
      productId: product.productId,
      expiryDate: "2026-10-30",
      callbackDateTime: null,
    };
    await store.customers.replaceAll([customer]);
    await store.products.replaceAll([product]);
    await store.policies.replaceAll([
      policy,
      { ...policy, policyId: "EXPIRED", expiryDate: "2020-01-01" },
      {
        ...policy,
        policyId: "ORPHAN",
        customerId: "missing-customer",
        productId: "missing-product",
      },
    ]);
    const before = await listAllPolicies(new Date("2026-10-29T16:59:59Z"));
    const after = await listAllPolicies(new Date("2026-10-29T17:00:00Z"));
    assert.equal(before.total, 3);
    assert.equal(before.items[0].daysUntilExpiry, 1);
    assert.equal(after.items[0].daysUntilExpiry, 0);
    assert.equal(before.items[0].phone, "+66812345678");
    assert.equal(before.items[0].dnc, true);
    assert.equal(before.items[0].callbackDateTime, null);
    assert.ok(
      before.items.find((row) => row.policyId === "EXPIRED")!.daysUntilExpiry <
        0,
    );
    const orphan = before.items.find((row) => row.policyId === "ORPHAN")!;
    assert.equal(orphan.firstName, "");
    assert.equal(orphan.productName, "");
    assert.equal(orphan.dnc, null);
    assert.equal(orphan.customerId, "missing-customer");
    await store.policies.replaceAll([]);
    assert.deepEqual(await listAllPolicies(), { items: [], total: 0 });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
