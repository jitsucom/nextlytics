// /// script
// /// dependencies = ["sharp"]

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const svgPath = join(__dirname, "../src/app/icon.svg");

const svg = readFileSync(svgPath, "utf-8");
// Update viewBox to render at proper size
const svgForRender = svg.replace('width="32" height="32"', 'width="512" height="512"');

async function generateIcons() {
  const svgBuffer = Buffer.from(svgForRender);

  // Generate PNG icons at different sizes
  const sizes = [
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
  ];

  for (const { name, size } of sizes) {
    await sharp(svgBuffer).resize(size, size).png().toFile(join(publicDir, name));
    console.log(`Generated ${name}`);
  }

  // Generate favicon.ico (32x32)
  const favicon = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  writeFileSync(join(publicDir, "favicon.ico"), favicon);
  console.log("Generated favicon.ico");

  console.log("Done!");
}

generateIcons();
