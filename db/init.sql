CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  sku         TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promotions (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  target_type   TEXT NOT NULL CHECK (target_type IN ('producto', 'categoria')),
  product_id    INTEGER REFERENCES products(id)   ON DELETE RESTRICT,
  category_id   INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('porcentaje', 'monto_fijo')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Programada'
                CHECK (status IN ('Programada', 'Activa', 'Finalizada')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT promotions_date_range_chk CHECK (end_date > start_date),

  CONSTRAINT promotions_percentage_range_chk CHECK (
    discount_type <> 'porcentaje' OR (discount_value >= 1 AND discount_value <= 100)
  ),

  CONSTRAINT promotions_target_xor_chk CHECK (
    (target_type = 'producto'  AND product_id IS NOT NULL AND category_id IS NULL) OR
    (target_type = 'categoria' AND category_id IS NOT NULL AND product_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS promotions_status_idx ON promotions (status);
CREATE INDEX IF NOT EXISTS promotions_dates_idx  ON promotions (start_date, end_date);

INSERT INTO categories (name) VALUES
  ('Bebidas'), ('Panaderia'), ('Lacteos'), ('Limpieza')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (name, sku, category_id) VALUES
  ('Cafe molido 500g', 'BEB-001', (SELECT id FROM categories WHERE name = 'Bebidas')),
  ('Gaseosa 2L',       'BEB-002', (SELECT id FROM categories WHERE name = 'Bebidas')),
  ('Pan frances',      'PAN-001', (SELECT id FROM categories WHERE name = 'Panaderia')),
  ('Leche entera 1L',  'LAC-001', (SELECT id FROM categories WHERE name = 'Lacteos')),
  ('Detergente 1kg',   'LIM-001', (SELECT id FROM categories WHERE name = 'Limpieza'))
ON CONFLICT (sku) DO NOTHING;
