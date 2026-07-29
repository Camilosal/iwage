-- Populate galeria audiovisual for proyectos meliponarios + set slugs
UPDATE proyecto_meliponarios SET
  slug = 'meliponario-ie-ambala',
  galeria = '[
    {"url":"/images/galeria/proyecto-ambala-1.webp","tipo":"imagen","titulo":"Colmenas educativas del sendero interpretativo"},
    {"url":"/images/galeria/proyecto-ambala-2.webp","tipo":"imagen","titulo":"Detalle de entrada de colmena INPA con propóleo"},
    {"url":"https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1200&q=70","tipo":"imagen","titulo":"Estudiantes en jornada de observación"},
    {"url":"https://www.youtube.com/watch?v=Vv1b4Vvq0fM","tipo":"video","titulo":"Meliponas nativas de Colombia"}
  ]'::jsonb
WHERE id = 2;

UPDATE proyecto_meliponarios SET
  slug = 'finca-el-carmen',
  galeria = '[
    {"url":"/images/galeria/proyecto-carmen-1.webp","tipo":"imagen","titulo":"Línea de colmenas en el lindero florido"},
    {"url":"/images/galeria/proyecto-carmen-2.webp","tipo":"imagen","titulo":"Cosecha de potes de miel (cerumen)"},
    {"url":"https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=70","tipo":"imagen","titulo":"Vista del cafetal con corredor biológico"}
  ]'::jsonb
WHERE id = 4;

UPDATE proyecto_meliponarios SET
  slug = 'ecohotel-la-cumbre',
  galeria = '[
    {"url":"/images/galeria/proyecto-cumbre-1.webp","tipo":"imagen","titulo":"Colmenas integradas al jardín del ecohotel"},
    {"url":"/images/galeria/proyecto-cumbre-2.webp","tipo":"imagen","titulo":"Señalética QR de trazabilidad por colmena"},
    {"url":"https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200&q=70","tipo":"imagen","titulo":"Terraza con vista al bosque de niebla"},
    {"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","tipo":"video","titulo":"Recorrido virtual por el meliponario"}
  ]'::jsonb
WHERE id = 6;

UPDATE proyecto_meliponarios SET
  slug = 'colegio-san-bonifacio',
  galeria = '[
    {"url":"/images/galeria/proyecto-bonifacio-1.webp","tipo":"imagen","titulo":"Clase abierta en el huerto escolar"},
    {"url":"/images/galeria/proyecto-ambala-1.webp","tipo":"imagen","titulo":"Colmenas pintadas por los estudiantes"},
    {"url":"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=70","tipo":"imagen","titulo":"Jornada PRAE con la comunidad"}
  ]'::jsonb
WHERE id = 8;

UPDATE proyecto_meliponarios SET
  slug = 'finca-la-esperanza',
  galeria = '[
    {"url":"/images/galeria/proyecto-esperanza-1.webp","tipo":"imagen","titulo":"Meliponario con monitoreo IoT y panel solar"},
    {"url":"/images/galeria/proyecto-carmen-2.webp","tipo":"imagen","titulo":"Revisión de sensores de temperatura y humedad"},
    {"url":"https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=1200&q=70","tipo":"imagen","titulo":"Amanecer en el cultivo de aguacate"}
  ]'::jsonb
WHERE id = 10;

UPDATE proyecto_meliponarios SET
  slug = 'jardin-residencial-el-poblado',
  galeria = '[
    {"url":"/images/galeria/proyecto-poblado-1.webp","tipo":"imagen","titulo":"Colmenas en el jardín residencial"},
    {"url":"https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=70","tipo":"imagen","titulo":"Corredor de polinizadores urbano"},
    {"url":"https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1200&q=70","tipo":"imagen","titulo":"Florecimiento de heliconias"}
  ]'::jsonb
WHERE id = 12;
