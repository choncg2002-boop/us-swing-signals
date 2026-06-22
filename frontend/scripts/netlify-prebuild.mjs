import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "_redirects"), "/*    /index.html   200\n");
