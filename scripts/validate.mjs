import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const requiredFiles = [
  "content.js", "styles.css", "README.md", "LICENSE", "PRIVACY.md", "STORE-LISTING.md",
  "CONTRIBUTING.md", "SECURITY.md", "RELEASE-CHECKLIST.md", "tests/fixture.html",
  "tests/browser-smoke.sh", "tests/live-public-smoke.sh", ".github/workflows/validate.yml",
  "store-assets/promo-440x280.png",
  "icons/icon-16.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-128.png"
];

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Manifest must use Manifest V3.");
if (manifest.version !== "0.1.0") throw new Error("Expected release version 0.1.0.");
if (!manifest.version_name?.includes("rc")) throw new Error("Expected an RC version_name.");
if (manifest.description.length > 132) throw new Error("Manifest description exceeds the store limit.");
if (Object.keys(manifest.icons || {}).length < 4) throw new Error("Required icon sizes are missing.");
if (manifest.permissions?.length) throw new Error("This extension must not request optional permissions.");
if (manifest.host_permissions?.length) throw new Error("Use the content-script match only; do not add host permissions.");
const contentScript = manifest.content_scripts?.[0];
if (contentScript?.matches?.join() !== "https://open.spotify.com/*") {
  throw new Error("The content script must be limited to open.spotify.com.");
}
if (contentScript?.css?.join() !== "styles.css") throw new Error("The packaged stylesheet is missing.");

for (const relativePath of requiredFiles) {
  await access(new URL(`../${relativePath}`, import.meta.url));
}

async function assertPngDimensions(relativePath, width, height) {
  const png = await readFile(new URL(`../${relativePath}`, import.meta.url));
  if (png.toString("ascii", 1, 4) !== "PNG") throw new Error(`${relativePath} is not a PNG.`);
  if (png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) {
    throw new Error(`${relativePath} must be ${width}x${height}.`);
  }
}

for (const size of [16, 32, 48, 128]) {
  await assertPngDimensions(`icons/icon-${size}.png`, size, size);
}
await assertPngDimensions("store-assets/promo-440x280.png", 440, 280);

const syntax = spawnSync(process.execPath, ["--check", `${root}/content.js`], { encoding: "utf8" });
if (syntax.status !== 0) throw new Error(syntax.stderr || "content.js syntax check failed.");

console.log("Spotify Vim Navigation release-candidate static checks passed.");
