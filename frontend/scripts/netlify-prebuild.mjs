import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const api = process.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const lines = [];

if (api) {
  const ws = (process.env.VITE_WS_BASE_URL ?? api.replace(/^http/i, "ws")).replace(/\/$/, "");
  lines.push(`/api/*  ${api}/api/:splat  200`);
  lines.push(`/ws/*   ${ws}/ws/:splat  200`);
  console.log(`[netlify-prebuild] API proxy → ${api}`);
} else if (process.env.NETLIFY) {
  console.warn(
    "[netlify-prebuild] WARNING: VITE_API_BASE_URL is not set — chart and Paper Trading will not work on Netlify.",
  );
}

lines.push("/*    /index.html   200");

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "_redirects"), `${lines.join("\n")}\n`);
