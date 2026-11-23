USE buses_comunitarios;

INSERT IGNORE INTO organizaciones (nombre, tipo, sector) VALUES
  ('Club Comunitario Los Aromos', 'Club comunitario', 'Padre Las Casas'),
  ('Agrupación Cultural Ruka Kimün', 'Agrupación cultural', 'Metrenco');

INSERT IGNORE INTO buses (nombre, patente, asientos) VALUES
  ('Bus comunitario 1', 'PLC-001', 36),
  ('Bus comunitario 2', 'PLC-002', 30);
