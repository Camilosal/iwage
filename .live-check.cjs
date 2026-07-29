const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const resp = await page.goto('https://iwage.co/cafe/menu', { waitUntil: 'networkidle2', timeout: 60000 });
  console.log('STATUS:', resp.status());
  const hdrs = resp.headers();
  console.log('CF-CACHE-STATUS:', hdrs['cf-cache-status'] || '(none)');
  console.log('X-CACHE-STATUS:', hdrs['x-cache-status'] || '(none)');
  console.log('CACHE-CONTROL:', hdrs['cache-control'] || '(none)');
  console.log('SERVER:', hdrs['server'] || '(none)');
  console.log('CSP:', (hdrs['content-security-policy'] || '(none)').slice(0, 120));

  await new Promise(r => setTimeout(r, 3000));

  const info = await page.evaluate(() => {
    const islands = Array.from(document.querySelectorAll('astro-island')).map(el => ({
      url: el.getAttribute('component-url'),
      hydrated: !!el.shadowRoot || el.children.length > 0,
    }));
    const quickAdd = document.querySelectorAll('.quick-add').length;
    return {
      url: location.href,
      islandCount: islands.length,
      islands,
      quickAdd,
      bodyLen: document.body.innerHTML.length,
    };
  });
  console.log('PAGE INFO:', JSON.stringify(info, null, 1));

  if (info.quickAdd > 0) {
    await page.evaluate(() => { document.querySelector('.quick-add').click(); });
    await new Promise(r => setTimeout(r, 1500));
    const after = await page.evaluate(() => {
      const fixedEls = Array.from(document.querySelectorAll('div')).filter(d => {
        const cs = getComputedStyle(d);
        return cs.position === 'fixed' && d.offsetHeight > 0 && d.innerText && d.innerText.includes('Pagar');
      }).map(d => d.innerText.slice(0, 60));
      let cartItems = [];
      try { cartItems = (JSON.parse(localStorage.getItem('iwage_cart_v1') || '{"items":[]}').items || []).map(i => i.nombre + ' x' + i.cantidad); } catch (e) {}
      return { payingBars: fixedEls, cartItems };
    });
    console.log('AFTER QUICK ADD:', JSON.stringify(after));
  }

  console.log('ERRORS:', errors.length ? JSON.stringify(errors, null, 1) : 'NONE');
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
