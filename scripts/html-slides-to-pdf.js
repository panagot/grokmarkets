// Convert multiple HTML slide files (1280x720) into a single PDF
// Usage: node scripts/html-slides-to-pdf.js slides GrokMarkets_HTMLDeck.pdf

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

async function ensurePuppeteer() {
  try {
    return require('puppeteer');
  } catch (e) {
    console.error('Puppeteer is not installed. Run: npm i puppeteer --no-audit --no-fund');
    process.exit(1);
  }
}

async function renderHtmlToPngBuffer(browser, filePath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  const html = fs.readFileSync(filePath, 'utf8');
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buffer = await page.screenshot({ type: 'png', fullPage: false });
  await page.close();
  return buffer;
}

async function main() {
  const inputDir = process.argv[2] || 'slides';
  const outputPdf = process.argv[3] || 'GrokMarkets_HTMLDeck.pdf';

  if (!fs.existsSync(inputDir)) {
    console.error(`Slides directory not found: ${inputDir}\nCreate it and add your HTML files (e.g., page1.html ... page12.html).`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith('.html'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.error(`No HTML files found in ${inputDir}. Add your slides as .html files and rerun.`);
    process.exit(1);
  }

  const puppeteer = await ensurePuppeteer();
  const browser = await puppeteer.launch({ headless: 'new' });

  try {
    const doc = new PDFDocument({ size: [1280, 720], margins: { top: 0, left: 0, right: 0, bottom: 0 } });
    const outPath = path.join(process.cwd(), outputPdf);
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fullPath = path.join(inputDir, file);
      console.log(`Rendering ${file} ...`);
      const pngBuffer = await renderHtmlToPngBuffer(browser, fullPath);
      if (i > 0) doc.addPage();
      doc.image(pngBuffer, 0, 0, { width: 1280, height: 720 });
    }

    doc.end();
    await new Promise((resolve) => stream.on('finish', resolve));
    console.log(`✅ Created ${outputPdf} with ${files.length} slides.`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Failed to create PDF:', err);
  process.exit(1);
});


