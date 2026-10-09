# ติดตั้งระบบ "AI ช่วยพิมพ์คำให้การ" และ "AI ร่างฟ้องกู้ยืมเงิน"

ทั้งสองแอปใช้หลังบ้าน (Code.gs) และ config.js ชุดเดียวกัน ผู้ใช้ลงทะเบียนครั้งเดียวใช้ได้ทั้งสองแอป โควตาต่อวันนับรวมกัน

## ส่วนประกอบ
- `answer/index.html` หน้าใช้งาน → https://aifree.in.th/answer/
- `answer/admin.html` หลังบ้าน → https://aifree.in.th/answer/admin.html
- `answer/config.js` ใส่ URL ระบบหลังบ้าน
- `complaint/index.html` + `complaint/forms/*.pdf` + `complaint/fonts/*` หน้าร่างฟ้อง → https://aifree.in.th/complaint/
- `answer/backend/Code.gs` โค้ดหลังบ้าน (วางใน Google Apps Script — ไม่ต้องอัปขึ้น GitHub ก็ได้)

## ขั้นตอน (ทำครั้งเดียว ~15 นาที)
1. สร้าง Google Sheet ใหม่ ตั้งชื่อ "aifree คำให้การ"
2. เมนู ส่วนขยาย → Apps Script ลบโค้ดเดิม วางโค้ดจาก `Code.gs` แล้วกดบันทึก
3. ⚙️ การตั้งค่าโปรเจ็กต์ → Script Properties → เพิ่ม
   - `CLAUDE_API_KEY` = API key จาก console.anthropic.com
   - `ADMIN_PASSWORD` = รหัสผ่านหลังบ้าน (ตั้งให้ยาว เดายาก)
4. กลับหน้าโค้ด เลือกฟังก์ชัน `setup` → กด เรียกใช้ → อนุญาตสิทธิ์ (จะสร้างแท็บ users และ jobs ในชีต)
5. ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ → ประเภท: เว็บแอป
   - เรียกใช้ในฐานะ: **ฉัน**
   - ผู้มีสิทธิ์เข้าถึง: **ทุกคน**
   - กด Deploy แล้วคัดลอก URL ที่ลงท้ายด้วย `/exec`
6. เปิด `answer/config.js` วาง URL ระหว่าง "..." แล้วอัปโหลดขึ้น GitHub
7. ทดสอบที่ https://aifree.in.th/answer/ และเข้าหลังบ้านที่ /answer/admin.html

## แก้โค้ดหลังบ้านภายหลัง
แก้ใน Apps Script แล้ว Deploy → จัดการการทำให้ใช้งานได้ → ✏️ แก้ไข → เวอร์ชัน: เวอร์ชันใหม่ → Deploy (URL เดิมใช้ต่อได้)

## ค่าที่ปรับได้ (Script Properties หรือหน้าหลังบ้าน)
| ชื่อ | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| SERVICE_OPEN | true | เปิด/ปิดบริการ |
| LIMIT_USER_DAY | 3 | คดีต่อผู้ใช้ต่อวัน |
| LIMIT_TOTAL_DAY | 50 | คดีรวมต่อวัน (คุมค่า AI ช่วงทดลอง) |
| MODEL | claude-sonnet-5-5 | รุ่น AI |
| PRICE_IN_MTOK / PRICE_OUT_MTOK | 3 / 15 | ราคา USD ต่อล้าน token (ใช้คำนวณค่าใช้จ่ายในหลังบ้าน — ตรวจราคาปัจจุบันแล้วแก้) |
| USD_THB | 36 | อัตราแลกเปลี่ยน |
| C_EFFORT | medium | ระดับการคิดของ AI ตอนร่างฟ้อง (low เร็ว/ถูก · medium · high ช้า/แพง) |

## ข้อมูลที่เก็บ
- users: ชื่อ เบอร์ LINE อีเมล สถานะผู้ใช้ เวลายินยอม จำนวนคดี
- jobs: เวลา ศาล ประเภทคดี เรื่อง จำนวนไฟล์ token ค่าใช้จ่าย สถานะ
- **ไม่เก็บ** ไฟล์คำฟ้อง ชื่อคู่ความ ข้อเท็จจริงที่ผู้ใช้เล่า หรือข้อความคำให้การ

## ทดสอบหน้าจอโดยไม่ต่อหลังบ้าน
เปิด https://aifree.in.th/answer/?mock=1 (ใช้ข้อมูลตัวอย่าง ไม่เรียก AI จริง)

## อัปเดตเพื่อเปิดแอปร่างฟ้อง (ถ้าเคยติดตั้งคำให้การไว้แล้ว)
1. วางโค้ด `Code.gs` ฉบับใหม่ทับใน Apps Script → บันทึก
2. Deploy → จัดการการทำให้ใช้งานได้ → ✏️ → เวอร์ชันใหม่ → Deploy (URL เดิม)
3. อัปโหลดโฟลเดอร์ `complaint/`, ไฟล์ `apps.js` และ `answer/admin.html` ขึ้น GitHub
4. ราคา Sonnet 5.5 ปัจจุบันคือ $2 / $10 ต่อล้าน token แก้ PRICE_IN_MTOK = 2 และ PRICE_OUT_MTOK = 10 ใน Script Properties ให้ค่าใช้จ่ายในหลังบ้านตรง
