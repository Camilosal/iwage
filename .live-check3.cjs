const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  for (const url of ['https://cafe.iwage.co/', 'https://cafe.iwage.co/cafe/menu', 'https://iwage.co/', 'https://iwage.co/cafe/menu']) {
    const page = await browser.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const html = await page.content();
      console.log(`\n=== ${url} → ${resp.status()}`);
      console.log(`  title: ${(await page.title()).slice(0, 70)}`);
      console.log(`  data-brand: ${await page.evaluate(() => document.documentElement.getAttribute('data-brand'))}`);
      console.log(`  astro-islands: ${await page.evaluate(() => document.querySelectorAll('astro-island').length)}`);
      console.log(`  quick-add: ${await page.evaluate(() => document.querySelectorAll('.quick-add').length)}`);
      console.log(`  has UnifiedCart chunk ref: ${html.includes('UnifiedCart')}`);
      const navLinks = await page.evaluate(() => Array.from(document.querySelectorAll('nav a, header a')).map(a => a.getAttribute('href')).filter(Boolean).slice(0, 12));
      console.log(`  nav links: ${JSON.stringify(navLinks)}`);
      const h1 = await page.evaluate(() => (document.querySelector('h1') || {}).innerText || '(no h1)');
      console.log(`  h1: ${h1.slice(0, 60)}`);
    } catch (e) {
      console.log(`\n=== ${url}\n  FAILED: ${e.message.slice(0, 120)}`);
    }
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
