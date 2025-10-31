// Generates GrokMarkets 12-slide pitch deck as a .pptx (importable to Google Slides/Keynote)
// Usage: node scripts/create-pitch-deck.js

const PptxGenJS = require('pptxgenjs');

// Brand palette
const BRAND = {
  bgDark: '1B1F2A',
  bgLight: 'F7F9FC',
  primary: '5B8CFF',
  primaryDark: '3A6BFF',
  accent: '22D3EE',
  success: '34D399',
  warning: 'F59E0B',
  text: '0F172A',
  white: 'FFFFFF',
  gray: '64748B'
};

function defineMasters(pptx) {
  pptx.defineSlideMaster({
    title: 'MASTER_DARK',
    background: { color: BRAND.bgDark },
    objects: [
      { rect: { x: 0, y: 0, w: 10, h: 0.4, fill: { color: BRAND.primaryDark } } },
      { text: { text: 'GrokMarkets', options: { x: 0.4, y: 0.06, fontSize: 14, color: BRAND.white, bold: true } } },
      { text: { text: 'grokmarkets.com  |  @solpredictbot', options: { x: 6.0, y: 0.06, fontSize: 12, color: BRAND.accent, align: 'right', w: 3.5 } } }
    ]
  });
  pptx.defineSlideMaster({
    title: 'MASTER_LIGHT',
    background: { color: BRAND.bgLight },
    objects: [
      { rect: { x: 0, y: 0, w: 10, h: 0.4, fill: { color: BRAND.primary } } },
      { text: { text: 'GrokMarkets', options: { x: 0.4, y: 0.06, fontSize: 14, color: BRAND.white, bold: true } } },
      { text: { text: 'grokmarkets.com  |  @solpredictbot', options: { x: 6.0, y: 0.06, fontSize: 12, color: BRAND.white, align: 'right', w: 3.5 } } }
    ]
  });
}

function addTitleSlide(pptx, title, subtitle, footer) {
  const slide = pptx.addSlide({ masterName: 'MASTER_DARK' });
  slide.addText(title, { x: 0.7, y: 1.0, w: 8.6, h: 1.0, fontSize: 44, bold: true, color: BRAND.white });
  slide.addText(subtitle, { x: 0.7, y: 1.9, w: 8.6, h: 1.0, fontSize: 22, color: BRAND.gray });
  // Stronger hook tagline
  slide.addText('Turning tweets into tradable markets in seconds.', { x: 0.7, y: 2.5, w: 8.6, h: 0.6, fontSize: 20, color: BRAND.accent });
  slide.addShape(pptx.ShapeType.rect, { x: 0.7, y: 3.2, w: 5.5, h: 0.6, fill: { color: BRAND.primary }, line: { type: 'none' } });
  slide.addText('Tweet → Bet → Auto‑payout', { x: 0.9, y: 3.3, w: 5.1, h: 0.5, fontSize: 18, color: BRAND.white });
  if (footer) slide.addText(footer, { x: 0.7, y: 6.6, w: 8.6, h: 0.5, fontSize: 14, color: BRAND.gray });
}

function addBulletsSlide(pptx, title, bullets) {
  const slide = pptx.addSlide({ masterName: 'MASTER_LIGHT' });
  slide.addText(title, { x: 0.7, y: 0.7, w: 8.6, h: 0.8, fontSize: 32, bold: true, color: BRAND.text });
  const items = bullets.map((t) => ({ text: t }));
  slide.addText(items, { x: 0.9, y: 1.7, w: 8.2, h: 4.8, fontSize: 20, bullet: true, lineSpacingMultiple: 1.2, color: BRAND.text });
}

function addViralEngineSlide(pptx) {
  const slide = pptx.addSlide({ masterName: 'MASTER_LIGHT' });
  slide.addText('The Viral Engine', { x: 0.7, y: 0.7, w: 8.6, h: 0.8, fontSize: 32, bold: true, color: BRAND.text });
  slide.addText('Markets spread 100% organically through Twitter replies and retweets.', { x: 0.7, y: 1.4, w: 8.6, h: 0.5, fontSize: 16, color: BRAND.gray });
  // Loop nodes
  const nodes = [
    { label: 'Tweet', x: 1.0, y: 2.2 },
    { label: 'Retweet', x: 3.3, y: 1.4 },
    { label: 'Replies', x: 6.0, y: 2.2 },
    { label: 'New Wallets', x: 6.0, y: 4.0 },
    { label: 'Payouts', x: 3.3, y: 4.8 },
    { label: 'Tweet Again', x: 1.0, y: 4.0 }
  ];
  nodes.forEach(n => {
    slide.addShape(pptx.ShapeType.ellipse, { x: n.x, y: n.y, w: 2.0, h: 0.9, fill: { color: BRAND.white }, line: { color: BRAND.primary } });
    slide.addText(n.label, { x: n.x, y: n.y + 0.28, w: 2.0, h: 0.4, fontSize: 16, align: 'center', color: BRAND.text });
  });
  // Arrows (simple text arrows for compatibility)
  const arrows = [
    { text: '→', x: 2.6, y: 2.55 }, // Tweet -> Retweet
    { text: '↘', x: 4.9, y: 2.0 },  // Retweet -> Replies
    { text: '↓', x: 7.0, y: 3.2 },  // Replies -> New Wallets
    { text: '←', x: 5.2, y: 4.45 }, // New Wallets -> Payouts
    { text: '↖', x: 2.6, y: 4.45 }, // Payouts -> Tweet Again
    { text: '↑', x: 1.9, y: 3.3 }   // Tweet Again -> Tweet
  ];
  arrows.forEach(a => slide.addText(a.text, { x: a.x, y: a.y, w: 0.5, h: 0.5, fontSize: 24, color: BRAND.gray }));
}

function addSectionSlide(pptx, title, subtitle) {
  const slide = pptx.addSlide({ masterName: 'MASTER_DARK' });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.4, w: 10, h: 6.6, fill: { color: BRAND.bgDark }, line: { type: 'none' } });
  slide.addText(title, { x: 0.7, y: 2.2, w: 8.6, h: 1.0, fontSize: 40, bold: true, color: BRAND.white });
  if (subtitle) slide.addText(subtitle, { x: 0.7, y: 3.2, w: 8.6, h: 0.8, fontSize: 22, color: BRAND.accent });
}

function addKpiSlide(pptx, title, kpis) {
  const slide = pptx.addSlide({ masterName: 'MASTER_LIGHT' });
  slide.addText(title, { x: 0.7, y: 0.7, w: 8.6, h: 0.8, fontSize: 32, bold: true, color: BRAND.text });
  const tileW = 2.6; const tileH = 1.6; const startX = 0.7; const startY = 1.8; const gap = 0.4;
  kpis.slice(0, 3).forEach((kpi, i) => {
    const x = startX + i * (tileW + gap);
    slide.addShape(pptx.ShapeType.roundRect, { x, y: startY, w: tileW, h: tileH, fill: { color: BRAND.white }, line: { color: BRAND.primary } });
    slide.addText(kpi.value, { x: x + 0.2, y: startY + 0.25, w: tileW - 0.4, h: 0.6, fontSize: 28, bold: true, color: BRAND.primaryDark, align: 'center' });
    slide.addText(kpi.label, { x: x + 0.2, y: startY + 0.95, w: tileW - 0.4, h: 0.5, fontSize: 14, color: BRAND.gray, align: 'center' });
  });
  // Quotes box
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 3.8, w: 8.6, h: 2.2, fill: { color: 'FFFFFF' }, line: { color: BRAND.gray } });
  slide.addText('“Fast and simple.” — @solanadegen\n“Polymarket energy, Twitter‑native.” — @cryptobuilder', { x: 1.0, y: 4.0, w: 8.0, h: 1.8, fontSize: 18, color: BRAND.text });
  // Screenshot placeholder strip
  slide.addShape(pptx.ShapeType.rect, { x: 0.7, y: 6.1, w: 4.1, h: 2.3, fill: { color: BRAND.white }, line: { color: BRAND.gray } });
  slide.addText('Add tweet screenshot here', { x: 0.7, y: 7.05, w: 4.1, h: 0.5, fontSize: 12, color: BRAND.gray, align: 'center' });
  slide.addShape(pptx.ShapeType.rect, { x: 5.2, y: 6.1, w: 4.1, h: 2.3, fill: { color: BRAND.white }, line: { color: BRAND.gray } });
  slide.addText('Add bot reply screenshot here', { x: 5.2, y: 7.05, w: 4.1, h: 0.5, fontSize: 12, color: BRAND.gray, align: 'center' });
}

function addCompetitiveGrid(pptx) {
  const slide = pptx.addSlide({ masterName: 'MASTER_LIGHT' });
  slide.addText('Competitive Landscape', { x: 0.7, y: 0.7, w: 8.6, h: 0.8, fontSize: 32, bold: true, color: BRAND.text });
  // Axes
  slide.addShape(pptx.ShapeType.line, { x: 1.5, y: 1.9, w: 0, h: 4.5, line: { color: BRAND.gray, width: 1.5 } });
  slide.addShape(pptx.ShapeType.line, { x: 1.5, y: 6.4, w: 7.5, h: 0, line: { color: BRAND.gray, width: 1.5 } });
  slide.addText('AI‑resolved', { x: 0.7, y: 1.6, w: 0.8, h: 0.4, fontSize: 12, color: BRAND.gray, align: 'right' });
  slide.addText('Manual', { x: 0.7, y: 6.4, w: 0.8, h: 0.4, fontSize: 12, color: BRAND.gray, align: 'right' });
  slide.addText('Site‑centric', { x: 1.5, y: 6.6, w: 7.5, h: 0.4, fontSize: 12, color: BRAND.gray });
  slide.addText('Social‑native', { x: 8.0, y: 6.6, w: 1.0, h: 0.4, fontSize: 12, color: BRAND.gray, align: 'right' });
  // Competitors
  const badge = (label, x, y, color, w = 2.2) => {
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.7, fill: { color }, line: { type: 'none' } });
    slide.addText(label, { x, y: y + 0.12, w, h: 0.5, fontSize: 16, color: BRAND.white, align: 'center', bold: true });
  };
  badge('Polymarket', 2.0, 5.5, BRAND.gray, 2.2);
  badge('Manifold', 2.1, 3.0, BRAND.gray, 2.0);
  // Enlarge GrokMarkets bubble for dominance
  badge('GrokMarkets', 6.0, 2.0, BRAND.primaryDark, 3.0);
  slide.addText('The only AI‑resolved, Twitter‑native market protocol.', { x: 0.7, y: 7.0, w: 8.6, h: 0.5, fontSize: 14, color: BRAND.text });
}

function addInteractionSlide(pptx) {
  const slide = pptx.addSlide({ masterName: 'MASTER_LIGHT' });
  slide.addText('Twitter Interaction Walkthrough', { x: 0.7, y: 0.7, w: 8.6, h: 0.8, fontSize: 32, bold: true, color: BRAND.text });
  slide.addText('From tweet → market creation → AI resolution → payout', { x: 0.7, y: 1.4, w: 8.6, h: 0.5, fontSize: 16, color: BRAND.gray });
  // Chat-like cards
  const card = (title, body, x, y, color) => {
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 8.6, h: 1.4, fill: { color: BRAND.white }, line: { color: color || BRAND.primary } });
    slide.addText(title, { x: x + 0.2, y: y + 0.15, w: 8.2, h: 0.4, fontSize: 14, color: BRAND.gray });
    slide.addText(body, { x: x + 0.2, y: y + 0.55, w: 8.2, h: 0.7, fontSize: 18, color: BRAND.text });
  };
  card('User tweet', '@solpredictbot create "Will Solana reach $250 in 2025?"', 0.7, 2.0, BRAND.primary);
  card('Bot reply (threaded when permitted)', '🎯 Market created! "Will Solana reach $250 in 2025?"\nMarket ID: GM-ABC123\nReply: yes [amount] or no [amount]\nLink: grokmarkets.com/market/GM-ABC123', 0.7, 3.6, BRAND.success);
  card('Fallback (if reply is restricted)', 'Posts standalone tweet + quote of original for visibility; backend updated with tweet ID.', 0.7, 5.2, BRAND.warning);
  card('Resolution', 'At end time, Grok AI evaluates the outcome; payouts sent instantly on Solana.', 0.7, 6.8, BRAND.accent);
  slide.addText('Notes: Flow mirrors bot logic in code — create detection, reply/quote fallback on 403, Grok API fallback for non-price markets, instant payout.', { x: 0.7, y: 8.4, w: 8.6, h: 0.5, fontSize: 12, color: BRAND.gray });
}

function addOutroSlide(pptx) {
  const slide = pptx.addSlide({ masterName: 'MASTER_DARK' });
  slide.addText('Thank you!', { x: 0.7, y: 2.0, w: 8.6, h: 1.0, fontSize: 44, bold: true, color: BRAND.white });
  slide.addText('Try it now: tweet @solpredictbot create …', { x: 0.7, y: 3.0, w: 8.6, h: 0.8, fontSize: 22, color: BRAND.accent });
  slide.addText('Visit: grokmarkets.com', { x: 0.7, y: 3.7, w: 8.6, h: 0.6, fontSize: 18, color: BRAND.gray });
  // QR placeholder
  slide.addShape(pptx.ShapeType.rect, { x: 7.6, y: 2.2, w: 1.7, h: 1.7, fill: { color: BRAND.white }, line: { color: BRAND.gray } });
  slide.addText('QR', { x: 7.6, y: 2.85, w: 1.7, h: 0.5, fontSize: 18, color: BRAND.gray, align: 'center' });
}

function createDeck() {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  defineMasters(pptx);

  // Slide 1 — Title / Intro
  addTitleSlide(
    pptx,
    'GrokMarkets',
    'Create, bet, and resolve markets — directly from a tweet',
    '@solpredictbot  |  grokmarkets.com  |  Tweet → Bet → Auto‑payout'
  );

  // Slide 2 — Why We Started (Problem)
  addBulletsSlide(pptx, 'Why We Started — The Problem', [
    'Twitter behaves like a market; we add price discovery and payout.',
    'No pricing, no resolution, no payout in today\'s social predictions.',
    'Example: “Will BTC close above $70K tonight?” → becomes a real market.'
  ]);

  // Slide 3 — The Solution
  addBulletsSlide(pptx, 'The Solution — Tweet → Bet → AI Resolves', [
    'Tweet: @solpredictbot create "Will BTC close above $70K tonight?"',
    'Reply to bet: "yes 2" or "no 2" (in SOL)',
    'AI evaluates outcome at end time; instant payouts on Solana',
    'Unique Market ID + link at grokmarkets.com'
  ]);

  // Slide 4 — The Viral Engine (visual loop)
  addViralEngineSlide(pptx);

  // Slide 5 — Twitter Interaction Walkthrough
  addInteractionSlide(pptx);

  // Slide 6 — Market & Opportunity
  addBulletsSlide(pptx, 'Market & Opportunity', [
    'TAM: > $500B (sports betting + retail trading)',
    'SAM: $2–5B (crypto prediction markets)',
    'SOM: $50–100M (social‑native PMs)',
    'Beachhead: Solana users + sports/crypto creators'
  ]);

  // Slide 7 — Traction & Feedback (visual KPIs + screenshots)
  addKpiSlide(pptx, 'Traction & Feedback', [
    { value: '16', label: 'Markets Created' },
    { value: '35%', label: 'Repeat Creators' },
    { value: '~12s', label: 'Median Latency' }
  ]);

  // Slide 8 — Vision (add emotion line)
  addBulletsSlide(pptx, 'Vision & Milestones', [
    'North Star: Turn every news moment into a tradable market',
    'Our goal: every major conversation online has a live, tradable market',
    '3 months: 100 active markets',
    '6 months: Creator dashboards, Discord/TG bots',
    '12 months: 10K markets, fiat ramps, sponsored markets'
  ]);

  // Slide 9 — Team
  addBulletsSlide(pptx, 'Team', [
    'Ex‑crypto exchange • ML infrastructure • Full‑stack fintech',
    'Shipped bots at scale • Built on Solana',
    'Superpower: distribution + market design + shipping speed'
  ]);

  // Slide 10 — Competitive Landscape (2×2 with larger Grok bubble)
  addCompetitiveGrid(pptx);

  // Slide 11 — Business Model
  addBulletsSlide(pptx, 'Business Model', [
    'Protocol fee on volume + 0.5% creator fee',
    'Premium: creator tools, branded markets',
    'Future: sponsored markets, partner APIs'
  ]);

  // Slide 12 — Go‑To‑Market
  addBulletsSlide(pptx, 'Go‑To‑Market', [
    'Creators: weekly slates with sports/crypto influencers',
    'Communities: Discord/TG integrations, leaderboards, streaks',
    'Moments: live events, trending hashtags; the feed is the funnel'
  ]);

  // Slide 13 — Validation (add screenshots)
  const validation = pptx.addSlide({ masterName: 'MASTER_LIGHT' });
  validation.addText('Validation & Readiness', { x: 0.7, y: 0.7, w: 8.6, h: 0.8, fontSize: 32, bold: true, color: BRAND.text });
  validation.addText('Live markets + payout confirmations | KPIs: markets, users, retention, reply success rate', { x: 0.7, y: 1.5, w: 8.6, h: 0.5, fontSize: 16, color: BRAND.gray });
  // Placeholders to avoid file dependency
  validation.addShape(pptx.ShapeType.rect, { x: 0.7, y: 2.2, w: 4.1, h: 2.6, fill: { color: BRAND.white }, line: { color: BRAND.gray } });
  validation.addText('Add payout confirmation screenshot', { x: 0.7, y: 3.35, w: 4.1, h: 0.5, fontSize: 12, color: BRAND.gray, align: 'center' });
  validation.addShape(pptx.ShapeType.rect, { x: 5.2, y: 2.2, w: 4.1, h: 2.6, fill: { color: BRAND.white }, line: { color: BRAND.gray } });
  validation.addText('Add market thread screenshot', { x: 5.2, y: 3.35, w: 4.1, h: 0.5, fontSize: 12, color: BRAND.gray, align: 'center' });
  validation.addText('99.9% API uptime • <1s backend latency • instant payouts', { x: 0.7, y: 5.1, w: 8.6, h: 0.5, fontSize: 16, color: BRAND.text });

  // Slide 14 — Outro with CTA & QR placeholder
  addOutroSlide(pptx);

  const filename = 'GrokMarkets_Pitch.pptx';
  pptx.writeFile({ fileName: filename }).then(() => {
    console.log(`✅ Created ${filename} in project root. Import into Google Slides or Keynote.`);
  });
}

createDeck();


