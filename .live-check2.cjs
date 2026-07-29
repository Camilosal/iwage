const puppeteer = require('puppeteer-core');

const URLS = [
  'https://iwage.co/cafe/menu',
  'https://www.iwage.co/cafe/menu',
  'https://cafe.iwage.co/menu',
  'https://cafe.iwage.co/cafe/menu',
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  for (const url of URLS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const h = resp.headers();
      const finalUrl = page.url();
      const title = await page.title().catch(() => '?');
      console.log(`\n=== ${url}`);
      console.log(`  status=${resp.status()} final=${finalUrl}`);
      console.log(`  title=${title.slice(0, 60)}`);
      console.log(`  server=${h['server'] || '?'} cf-cache=${h['cf-cache-status'] || '-'} x-cache=${h['x-cache-status'] || '-'} cc=${(h['cache-control'] || '-').slice(0, 50)}`);
      if (resp.status() === 200 && finalUrl.includes('menu')) {
        await new Promise(r => setTimeout(r, 2500));
        const info = await page.evaluate(() => ({
          islands: document.querySelectorAll('astro-island').length,
          quickAdd: document.querySelectorAll('.quick-add').length,
          hasPagar: document.body.innerText.includes('Pagar'),
          brand: document.documentElement.getAttribute('data-brand'),
        }));
        console.log(`  islands=${info.islands} quickAdd=${info.quickAdd} brand=${info.brand}`);
      }
    } catch (e) {
      console.log(`\n=== ${url}\n  FAILED: ${e.message.slice(0, 100)}`);
    }
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
