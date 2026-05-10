const sharp = require('sharp');
const path = require('path');

async function generateIcon(size, outputPath) {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#1a732a"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" 
          font-family="Arial, Helvetica, sans-serif" font-weight="bold" 
          font-size="${size * 0.65}px" fill="white">S</text>
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
}

(async () => {
  const dir = __dirname;
  await generateIcon(192, path.join(dir, 'icon-192x192.png'));
  await generateIcon(512, path.join(dir, 'icon-512x512.png'));
  console.log('Done!');
})();
