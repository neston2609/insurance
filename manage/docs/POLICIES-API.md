# API: รายการกรมธรรม์ทั้งหมด

```http
GET https://mfecinsure.demohub24.com/api/admin/policies/all
```

คืนหนึ่ง record ต่อกรมธรรม์จากฐานข้อมูล Management พร้อมข้อมูลลูกค้าและสินค้า โดยไม่ส่ง query parameter จะยังคืนกรมธรรม์ทั้งหมดเหมือนเดิม ไม่มี pagination และไม่ตัดกรมธรรม์หมดอายุ รายการ DNC หรือรายการที่เคย Sync แล้วออก สามารถกรองแบบ exact match ด้วย `policyId` และ/หรือ `customerId` โดยส่งค่าเดิมซ้ำหลายครั้งหรือคั่นหลายค่าด้วย comma การระบุทั้งสอง parameter จะเลือกเฉพาะกรมธรรม์ที่ตรงทั้งเงื่อนไข การเรียกนี้เป็นการอ่านข้อมูล ไม่ส่ง Lead หรือเปลี่ยนสถานะ Sync ข้อมูลของระบบ Demo และ MFEC LeadSync เป็นคนละฐานข้อมูล

| Query parameter | ความหมาย                                         | ตัวอย่าง                                                                    |
| --------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| `policyId`      | กรองตามรหัสกรมธรรม์แบบตรงค่า รองรับหลายค่า       | `?policyId=POL001&policyId=POL002` หรือ `?policyId=POL001,POL002`           |
| `customerId`    | คืนกรมธรรม์ทั้งหมดของลูกค้าที่ระบุ รองรับหลายค่า | `?customerId=CUST001&customerId=CUST002` หรือ `?customerId=CUST001,CUST002` |

เมื่อส่งทั้ง `policyId` และ `customerId` ระบบใช้ AND ระหว่างชนิดเงื่อนไข และใช้ OR ระหว่างหลายค่าของ parameter เดียวกัน เช่น `?policyId=POL001&policyId=POL002&customerId=CUST001` จะคืนกรมธรรม์ที่มี policy ID เป็น POL001 หรือ POL002 และ customer ID เป็น CUST001 หากไม่พบรายการที่ตรงกันจะได้ `{"items":[],"total":0}`

ใช้ session ของผู้ดูแลจากหน้า `/manage` หรือ Basic Auth ด้วย username/password ของ Management จึงต้องยืนยันตัวตนก่อน ไม่ต้องส่ง body ใน GET และไม่ต้องใส่ `/manage` หน้า `/api`

## Login

```http
POST https://mfecinsure.demohub24.com/api/admin/auth/login
Content-Type: application/json

{
  "username": "YOUR_MANAGE_USERNAME",
  "password": "YOUR_MANAGE_PASSWORD",
  "portal": "manage"
}
```

ใช้ username/password เดียวกับหน้า `/manage` เมื่อสำเร็จจะได้ HTTP 200 และ cookie `manage.sid` ให้ client เก็บแล้วส่งกลับในการเรียก GET ถัดไป Session มีอายุ 8 ชั่วโมง; หากหมดอายุหรือเปลี่ยนรหัสผ่านให้ Login ใหม่

## PowerShell

```powershell
$baseUrl = "https://mfecinsure.demohub24.com"
$loginBody = @{
    username = "YOUR_MANAGE_USERNAME"
    password = "YOUR_MANAGE_PASSWORD"
    portal   = "manage"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
    -Uri "$baseUrl/api/admin/auth/login" `
    -ContentType "application/json" `
    -Body $loginBody `
    -SessionVariable policySession

$result = Invoke-RestMethod -Method Get `
    -Uri "$baseUrl/api/admin/policies/all" `
    -WebSession $policySession

$result.total     # จำนวนกรมธรรม์ทั้งหมด
$result.items     # ข้อมูลทั้ง 23 ฟิลด์
$result | ConvertTo-Json -Depth 5
```

## curl

สร้าง `login.json` จาก body ตัวอย่างด้านบน แล้วใส่บัญชี Management จริง ตัวอย่างนี้ใช้ Bash; บน Windows ใช้ `curl.exe` หรือ PowerShell ด้านบน

```sh
curl --fail-with-body --silent --show-error \
  --cookie-jar cookies.txt \
  --header 'Content-Type: application/json' \
  --data @login.json \
  https://mfecinsure.demohub24.com/api/admin/auth/login

curl --fail-with-body --silent --show-error \
  --cookie cookies.txt \
  https://mfecinsure.demohub24.com/api/admin/policies/all

# กรองหลาย policyId โดยส่ง query parameter ซ้ำ
curl --fail-with-body --silent --show-error \
  --cookie cookies.txt \
  'https://mfecinsure.demohub24.com/api/admin/policies/all?policyId=POL001&policyId=POL002'

# กรองกรมธรรม์ทั้งหมดของหลาย customerId
curl --fail-with-body --silent --show-error \
  --cookie cookies.txt \
  'https://mfecinsure.demohub24.com/api/admin/policies/all?customerId=CUST001,CUST002'

# Basic Auth ใช้ username/password เดียวกับหน้า Management
curl --fail-with-body --silent --show-error \
  --user "$MANAGE_USERNAME:$MANAGE_PASSWORD" \
  'https://mfecinsure.demohub24.com/api/admin/policies/all?policyId=POL001,POL002'
```

ไฟล์ `login.json` และ `cookies.txt` มีข้อมูลยืนยันตัวตน ให้เก็บเฉพาะเครื่องที่เรียก API และไม่นำขึ้น Git

## Postman / เรียกจากหน้าเว็บ

ใน Postman ส่ง POST Login ด้วย Body → raw → JSON ตามตัวอย่าง จากนั้นส่ง GET endpoint รายการกรมธรรม์บน hostname เดียวกัน Postman จะเก็บและส่ง cookie ให้อัตโนมัติ ตรวจสอบใน Cookies ว่ามี `manage.sid` และเปิด cookie jar หากใช้ Basic Auth ให้เลือก Authorization → Basic Auth แล้วใส่บัญชี Management

จากหน้า `/manage` ที่ Login อยู่แล้ว เรียก `fetch('/api/admin/policies/all', {credentials:'same-origin'})` ได้โดยใช้ session ปัจจุบัน

## Response

HTTP 200, `Content-Type: application/json`, `Cache-Control: no-store`

```json
{
  "items": [
    {
      "customerId": "CUST_EXAMPLE",
      "policyId": "POL_EXAMPLE",
      "policyNumber": "DEMO-EXAMPLE-001",
      "firstName": "Example",
      "lastName": "Customer",
      "phone": "+66810000000",
      "productName": "Example Motor Insurance",
      "vehicleType": "CAR",
      "vehicleBrand": "Toyota",
      "vehicleModel": "Yaris",
      "licensePlate": "EXAMPLE",
      "insurerName": "Example Insurance",
      "premium": 12000,
      "effectiveDate": "2025-12-02",
      "expiryDate": "2026-12-01",
      "daysUntilExpiry": 33,
      "renewalStatus": "CONTACT_PENDING",
      "preferredChannel": "LINE",
      "digitalSent": false,
      "voiceCalled": false,
      "customerIntent": "UNKNOWN",
      "callbackDateTime": null,
      "dnc": false
    }
  ],
  "total": 1
}
```

ข้อมูลข้างต้นเป็นตัวอย่างสมมติ โดย `daysUntilExpiry` คำนวณ ณ วันที่ 29 ตุลาคม 2026 ไม่ใช่ข้อมูล Production ค่า enum ของสถานะ/ช่องทางคืนตามที่บันทึกในกรมธรรม์

| Field                                                 | JSON type / ความหมาย                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| customerId, policyId, policyNumber                    | string: รหัสลูกค้า รหัสกรมธรรม์ เลขกรมธรรม์                                               |
| firstName, lastName, phone                            | string: ชื่อ นามสกุล เบอร์โทรจากลูกค้า                                                    |
| productName                                           | string: ชื่อผลิตภัณฑ์จาก productId ของกรมธรรม์                                            |
| vehicleType, vehicleBrand, vehicleModel, licensePlate | string: ประเภท ยี่ห้อ รุ่น และทะเบียนรถ                                                   |
| insurerName                                           | string: บริษัทประกันของกรมธรรม์                                                           |
| premium                                               | number: เบี้ยประกัน                                                                       |
| effectiveDate, expiryDate                             | string: วันเริ่มและสิ้นสุดคุ้มครอง `YYYY-MM-DD`                                           |
| daysUntilExpiry                                       | number: วันสิ้นสุดลบวันปัจจุบันตามปฏิทิน Asia/Bangkok; 0 = วันนี้, ค่าติดลบ = หมดอายุแล้ว |
| renewalStatus, preferredChannel, customerIntent       | string: สถานะต่ออายุ ช่องทางติดต่อ และความสนใจที่บันทึกในกรมธรรม์                         |
| digitalSent, voiceCalled                              | boolean: ส่งข้อความดิจิทัล/โทรติดต่อแล้วหรือไม่                                           |
| callbackDateTime                                      | string / null: เวลานัดหมายตามค่าที่บันทึก; ไม่มีนัดหมายคืน null                           |
| dnc                                                   | boolean / null: ค่า Do Not Call ของลูกค้า; null เมื่อไม่พบข้อมูลลูกค้าที่อ้างอิง          |

เบอร์มือถือไทยที่ถูกต้องแปลงเป็นรูปแบบ `+66`; ถ้ารูปแบบไม่ถูกต้องจะคืนค่าที่เก็บไว้ หากข้อมูลอ้างอิงลูกค้าหรือสินค้าหาย ยังคงคืนกรมธรรม์นั้น โดยข้อความที่หาไม่พบเป็น `""` และ `dnc` เป็น `null` เมื่อไม่พบลูกค้า

`items` เป็น array; หากไม่มีกรมธรรม์จะได้ `{"items":[],"total":0}` ระบบเดิม `GET /api/admin/policies` ยังคงทำงานแบบแบ่งหน้าเหมือนเดิม

## Error

| HTTP status | ความหมาย                                                             |
| ----------- | -------------------------------------------------------------------- |
| 401         | ยังไม่ Login, session หมดอายุ หรือรหัสผ่านเปลี่ยนแล้ว ให้ Login ใหม่ |
| 400         | รูปแบบ Login ไม่ถูกต้อง เช่น portal ไม่ใช่ manage                    |
| 429         | พยายาม Login เกินจำนวนที่กำหนด ให้รอแล้วลองใหม่                      |
| 500         | Server อ่านข้อมูลไม่สำเร็จ ให้ตรวจ log ของ insurance-manage          |
