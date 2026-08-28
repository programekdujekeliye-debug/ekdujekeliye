import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const seminarDir = path.resolve('../frontend/public/SEMINAR IMAGE');
const imagesDir = path.resolve('../frontend/public/images');
const optimizedSeminarDir = path.resolve('../frontend/public/seminar-optimized');

if (!fs.existsSync(optimizedSeminarDir)) {
  fs.mkdirSync(optimizedSeminarDir, { recursive: true });
}

async function optimizeAll() {
  console.log('🚀 Starting Sharp Image Optimization...');

  const seminarFiles = fs.readdirSync(seminarDir).filter(f =>
    f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')
  );

  for (const file of seminarFiles) {
    const inputPath = path.join(seminarDir, file);
    const baseName = file.replace(/\.[^/.]+$/, "");
    const outputGridPath = path.join(optimizedSeminarDir, `${baseName}.jpg`);
    const outputGridWebp = path.join(optimizedSeminarDir, `${baseName}.webp`);

    try {
      // 1. Web-optimized 1000px JPEG (quality 80)
      await sharp(inputPath)
        .rotate() // auto-orient based on EXIF
        .resize({ width: 1000, withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true, mozjpeg: true })
        .toFile(outputGridPath);

      // 2. Web-optimized 1000px WebP (quality 80)
      await sharp(inputPath)
        .rotate()
        .resize({ width: 1000, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toFile(outputGridWebp);

      const oldSizeMB = (fs.statSync(inputPath).size / (1024 * 1024)).toFixed(2);
      const newSizeKB = (fs.statSync(outputGridPath).size / 1024).toFixed(1);
      const newWebpKB = (fs.statSync(outputGridWebp).size / 1024).toFixed(1);

      console.log(`✓ ${file} [${oldSizeMB} MB] -> JPG: ${newSizeKB} KB, WebP: ${newWebpKB} KB`);
    } catch (err) {
      console.error(`❌ Failed ${file}:`, err.message);
    }
  }

  // Hero and about images
  console.log('\nOptimizing Hero & Portrait images...');
  const heroFiles = ['042A3646.JPG', '042A8497.JPG'];
  for (const file of heroFiles) {
    const inputPath = path.join(imagesDir, file);
    if (!fs.existsSync(inputPath)) continue;
    const baseName = file.replace(/\.[^/.]+$/, "");
    const outputJpg = path.join(imagesDir, `opt_${baseName}.jpg`);

    try {
      await sharp(inputPath)
        .rotate()
        .resize({ width: 900, withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toFile(outputJpg);

      const oldSizeMB = (fs.statSync(inputPath).size / (1024 * 1024)).toFixed(2);
      const newSizeKB = (fs.statSync(outputJpg).size / 1024).toFixed(1);
      console.log(`✓ Hero ${file} [${oldSizeMB} MB] -> opt_${baseName}.jpg: ${newSizeKB} KB`);
    } catch (err) {
      console.error(`❌ Failed ${file}:`, err.message);
    }
  }

  console.log('\n🎉 Sharp Optimization Complete! All assets are ultra-lightweight and lightning fast.');
}

optimizeAll();
