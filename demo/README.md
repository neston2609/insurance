# Insurance Demo Website

แอปนี้ติดตั้ง build และรันได้ด้วยตัวเอง ไม่ใช้ package, server, session หรือฐานข้อมูลจากแอปอื่น

## เริ่มใช้งาน

ต้องใช้ Node.js 20.19+ หรือ 22.12+ และ npm

```sh
npm ci
# คัดลอก .env.example เป็น .env และกำหนดค่าตามเครื่อง
npm test
npm run build
npm start
```

เปิด http://localhost:3000/

สำหรับพัฒนา เปิดสอง terminal: `npm run dev:server` และ `npm run dev:client` แล้วเข้า http://localhost:5173/ ถ้าเปลี่ยน PORT ให้เปลี่ยน API_PROXY_TARGET ใน .env ตามด้วย

## ความสามารถ

หน้าหลัก แคตตาล็อกสินค้า เปรียบเทียบสินค้า ตัวช่วยเลือกประกัน และแบบฟอร์มขอให้ติดต่อกลับ บันทึกข้อมูลลง data/ ของ Demo เอง ไม่มีระบบล็อกอินหรือ admin API

Routes: /, /products, /products/:slug, /recommend, /contact; API: /api/public/products, /api/public/inquiries, /api/public/faq

## แยกข้อมูลและการย้ายระบบ

ข้อมูลใน data/, backups/, exports/ และ .env ไม่ถูก commit เมื่อ clone repo ใหม่จะสร้างข้อมูลตัวอย่างโดยอัตโนมัติ Local checkout ที่แยกจากระบบเดิมมีสำเนาข้อมูล JSON เดิมเฉพาะส่วนที่ใช้ โดยไม่คัดลอก credentials หรือ sessions

การแก้ข้อมูลในระบบหนึ่งไม่เปลี่ยนข้อมูลอีกระบบหนึ่ง ไม่มีการ sync อัตโนมัติ หากย้ายข้อมูลให้หยุดแอปปลายทาง สำรองข้อมูล แล้วคัดลอก JSON ที่ต้องการเข้า data/ ของปลายทาง ระบบ MFEC ใช้ customers.json, products.json, policies.json และ campaign-lists.json ของตัวเอง; ถ้าคัดลอกกรมธรรม์จากระบบเดิมให้ล้างสถานะ genesys ก่อนเริ่มส่งไป Contact List ใหม่ และตรวจสอบ preview

DATA_DIR และ BACKUPS_DIR กำหนดเป็น absolute path เพื่อย้ายข้อมูลได้ แต่ต้องใช้คนละ directory กับแอปอื่น

## Deploy

ตัวอย่าง systemd และ Nginx อยู่ใน deploy/ ใช้ hostname ของแต่ละระบบและเพิ่ม TLS ก่อนใช้งาน production เพราะ admin cookie บังคับ HTTPS ให้สิทธิ์เขียน data/, backups/, exports/ กับ service user และแก้ WorkingDirectory ให้ตรงกับเครื่องจริง

GET /api/health ใช้ตรวจสอบสถานะ ตัวอย่างทั้งหมดใช้ข้อมูลประกันสมมติและไม่ออกกรมธรรม์หรือรับชำระเงินจริง
