# วิธี Deploy เว็บถาวร — US Swing Signals

มี 2 วิธีหลัก:

| วิธี | ใช้จากที่ไหน | ค่าใช้จ่าย |
|------|-------------|-----------|
| **A. Render.com** | อินเทอร์เน็ตทั่วโลก (URL ถาวร) | ฟรี (อาจ sleep 15 นาทีถ้าไม่มีคนใช้) |
| **B. Docker บน PC** | WiFi เดียวกัน (มือถือ/แล็ปท็อปในบ้าน) | ฟรี |

---

## A. Deploy บน Render (แนะนำ — ใช้จากเครื่องไหนก็ได้)

### ขั้นที่ 1: อัปโหลดโค้ดขึ้น GitHub

1. ติดตั้ง [GitHub Desktop](https://desktop.github.com/) หรือใช้ git
2. สร้าง repo ใหม่บน GitHub ชื่อเช่น `us-swing-signals`
3. ในโฟลเดอร์โปรเจกต์ `หุ้นสหรัฐ` รัน:

```powershell
cd "C:\Users\chonc\OneDrive\Documents\หุ้นสหรัฐ"
git init
git add .
git commit -m "Initial commit — US Swing Signals"
git branch -M main
git remote add origin https://github.com/ชื่อคุณ/us-swing-signals.git
git push -u origin main
```

> ถ้า git ถูก init ที่โฟลเดอร์ home มาก่อน ให้รัน `git init` ใหม่ในโฟลเดอร์ `หุ้นสหรัฐ` เท่านั้น

### ขั้นที่ 2: สมัคร Render

1. ไปที่ [https://render.com](https://render.com) → Sign Up (ใช้ GitHub login ได้)
2. Dashboard → **New +** → **Blueprint**
3. เชื่อม GitHub repo `us-swing-signals`
4. Render จะอ่านไฟล์ `render.yaml` อัตโนมัติ
5. กด **Apply** — รอ build 10–15 นาที

### ขั้นที่ 3: ได้ URL ถาวร

เมื่อ deploy สำเร็จ จะได้ URL แบบ:

```
https://us-swing-signals-xxxx.onrender.com
```

เปิด URL นี้จากมือถือ/เครื่องไหนก็ได้ — ไม่ต้องรัน `start.bat` อีก

### หมายเหตุ Render ฟรี

- ถ้าไม่มีคนเข้า 15 นาที เซิร์ฟเวอร์จะ sleep — เปิดครั้งแรกอาจรอ 30–60 วินาที
- Scan S&P 500 ครั้งแรกอาจใช้เวลา 5–10 นาที
- ข้อมูล cache เก็บใน disk 1GB (ตั้งใน render.yaml แล้ว)

---

## B. Deploy บน PC (ใช้ใน WiFi เดียวกัน)

### ต้องมี Docker Desktop

ดาวน์โหลด: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

### วิธีรัน

**ดับเบิลคลิก `deploy-local.bat`**

หรือใน terminal:

```powershell
cd "C:\Users\chonc\OneDrive\Documents\หุ้นสหรัฐ"
docker compose up --build -d
```

### เปิดเว็บ

| จาก | URL |
|-----|-----|
| PC เครื่องนี้ | http://localhost |
| มือถือ/เครื่องอื่น (WiFi เดียวกัน) | http://IP-ของ-PC (แสดงใน deploy-local.bat) |

หยุดเซิร์ฟเวอร์:

```powershell
docker compose down
```

---

## โครงสร้าง Production

```
Dockerfile (root)     → frontend + backend + nginx ใน container เดียว (ใช้กับ Render)
docker-compose.yml    → แยก 2 container สำหรับรันบน PC
render.yaml           → ตั้งค่า Render อัตโนมัติ
```

Frontend เรียก API ผ่าน path เดียวกัน (`/api/`, `/ws/`) — ไม่ต้องตั้ง `VITE_API_BASE_URL` ใน production

---

## แก้ปัญหา

| อาการ | วิธีแก้ |
|-------|---------|
| Render build ล้มเหลว | ดู Logs ใน Render Dashboard → มักเป็น npm/pip timeout — กด Manual Deploy ใหม่ |
| เปิด URL แล้วช้ามาก | Render free tier sleep — รอ 1 นาที |
| มือถือเปิด IP ไม่ได้ | ตรวจ Windows Firewall อนุญาต port 80, ต้อง WiFi เดียวกัน |
| Scan ค้าง | ปกติสำหรับ S&P 500 — ใช้ Quick Scan 23 หุ้นก่อน |

---

## อัปเกรด (ถ้าต้องการ)

- **โดเมนของตัวเอง** — ซื้อ domain แล้วชี้ CNAME ไป Render
- **ไม่ sleep** — Render paid plan $7/เดือน
- **VPS** — รัน `docker compose up -d` บน DigitalOcean / Oracle Cloud
