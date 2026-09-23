const { readFileSync } = require('fs');

async function main() {
  // Use dynamic import for Strapi
  const strapiFactory = require('@strapi/strapi');
  const strapi = strapiFactory({ distDir: '/app/dist' });
  await strapi.init();
  await strapi.server.mount();

  console.log('Strapi initialized');

  // Read products
  const products = JSON.parse(readFileSync('/tmp/productos_clean.json', 'utf8'));
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
        descripcion_corta: p.descripcion_corta,
        categoria: p.categoria,
        estilo: p.estilo,
        espacio_recomendado: p.espacio_recomendado,
        precio_base: p.precio_base ? parseFloat(p.precio_base) : null,
        precio_oferta: p.precio_oferta ? parseFloat(p.precio_oferta) : null,
        moneda: p.moneda || 'COP',
        sku: p.sku,
        disponible: p.disponible ?? true,
        venta_online: p.venta_online ?? false,
        venta_tienda: p.venta_tienda ?? false,
        stock: p.stock,
        bajo_pedido: p.bajo_pedido ?? false,
        tiempo_fabricacion_dias: p.tiempo_fabricacion_dias,
        personalizable: p.personalizable ?? false,
        opciones_personalizacion: p.opciones_personalizacion,
        dimensiones: p.dimensiones,
        dimensiones_personalizables: p.dimensiones_personalizables ?? false,
        rango_dimensiones: p.rango_dimensiones,
        peso_kg: p.peso_kg ? parseFloat(p.peso_kg) : null,
        capacidad_carga_kg: p.capacidad_carga_kg ? parseFloat(p.capacidad_carga_kg) : null,
        materiales: p.materiales,
        acabados_disponibles: p.acabados_disponibles,
        destacado: p.destacado ?? false,
        nuevo: p.nuevo ?? false,
        orden: p.orden || 0,
        problema_que_resuelve: p.problema_que_resuelve,
        rutina_que_mejora: p.rutina_que_mejora,
        disenado_para: p.disenado_para,
        colecciones: p.colecciones,
        configurable: p.configurable ?? false,
        variaciones: p.variaciones,
        reglas_configurador: p.reglas_configurador,
        publishedAt: '2026-07-28T19:37:24.640Z',
      };
      
      await strapi.entityService.create('api::producto.producto', { data });
      console.log(`  ✓ [${i+1}/${products.length}] ${p.nombre}`);
      success++;
    } catch (err) {
      console.error(`  ✗ [${i+1}/${products.length}] ${p.nombre}: ${err.message}`);
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
