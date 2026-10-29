import {
  daysUntilExpiry,
  isValidPhone,
  normalizeThaiPhone,
} from "../domain/campaign-contact";
import type { CampaignContact } from "../domain/campaign-contact";
import { customers, policies, products } from "../domain/store";

export type PolicyListItem = Omit<
  CampaignContact,
  | "premium"
  | "daysUntilExpiry"
  | "digitalSent"
  | "voiceCalled"
  | "callbackDateTime"
  | "dnc"
> & {
  premium: number;
  daysUntilExpiry: number;
  digitalSent: boolean;
  voiceCalled: boolean;
  callbackDateTime: string | null;
  dnc: boolean | null;
};

/** Read every policy without campaign eligibility rules or pagination. */
export async function listAllPolicies(now = new Date()) {
  const [allPolicies, allCustomers, allProducts] = await Promise.all([
    policies.all(),
    customers.all(),
    products.all(),
  ]);
  const customerMap = new Map(
    allCustomers.map((customer) => [customer.customerId, customer]),
  );
  const productMap = new Map(
    allProducts.map((product) => [product.productId, product]),
  );
  const items: PolicyListItem[] = allPolicies.map((policy) => {
    const customer = customerMap.get(policy.customerId);
    const product = productMap.get(policy.productId);
    const phone = customer?.phone || "";
    return {
      customerId: policy.customerId,
      policyId: policy.policyId,
      policyNumber: policy.policyNumber,
      firstName: customer?.firstName || "",
      lastName: customer?.lastName || "",
      phone: isValidPhone(phone) ? normalizeThaiPhone(phone) : phone,
      productName: product?.productName || "",
      vehicleType: policy.vehicle.vehicleType,
      vehicleBrand: policy.vehicle.brand,
      vehicleModel: policy.vehicle.model,
      licensePlate: policy.vehicle.licensePlate,
      insurerName: policy.insurerName,
      premium: policy.premium,
      effectiveDate: policy.effectiveDate,
      expiryDate: policy.expiryDate,
      daysUntilExpiry: daysUntilExpiry(policy.expiryDate, now),
      renewalStatus: policy.renewalStatus,
      preferredChannel: policy.preferredChannel,
      digitalSent: policy.digitalSent,
      voiceCalled: policy.voiceCalled,
      customerIntent: policy.customerIntent || "",
      callbackDateTime: policy.callbackDateTime || null,
      // A missing customer must not silently imply permission to contact them.
      dnc: customer?.dnc ?? null,
    };
  });
  return { items, total: items.length };
}
