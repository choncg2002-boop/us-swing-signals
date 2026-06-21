# Deploy บน Netlify — US Swing Signals

Netlify โฮสต์ **หน้าเว็บ (frontend)** ได้  
**Backend API** (Python/FastAPI + WebSocket + Paper Trading) ต้องรันบน **Render** (ฟรี) แล้วเชื่อม URL เข้ากัน

---

## ขั้นที่ 1: Deploy Backend บน Render (~10 นาที)

1. ไป [render.com](https://render.com) → Sign in ด้วย GitHub
2. **New +** → **Web Service**
3. เชื่อม repo **`choncg2002-boop/us-swing-signals`**
4. ตั้งค่า:

   | ช่อง | ค่า |
   |------|-----|
   | Name | `us-swing-api` |
   | Root Directory | *(ว่าง)* |
   | Runtime | **Docker** |
   | Dockerfile Path | `backend/Dockerfile` |
   | Docker Context | `backend` |

5. **Advanced** → Add Disk:
   - Mount Path: `/data/runtime`
   - Size: 1 GB

6. Environment Variables:

   ```
   USE_SP500_UNIVERSE=true
   RUNTIME_DIR=/data/runtime
   CORS_ORIGINS=*
   ```

7. กด **Create Web Service** → รอ deploy จน **Live**

8. **คัดลอก URL** เช่น `https://us-swing-api-xxxx.onrender.com`

---

## ขั้นที่ 2: Deploy Frontend บน Netlify (~5 นาที)

1. ไป [app.netlify.com](https://app.netlify.com) → Sign in ด้วย GitHub
2. **Add new site** → **Import an existing project**
3. เลือก **GitHub** → repo **`us-swing-signals`**
4. Netlify อ่าน `netlify.toml` อัตโนมัติ — ไม่ต้องแก้ Build settings
5. กด **Add environment variables** (สำคัญมาก):

   | Key | Value (ตัวอย่าง) |
   |-----|------------------|
   | `VITE_API_BASE_URL` | `https://us-swing-api-xxxx.onrender.com` |
   | `VITE_WS_BASE_URL` | `wss://us-swing-api-xxxx.onrender.com` |

   > ใส่ URL จาก Render ขั้นที่ 1 — **ไม่มี** `/` ท้าย URL

6. กด **Deploy site**

7. ได้ URL เช่น `https://random-name.netlify.app`  
   เปลี่ยนชื่อได้ที่ **Site configuration → Domain management**

---

## ขั้นที่ 3: ทดสอบ

เปิด URL Netlify แล้วเช็ก:

- [ ] กราฟหุ้นโหลดได้
- [ ] Paper Trading ซื้อ/ขายได้
- [ ] แถบพอร์ตแสดงเงินสด

ถ้า Backend ไม่ตอบ: Render อาจ sleep (แพลนฟรี) — รอ 30–60 วินาที แล้ว refresh

---

## อัปเดตโค้ดในอนาคต

- Push ขึ้น GitHub → **Netlify deploy อัตโนมัติ**
- Backend บน Render จะ rebuild ถ้าเชื่อม auto-deploy ไว้

---

## สรุป URL

| ส่วน | ที่โฮสต์ | URL |
|------|----------|-----|
| หน้าเว็บ | Netlify | `https://xxx.netlify.app` |
| API + WebSocket | Render | `https://us-swing-api-xxxx.onrender.com` |
