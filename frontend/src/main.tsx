import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:2rem;color:#FF3366;font-family:sans-serif">ไม่พบ #root — ลองรัน start.bat ใหม่</div>';
} else {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    rootEl.innerHTML = `
      <div style="min-height:100vh;background:#0A0A0F;color:#fff;padding:2rem;font-family:sans-serif">
        <h1 style="color:#FF3366">แอปโหลดไม่สำเร็จ</h1>
        <p style="color:#A0A0B0">${msg}</p>
        <ol style="color:#606070;font-size:14px;line-height:1.8">
          <li>ดับ terminal เก่า (Ctrl+C)</li>
          <li>double-click <b>start.bat</b> ในโฟลเดอร์โปรเจกต์</li>
          <li>เปิด <a href="http://127.0.0.1:5173" style="color:#00D4FF">http://127.0.0.1:5173</a> แล้วกด F5</li>
        </ol>
        <button onclick="location.reload()" style="margin-top:1rem;padding:8px 16px;background:#00D4FF22;border:1px solid #00D4FF55;color:#00D4FF;border-radius:8px;cursor:pointer">ลองใหม่</button>
      </div>`;
    console.error("Bootstrap error:", err);
  }
}
