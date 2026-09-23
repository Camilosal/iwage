const fs = require('fs');

process.chdir('/app');

async function main() {
  console.log('Loading Strapi...');
  
  const { createStrapi } = require('/app/node_modules/@strapi/strapi');
  const strapi = createStrapi({ distDir: '/app/dist' });
  
  await strapi.init();
  await strapi.server.mount();
  
  console.log('Strapi initialized\n');
  
  const products = JSON.parse(fs.readFileSync('/tmp/productos_clean.json', 'utf8'));
  console.log(`Found ${products.length} products to import\n`);
  
  let success = 0;
  let errors = 0;
  
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      const data = {
        nombre: p.nombre,
        slug: p.slug,
        descripcion: p.descripcion || '',
        publishedAt: '2026-07-28T19:37:24.640Z',
      };
      
      await strapi.entityService.create('api::producto.producto', { data });
      console.log(`✓ [${i+1}/${products.length}] ${p.nombre}`);
      success++;
    } catch (err) {
      console.error(`✗ [${i+1}/${products.length}] ${p.nombre}: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\nImport complete: ${success} successful, ${errors} errors`);
  
  await strapi.destroy();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
