// New generator: Futuristic gradient design, minimal copy, 12 slides per spec

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const THEME = {
  darkBg: '#0B0B17',
  lightBg: '#0F1224',
  gradStart: '#6C63FF', // purple
  gradEnd: '#22D3EE',   // cyan
  accent: '#7C3AED',
  cyan: '#22D3EE',
  text: '#E6E7EF',
  subtext: '#9AA0B6',
  white: '#FFFFFF'
};

function header(doc) {
  // subtle top bar
  doc.save();
  doc.rect(0, 0, doc.page.width, 20).fill(THEME.lightBg);
  doc.fill(THEME.subtext).fontSize(9).text('grokmarkets.com  |  @grokmarketscom', 16, 5, { width: doc.page.width - 32, align: 'right' });
  doc.restore();
}

function gradientBackground(doc) {
  const lg = doc.linearGradient(0, 20, doc.page.width, doc.page.height);
  lg.stop(0, THEME.darkBg);
  lg.stop(1, THEME.lightBg);
  doc.rect(0, 20, doc.page.width, doc.page.height - 20).fill(lg);
}

function titleSlide(doc, title, subtitle, footer) {
  header(doc);
  gradientBackground(doc);
  // big gradient headline block
  const gh = doc.linearGradient(40, 80, doc.page.width - 40, 160);
  gh.stop(0, THEME.gradStart);
  gh.stop(1, THEME.gradEnd);
  doc.fill(gh).fontSize(26).text(title, 40, 80, { width: doc.page.width - 80 });
  doc.fill(THEME.subtext).fontSize(14).text(subtitle, 40, 130, { width: doc.page.width - 80 });
  doc.fill(THEME.text).fontSize(11).text('Tweet → Bet → Auto‑payout', 40, 162);
  if (footer) doc.fill(THEME.subtext).fontSize(10).text(footer, 40, doc.page.height - 60);
  // visual placeholder
  doc.roundedRect(doc.page.width - 240, 80, 180, 120, 8).strokeColor(THEME.gradEnd).lineWidth(1).stroke();
  doc.fill(THEME.subtext).fontSize(9).text('Hero visual placeholder', doc.page.width - 236, 136, { width: 172, align: 'center' });
}

function bulletsSlide(doc, heading, bullets) {
  header(doc);
  gradientBackground(doc);
  doc.fill(THEME.text).fontSize(20).text(heading, 40, 60, { width: doc.page.width - 80 });
  doc.moveDown(0.5);
  doc.fontSize(12).fill(THEME.text);
  bullets.forEach((b) => {
    doc.circle(48, doc.y + 6, 2).fill(THEME.cyan).fillColor(THEME.text);
    doc.text(b, 60, doc.y - 8, { width: doc.page.width - 120 });
    doc.moveDown(0.5);
  });
  // right-side visual placeholder
  doc.roundedRect(doc.page.width - 240, 100, 180, 140, 8).strokeColor(THEME.gradStart).lineWidth(1).stroke();
}

function stepsSlide(doc, heading, steps) {
  header(doc);
  gradientBackground(doc);
  doc.fill(THEME.text).fontSize(20).text(heading, 40, 60, { width: doc.page.width - 80 });
  let y = 100;
  steps.forEach((s, i) => {
    doc.circle(48, y + 6, 8).fill(THEME.gradStart);
    doc.fill(THEME.white).fontSize(10).text(String(i + 1), 43, y + 1);
    doc.fill(THEME.text).fontSize(12).text(s, 68, y - 6, { width: doc.page.width - 120 });
    y += 44;
  });
  // flow visual
  doc.roundedRect(doc.page.width - 240, 100, 180, 140, 8).strokeColor(THEME.gradEnd).lineWidth(1).stroke();
  doc.fill(THEME.subtext).fontSize(9).text('Flowchart placeholder', doc.page.width - 236, 164, { width: 172, align: 'center' });
}

function timelineSlide(doc, heading, items) {
  header(doc);
  gradientBackground(doc);
  doc.fill(THEME.text).fontSize(20).text(heading, 40, 60);
  let x = 60; const y = 140;
  items.forEach((it, idx) => {
    if (idx > 0) {
      doc.strokeColor(THEME.subtext).moveTo(x - 40, y + 8).lineTo(x - 10, y + 8).stroke();
    }
    doc.circle(x, y + 8, 8).fill(THEME.gradStart);
    doc.fill(THEME.white).fontSize(10).text(String(idx + 1), x - 4, y + 3);
    doc.fill(THEME.text).fontSize(12).text(it, x - 40, y + 26, { width: 180 });
    x += 200;
  });
}

function tableSlide(doc, heading, table) {
  header(doc);
  gradientBackground(doc);
  doc.fill(THEME.text).fontSize(20).text(heading, 40, 60);
  const colX = [40, 180, 320, 460];
  // header
  doc.fill(THEME.subtext).fontSize(12);
  table.header.forEach((h, i) => doc.text(h, colX[i], 100, { width: 120 }));
  // rows
  let y = 130;
  doc.fill(THEME.text).fontSize(12);
  table.rows.forEach((r) => {
    r.forEach((cell, i) => doc.text(cell, colX[i], y, { width: 120 }));
    y += 24;
  });
}

function finalSlide(doc, heading, subtitle, footer, quote) {
  header(doc);
  gradientBackground(doc);
  doc.fill(THEME.text).fontSize(24).text(heading, 40, 80);
  doc.fill(THEME.subtext).fontSize(14).text(subtitle, 40, 120);
  doc.fill(THEME.text).fontSize(12).text(footer, 40, 150);
  doc.roundedRect(doc.page.width - 200, 80, 140, 140, 8).strokeColor(THEME.gradStart).lineWidth(1).stroke();
  doc.fill(THEME.subtext).fontSize(9).text('QR to grokmarkets.com', doc.page.width - 196, 146, { width: 132, align: 'center' });
  doc.moveDown(10);
  doc.fill(THEME.subtext).fontSize(11).text(`“${quote}” — GrokMarkets`, 40, doc.page.height - 100, { width: doc.page.width - 80, align: 'center' });
}

function run() {
  const outPath = path.join(process.cwd(), 'GrokMarkets_Pitch.pdf');
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 24, left: 24, right: 24, bottom: 24 } });
  doc.pipe(fs.createWriteStream(outPath));

  // Slide 1 — Title
  titleSlide(
    doc,
    'GrokMarkets: Predict the Future, Bet on Twitter, Win with Grok AI',
    'AI‑Powered Prediction Markets on Solana — Testnet Live Now',
    'grokmarkets.com  |  @grokmarketscom  |  Oct 2025'
  );
  doc.addPage();

  // Slide 2 — Problem
  bulletsSlide(doc, 'Prediction Markets Are Stuck in the Stone Age', [
    'Apps, wallets, clunky UIs — friction kills engagement.',
    'No seamless social integration from Twitter in seconds.',
    'Biased resolutions → disputes; crypto needs trustless, AI‑driven truth.',
    'Prediction markets grew 300% in 2024, but UX lags (Dune).'
  ]);
  doc.addPage();

  // Slide 3 — Our Solution
  bulletsSlide(doc, 'Tweet to Create, Bet to Win — Grok AI + Solana', [
    'Tag @solpredictbot to create, deposit SOL, or bet YES/NO instantly.',
    'No apps: unique deposit address per user; reply to bet.',
    'Grok AI auto‑resolves fairly with real‑time data; no human bias.'
  ]);
  doc.addPage();

  // Slide 4 — How It Works
  stepsSlide(doc, 'Seamless Twitter‑to‑Blockchain Flow', [
    'Tag @solpredictbot “create [question]” — market launches in seconds.',
    'Users reply “yes 0.1” or “no 0.5” — bets in SOL linked to handle.',
    'Deposit via bot‑generated address; 0.5% to the market creator.',
    'Ends in 1 day; Grok AI resolves; winners paid instantly on Solana.'
  ]);
  doc.addPage();

  // Slide 5 — Product Demo
  bulletsSlide(doc, 'Live Testnet in Action', [
    'Markets: Sports (NHL), Crypto (SOL price), more.',
    'Bet anywhere: mobile/desktop; QR for wallets.',
    'Early traction: 50+ test markets; free SOL bets on testnet.'
  ]);
  doc.addPage();

  // Slide 6 — Market Opportunity
  bulletsSlide(doc, '$10B Prediction Markets Boom on Solana', [
    'Global volume $68B in 2024 → $100B+ by 2027 (est.).',
    'Solana: 50k TPS for instant settlements; Twitter: 500M+ users.',
    'SocialFi + AI resolution = 10× engagement vs. site‑centric apps.'
  ]);
  doc.addPage();

  // Slide 7 — Traction & Milestones
  timelineSlide(doc, 'From Concept to Testnet Launch', [
    'Q3 2025: Built @solpredictbot; integrated Grok API for resolutions.',
    'Oct 2025: Testnet live — 100+ users tagging creates/bets; Solana dev partnerships.',
    'Q1 2026: Mainnet; 1K daily markets; $1M TVL target.'
  ]);
  doc.addPage();

  // Slide 8 — Business Model
  bulletsSlide(doc, 'Sustainable Revenue on Autopilot', [
    '1% platform fee on bets (0.5% to creators, 0.5% to treasury).',
    'Premium: custom durations, analytics ($5/mo).',
    'Tokenomics: future $GM governance/staking; airdrop to early bettors.'
  ]);
  doc.addPage();

  // Slide 9 — Competitive Edge (table)
  tableSlide(doc, 'Why GrokMarkets Wins', {
    header: ['Feature', 'GrokMarkets', 'Polymarket', 'Kalshi'],
    rows: [
      ['Twitter Creation', '✅ Instant', '❌ App‑only', '❌ Regulated UI'],
      ['AI Resolution', '✅ Grok', '❌ Manual', '❌ Oracles'],
      ['Solana Speed', '✅ 1s Payouts', '❌ Ethereum', '❌ Centralized'],
      ['Fee Structure', '1% Total', '2%', '5%+']
    ]
  });
  doc.addPage();

  // Slide 10 — Team
  bulletsSlide(doc, 'Builders Obsessed with AI + Crypto', [
    'Founder: @PANAGOT — Crypto since 2014; built bot in 2 weeks.',
    'AI Lead: Grok API specialist; xAI integrations.',
    'Blockchain: Solana contributor; 5+ dApps shipped.'
  ]);
  doc.addPage();

  // Slide 11 — The Ask
  bulletsSlide(doc, 'Join the Testnet — Help Shape the Future', [
    'Tag @solpredictbot to create markets, bet, and earn.',
    'Feedback drives mainnet; join Discord; follow @grokmarketscom.',
    'Early adopters: priority access, airdrops, creator rewards.'
  ]);
  doc.addPage();

  // Slide 12 — Thank You
  finalSlide(
    doc,
    'Let’s Predict — And Win — Together',
    'Contact: hello@grokmarkets.com  |  Demo: grokmarkets.com  |  Follow @solpredictbot',
    'Powered by Solana & Grok AI — Truth in Every Bet',
    "The future isn't predicted; it's bet on."
  );

  doc.end();
  console.log('✅ Created GrokMarkets_Pitch.pdf in project root.');
}

run();


