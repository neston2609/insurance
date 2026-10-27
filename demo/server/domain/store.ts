import { randomUUID } from "node:crypto";

import { JsonRepository } from "./json-repository";

import { seedInquiries, seedProducts } from "./seed";

import type { AuditRecord, Inquiry, Product } from "./types";

export const products = new JsonRepository<Product>(
  "products.json",
  seedProducts,
);

export const inquiries = new JsonRepository<Inquiry>(
  "inquiries.json",
  seedInquiries,
);

export const auditLog = new JsonRepository<AuditRecord>(
  "audit-log.json",
  () => [],
);

export async function audit(
  action: string,
  actor: string,
  target = "",
  detail: Record<string, unknown> = {},
): Promise<void> {
  await auditLog.mutate((rows) => {
    rows.unshift({
      id: randomUUID(),
      action,
      actor,
      target,
      detail,
      timestamp: new Date().toISOString(),
    });
  });
}

export function nextId<T>(prefix: string, rows: T[], key: keyof T): string {
  const highest = rows.reduce((max, row) => {
    const match = String(row[key] ?? "").match(new RegExp(`^${prefix}(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(5, "0")}`;
}
export async function initializeBusinessData() {
  for (const repo of [products, inquiries, auditLog]) await repo.initialize();
}
