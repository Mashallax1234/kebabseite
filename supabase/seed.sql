-- =====================================================================
--  Platzhalter-Läden + Hallahsams Bewertungen (dieselben wie im Demo-Modus).
--  Alle Namen und Adressen sind ausgedacht.
--
--  Reihenfolge: schema.sql -> Hallahsam registriert sich auf der Seite ->
--  Hallahsam zum Admin machen (README) -> diese Datei ausführen.
--  Später einfach über die Admin-Seite ersetzen oder löschen.
-- =====================================================================

insert into public.shops (slug, name, address, district, lat, lng, maps_url, doener_price) values
  ('kapadokya-grill',     'Kapadokya Grill',       'Musterstraße 14, 12043 Berlin',     'Neukölln',        52.4768, 13.4390, 'https://www.google.com/maps/search/?api=1&query=52.4768,13.4390', 7.00),
  ('bosporus-grill',      'Bosporus Grill',        'Beispielstraße 3, 10999 Berlin',    'Kreuzberg',       52.4990, 13.4185, 'https://www.google.com/maps/search/?api=1&query=52.4990,13.4185', 7.50),
  ('mangal-haus',         'Mangal Haus',           'Musterallee 88, 10781 Berlin',      'Schöneberg',      52.4905, 13.3530, 'https://www.google.com/maps/search/?api=1&query=52.4905,13.3530', 8.00),
  ('sultan-doener',       'Sultan Döner',          'Platzhalterweg 21, 10245 Berlin',   'Friedrichshain',  52.5118, 13.4555, 'https://www.google.com/maps/search/?api=1&query=52.5118,13.4555', 7.00),
  ('anadolu-imbiss',      'Anadolu Imbiss',        'Beispielstraße 40, 12047 Berlin',   'Neukölln',        52.4842, 13.4310, 'https://www.google.com/maps/search/?api=1&query=52.4842,13.4310', 6.50),
  ('kebap-kral',          'Kebap Kral',            'Musterstraße 7, 13353 Berlin',      'Wedding',         52.5495, 13.3590, 'https://www.google.com/maps/search/?api=1&query=52.5495,13.3590', 6.00),
  ('pasa-doener',         'Paşa Döner',            'Musterplatz 2, 10437 Berlin',       'Prenzlauer Berg', 52.5395, 13.4225, 'https://www.google.com/maps/search/?api=1&query=52.5395,13.4225', 7.50),
  ('yildiz-kebap',        'Yıldız Kebap',          'Beispielweg 55, 10965 Berlin',      'Kreuzberg',       52.4935, 13.3955, 'https://www.google.com/maps/search/?api=1&query=52.4935,13.3955', 7.00),
  ('istanbul-grillhaus',  'Istanbul Grillhaus',    'Musterstraße 101, 10119 Berlin',    'Mitte',           52.5268, 13.4035, 'https://www.google.com/maps/search/?api=1&query=52.5268,13.4035', 8.50),
  ('ali-baba-kebab',      'Ali Baba Kebab',        'Platzhalterstraße 9, 10551 Berlin', 'Moabit',          52.5285, 13.3425, 'https://www.google.com/maps/search/?api=1&query=52.5285,13.3425', 6.00),
  ('efes-imbiss',         'Efes Imbiss',           'Beispielallee 12, 12101 Berlin',    'Tempelhof',       52.4705, 13.3855, 'https://www.google.com/maps/search/?api=1&query=52.4705,13.3855', 5.50),
  ('doener-ecke-bahnhof', 'Döner Ecke am Bahnhof', 'Bahnhofsplatz 1, 10317 Berlin',     'Lichtenberg',     52.5105, 13.4975, 'https://www.google.com/maps/search/?api=1&query=52.5105,13.4975', 5.00)
on conflict (slug) do nothing;

-- Hallahsams Bewertungen (werden nur angelegt, wenn es das Profil "Hallahsam" schon gibt)
insert into public.ratings (shop_id, user_id, scores, fazit, created_at)
select s.id, p.id, v.scores::jsonb, v.fazit, v.tested::timestamptz
from (values
  ('kapadokya-grill',     '{"preis": 8,   "auswahl": 8,   "sosse": 9.5, "fleisch": 9}',   'Aktuell meine Nummer 1. Fleisch saftig und nicht zu fettig, die Knoblauchsoße machen sie selbst. Das Brot kommt nochmal kurz auf den Grill. Einziger Haken: mittags steht die Schlange bis draußen.', '2025-11-08'),
  ('bosporus-grill',      '{"preis": 8,   "auswahl": 7,   "sosse": 9,   "fleisch": 9.5}', 'Bestes Fleisch, das ich hier gegessen hab. Die Auswahl ist eher klassisch, aber wer braucht schon zwölf Soßen.', '2025-06-21'),
  ('mangal-haus',         '{"preis": 6,   "auswahl": 9,   "sosse": 9,   "fleisch": 9}',   'Qualität ganz oben, Preis leider auch. Riesige Auswahl, sogar gegrilltes Gemüse im Brot.', '2026-02-14'),
  ('sultan-doener',       '{"preis": 7,   "auswahl": 8,   "sosse": 8.5, "fleisch": 8}',   'Solider Allrounder. Hier kann man nichts falsch machen, aber auch nicht vom Hocker fallen.', '2025-09-02'),
  ('anadolu-imbiss',      '{"preis": 9,   "auswahl": 6,   "sosse": 8,   "fleisch": 8.5}', 'Fairer Preis, ehrliche Portion, kein Schnickschnack. Der Chef erkennt einen nach dem dritten Mal.', '2025-04-17'),
  ('kebap-kral',          '{"preis": 9.5, "auswahl": 7,   "sosse": 7,   "fleisch": 7.5}', 'Günstigster guter Döner, den ich kenne. Nachts um drei der Retter.', '2025-03-01'),
  ('pasa-doener',         '{"preis": 7,   "auswahl": 7.5, "sosse": 8,   "fleisch": 7}',   'Ordentlich. Die Joghurtsoße ist schön dick und nicht so wässrig wie anderswo.', '2026-01-10'),
  ('yildiz-kebap',        '{"preis": 7.5, "auswahl": 6.5, "sosse": 7,   "fleisch": 8}',   'Fleisch gut gewürzt, der Rest unauffällig.', '2025-07-30'),
  ('istanbul-grillhaus',  '{"preis": 5,   "auswahl": 8,   "sosse": 7,   "fleisch": 8}',   'Für Mitte okay. Aber 8,50 € für einen ganz normalen Döner ist frech.', '2025-10-11'),
  ('ali-baba-kebab',      '{"preis": 8.5, "auswahl": 5,   "sosse": 6,   "fleisch": 6.5}', 'Geht klar, wenn man eh in der Nähe ist. Extra hinfahren muss man nicht.', '2025-05-24'),
  ('efes-imbiss',         '{"preis": 9,   "auswahl": 4,   "sosse": 5,   "fleisch": 5}',   'Billig, und das schmeckt man auch. Soße aus dem Eimer.', '2025-08-09'),
  ('doener-ecke-bahnhof', '{"preis": 9,   "auswahl": 3,   "sosse": 4,   "fleisch": 4.5}', 'Hat mich nicht überzeugt. Fleisch trocken, Salat welk. Aber hey: 5 Euro.', '2026-03-22')
) as v(slug, scores, fazit, tested)
join public.shops s on s.slug = v.slug
join public.profiles p on lower(p.username) = 'hallahsam'
on conflict (shop_id, user_id) do nothing;
