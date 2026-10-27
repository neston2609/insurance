import { z } from "zod";

import { isValidPhone, normalizeThaiPhone } from "./campaign-contact";

import { audit, inquiries, nextId, products } from "./store";

import { CHANNELS } from "./types";

export function httpError(
  status: number,
  message: string,
): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

const channel = z.enum(CHANNELS);

const phone = z
  .string()
  .refine(isValidPhone, "Enter a valid Thai mobile phone number")
  .transform(normalizeThaiPhone);

const inquiryInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone,
  productId: z.string().min(1),
  preferredChannel: channel,
  preferredContactTime: z.string().trim().min(1).max(120),
  consent: z.literal(true),
});

export async function createInquiry(
  input: unknown,
): Promise<Awaited<ReturnType<typeof inquiries.all>>[number]> {
  const data = inquiryInput.parse(input);
  if (!(await products.findById("productId", data.productId)))
    throw httpError(400, "Product not found");
  const item = await inquiries.mutate((rows) => {
    const timestamp = new Date().toISOString();
    const inquiry = {
      ...data,
      inquiryId: nextId("INQ", rows, "inquiryId"),
      status: "NEW" as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    rows.push(inquiry);
    return inquiry;
  });
  await audit("CREATE_INQUIRY", "public", item.inquiryId);
  return item;
}
