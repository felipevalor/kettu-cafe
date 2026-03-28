-- migrations/002_menu_and_users.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK(category IN ('cafe', 'pastry', 'brunch')),
  title TEXT NOT NULL,
  description TEXT,
  price TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed: migrate existing hardcoded items from index.html
INSERT INTO menu_items (category, title, description, price, image_url, sort_order) VALUES
  ('cafe',   'Flat White',        'Doble shot de espresso con leche texturizada artesanalmente.', '$3200', '/img/latte.jpg',    1),
  ('pastry', 'Croissant Clásico', 'Laminado a mano, 72hs de fermentación.',                      '$1800', '/img/flatt.jpg',    1),
  ('brunch', 'Avocado Toast',     'Pan de campo, palta fresca, tomates confitados y mix de semillas.', '$4500', '/img/tostadas.jpg', 1);
