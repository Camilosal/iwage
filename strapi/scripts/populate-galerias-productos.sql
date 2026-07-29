-- Populate slugs + galeria audiovisual for productos
UPDATE productos SET slug = 'miel-angelita-250ml', galeria = '[
  {"url":"/images/galeria/producto-miel-1.webp","tipo":"imagen","titulo":"Miel de angelita en frasco de vidrio"},
  {"url":"/images/galeria/producto-miel-2.webp","tipo":"imagen","titulo":"Proceso de cosecha y filtrado"},
  {"url":"https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1200&q=70","tipo":"imagen","titulo":"Panal y flores del meliponario"}
]'::jsonb WHERE id = 4;

UPDATE productos SET slug = 'miel-angelita-500ml', galeria = '[
  {"url":"/images/galeria/producto-miel-2.webp","tipo":"imagen","titulo":"Presentación 500ml"},
  {"url":"/images/galeria/producto-miel-1.webp","tipo":"imagen","titulo":"Miel dorada de meliponas"},
  {"url":"https://images.unsplash.com/photo-1471943311424-646960669fbc?w=1200&q=70","tipo":"imagen","titulo":"Cosecha artesanal"}
]'::jsonb WHERE id = 6;

UPDATE productos SET slug = 'miel-angelita-120ml', galeria = '[
  {"url":"/images/galeria/producto-miel-1.webp","tipo":"imagen","titulo":"Presentación viaje 120ml"},
  {"url":"https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1200&q=70","tipo":"imagen","titulo":"Detalle del empaque"}
]'::jsonb WHERE id = 8;

UPDATE productos SET slug = 'miel-con-propoleo-250ml', galeria = '[
  {"url":"/images/galeria/producto-miel-2.webp","tipo":"imagen","titulo":"Miel infusionada con propóleo"},
  {"url":"/images/galeria/proyecto-ambala-2.webp","tipo":"imagen","titulo":"Propóleo en la entrada de la colmena"}
]'::jsonb WHERE id = 10;

UPDATE productos SET slug = 'caja-inpa-nogal-cafetero', galeria = '[
  {"url":"/images/galeria/producto-caja-1.webp","tipo":"imagen","titulo":"Caja INPA en nogal cafetero"},
  {"url":"/images/galeria/proyecto-ambala-2.webp","tipo":"imagen","titulo":"Colmena INPA instalada y activa"},
  {"url":"https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=70","tipo":"imagen","titulo":"Madera certificada de reforestación"}
]'::jsonb WHERE id = 12;

UPDATE productos SET slug = 'caja-af-estandar', galeria = '[
  {"url":"/images/galeria/producto-caja-1.webp","tipo":"imagen","titulo":"Caja modelo AF estándar"},
  {"url":"https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?w=1200&q=70","tipo":"imagen","titulo":"Taller de carpintería"}
]'::jsonb WHERE id = 14;

UPDATE productos SET slug = 'caja-inpa-con-atril', galeria = '[
  {"url":"/images/galeria/producto-caja-1.webp","tipo":"imagen","titulo":"Caja INPA con atril ergonómico"},
  {"url":"/images/galeria/proyecto-ambala-1.webp","tipo":"imagen","titulo":"Colmena en atril para observación"}
]'::jsonb WHERE id = 16;

UPDATE productos SET slug = 'kit-inicio-meliponicultor', galeria = '[
  {"url":"/images/galeria/producto-caja-1.webp","tipo":"imagen","titulo":"Contenido del kit de inicio"},
  {"url":"/images/galeria/producto-miel-1.webp","tipo":"imagen","titulo":"Tu primera cosecha"},
  {"url":"/images/galeria/proyecto-carmen-1.webp","tipo":"imagen","titulo":"Meliponario montado con el kit"}
]'::jsonb WHERE id = 18;

UPDATE productos SET slug = 'kit-educativo-prae', galeria = '[
  {"url":"/images/galeria/proyecto-bonifacio-1.webp","tipo":"imagen","titulo":"Kit en uso escolar"},
  {"url":"/images/galeria/proyecto-ambala-1.webp","tipo":"imagen","titulo":"Sendero interpretativo PRAE"}
]'::jsonb WHERE id = 20;

UPDATE productos SET slug = 'kit-observacion', galeria = '[
  {"url":"/images/galeria/proyecto-ambala-2.webp","tipo":"imagen","titulo":"Colmena de observación activa"},
  {"url":"/images/galeria/proyecto-poblado-1.webp","tipo":"imagen","titulo":"Observación familiar"}
]'::jsonb WHERE id = 22;

UPDATE productos SET slug = 'asistencia-tecnica-mensual', galeria = '[
  {"url":"/images/galeria/proyecto-esperanza-1.webp","tipo":"imagen","titulo":"Visita técnica con monitoreo"},
  {"url":"/images/galeria/proyecto-carmen-2.webp","tipo":"imagen","titulo":"Revisión de colmenas en campo"}
]'::jsonb WHERE id = 24;
