import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createInquiry, httpError } from "../domain/business";
import { products } from "../domain/store";

export const publicRouter = Router();

publicRouter.get("/products", async (request, response) => {
  const search = String(request.query.search || "")
    .trim()
    .toLocaleLowerCase();
  const vehicleType = String(request.query.vehicleType || "");
  const insuranceClass = String(request.query.insuranceClass || "");
  const category = String(request.query.category || "");
  const insurer = String(request.query.insurer || "");
  const maxPremium = Number(request.query.maxPremium || 0);
  const sort = String(request.query.sort || "displayOrder");
  const all = (await products.all()).filter((item) => item.active);
  const filtered = all.filter(
    (item) =>
      (!search ||
        [
          item.productName,
          item.shortDescription,
          item.insuranceClass,
          item.vehicleType,
        ].some((value) => value.toLocaleLowerCase().includes(search))) &&
      (!vehicleType || item.vehicleType === vehicleType) &&
      (!insuranceClass || item.insuranceClass === insuranceClass) &&
      (!category || item.productType === category) &&
      (!insurer || item.insurerName === insurer) &&
      (!maxPremium || item.startingPremium <= maxPremium),
  );
  filtered.sort((a, b) =>
    sort === "premiumAsc"
      ? a.startingPremium - b.startingPremium
      : sort === "premiumDesc"
        ? b.startingPremium - a.startingPremium
        : a.displayOrder - b.displayOrder,
  );
  response.json({ items: filtered, total: filtered.length });
});

publicRouter.get("/products/:slug", async (request, response) => {
  const item = (await products.all()).find(
    (product) => product.active && product.slug === request.params.slug,
  );
  if (!item) throw httpError(404, "Product not found");
  const related = (await products.all())
    .filter(
      (product) =>
        product.active &&
        product.productId !== item.productId &&
        product.vehicleType === item.vehicleType,
    )
    .slice(0, 3);
  response.json({ product: item, related });
});

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
publicRouter.post("/inquiries", inquiryLimiter, async (request, response) => {
  const item = await createInquiry(request.body);
  response.status(201).json({ inquiryId: item.inquiryId, status: item.status });
});

publicRouter.get("/faq", (_request, response) => {
  response.json([
    {
      question: "เบี้ยประกันที่แสดงเป็นราคาจริงหรือไม่",
      answer:
        "ไม่ใช่ เว็บไซต์นี้เป็นระบบสาธิต ราคาและความคุ้มครองเป็นข้อมูลตัวอย่างเท่านั้น",
    },
    {
      question: "เลือกประกันให้เหมาะกับรถอย่างไร",
      answer:
        "ดูประเภทการใช้งาน อายุรถ ความคุ้มครองที่ต้องการ และงบประมาณ แล้วใช้หน้าช่วยเลือกประกันเพื่อดูตัวอย่างผลิตภัณฑ์",
    },
    {
      question: "ส่งคำขอให้ติดต่อกลับแล้วจะเกิดอะไรขึ้น",
      answer:
        "คำขอจะถูกบันทึกไว้ในระบบสาธิตนี้เพื่อจำลองขั้นตอนการติดตามลูกค้า",
    },
  ]);
});
