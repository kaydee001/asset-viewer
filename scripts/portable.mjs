// after `npm run build:portable`: copies the portable exe to dist/ under its release name
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const name = `Asset.Viewer_${version}_x64-portable.exe`;
mkdirSync("dist", { recursive: true });
copyFileSync("src-tauri/target/release/asset-viewer.exe", `dist/${name}`);
console.log(`dist/${name}`);
