import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

// API ต้องมาก่อน /* — ไม่งั้นได้ HTML แทน JSON
const redirects = [
  "/api/v1/*  /.netlify/functions/api  200",
  "/*         /index.html              200",
].join("\n");

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "_redirects"), `${redirects}\n`);
