# Deploy บน Netlify เท่านั้น (ไม่ต้องใช้ Render)

เว็บนี้รันบน **Netlify อย่างเดียว**:

| ส่วน | ที่โฮสต์ |
|------|----------|
| หน้าเว็บ + API หุ้น | **Netlify Functions** |
| Paper Trading | **localStorage ในเบราว์เซอร์** |

---

## ขั้นตอน Deploy

1. Push โค้ดขึ้น GitHub (`push-github.bat`)
2. ไป [app.netlify.com](https://app.netlify.com) → **Import** repo `us-swing-signals`
3. Netlify อ่าน `netlify.toml` อัตโนมัติ — **ไม่ต้องตั้ง env เพิ่ม**
4. กด **Deploy site**

---

## หลัง Deploy

- URL เช่น `https://xxx.netlify.app`
- กด **Deploys → Trigger deploy** ทุกครั้งที่ push GitHub ใหม่

---

## หมายเหตุ

- **Paper Trading** เก็บในเบราว์เซอร์ — ล้าง cache / เปลี่ยนเครื่อง = ข้อมูลหาย
- **ประวัติคำสั่ง** ล้างอัตโนมัติทุกวัน (ตาม timezone ไทย)
- **Live price** อัปเดตทุก ~60 วินาที (ไม่มี WebSocket บน Netlify)
- Scan หุ้นใช้ Yahoo Finance ผ่าน Netlify Functions

---

## Dev บนเครื่องตัวเอง

ยังใช้ `start.bat` ได้ตามเดิม (backend Python บน port 8003)
