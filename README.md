# Insurance applications

สองแอปอิสระใน repository เดียวกัน:

| แอป | Folder | Production | Development |
| --- | --- | --- | --- |
| Demo Insurance Website | demo/ | http://localhost:3000/ | http://localhost:5173/ |
| Insurance Management | manage/ | http://localhost:3001/manage | http://localhost:5174/manage |

แต่ละ folder มี package.json, lockfile, .env, server, frontend และ data/ ของตัวเอง ติดตั้งและ deploy เฉพาะแอปที่ต้องการได้ ไม่มี npm workspace หรือ shared runtime package

เข้า folder ของแต่ละแอปแล้วรัน npm ci, คัดลอก .env.example เป็น .env, npm test, npm run build, npm start ดูรายละเอียดใน README.md ของแอป

MFEC Lead Import/Export แยกอยู่ที่ https://github.com/neston2609/mfecleadimport ไม่มีการใช้ข้อมูลหรือ session ร่วมกัน ทั้งสามระบบใช้พอร์ต 3000, 3001, 3002 จึงเปิดพร้อมกันได้

เมื่อแยกระบบแล้ว คำขอติดต่อกลับของ Demo เก็บใน Demo เท่านั้น ไม่ปรากฏใน Management โดยอัตโนมัติ การเปลี่ยนสินค้าและกรมธรรม์ใน Management ไม่กระทบ Demo หรือ MFEC
