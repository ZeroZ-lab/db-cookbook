DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id integer PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  channel text NOT NULL,
  user_level text NOT NULL,
  registered_at timestamp NOT NULL
);

CREATE TABLE products (
  product_id integer PRIMARY KEY,
  product_name text NOT NULL,
  category text NOT NULL,
  list_price numeric(12, 2) NOT NULL CHECK (list_price >= 0)
);

CREATE TABLE orders (
  order_id integer PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(user_id),
  order_status text NOT NULL,
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
  created_at timestamp NOT NULL,
  paid_at timestamp
);

CREATE TABLE order_items (
  order_item_id integer PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(order_id),
  product_id integer NOT NULL REFERENCES products(product_id),
  quantity integer NOT NULL CHECK (quantity > 0),
  item_amount numeric(12, 2) NOT NULL CHECK (item_amount >= 0)
);

CREATE TABLE payments (
  payment_id integer PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(order_id),
  payment_status text NOT NULL,
  payment_method text NOT NULL,
  paid_amount numeric(12, 2) NOT NULL CHECK (paid_amount >= 0),
  paid_at timestamp NOT NULL
);

CREATE TABLE events (
  event_id integer PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(user_id),
  event_name text NOT NULL,
  product_id integer REFERENCES products(product_id),
  event_time timestamp NOT NULL
);

INSERT INTO users VALUES
  (1, 'Alice', 'alice@example.com', 'organic', 'silver', '2026-04-01 09:00:00'),
  (2, 'Bob', 'bob@example.com', 'ads', 'bronze', '2026-04-01 10:00:00'),
  (3, 'Carol', 'carol@example.com', 'organic', 'gold', '2026-04-02 11:00:00'),
  (4, 'David', 'david@example.com', 'partner', 'silver', '2026-04-03 12:00:00');

INSERT INTO products VALUES
  (101, 'Mechanical Keyboard', 'electronics', 399.00),
  (102, 'Noise Cancelling Headphones', 'electronics', 899.00),
  (103, 'SQL Handbook', 'books', 88.00),
  (104, 'Data Engineering Notebook', 'books', 39.00);

INSERT INTO orders VALUES
  (1001, 1, 'paid', 487.00, '2026-04-03 10:00:00', '2026-04-03 10:02:00'),
  (1002, 2, 'paid', 899.00, '2026-04-03 11:00:00', '2026-04-03 11:03:00'),
  (1003, 1, 'created', 39.00, '2026-04-04 09:00:00', NULL),
  (1004, 3, 'paid', 88.00, '2026-04-04 13:00:00', '2026-04-04 13:05:00'),
  (1005, 4, 'paid', 938.00, '2026-04-05 14:00:00', '2026-04-05 14:02:00');

INSERT INTO order_items VALUES
  (1, 1001, 101, 1, 399.00),
  (2, 1001, 103, 1, 88.00),
  (3, 1002, 102, 1, 899.00),
  (4, 1003, 104, 1, 39.00),
  (5, 1004, 103, 1, 88.00),
  (6, 1005, 102, 1, 899.00),
  (7, 1005, 104, 1, 39.00);

INSERT INTO payments VALUES
  (5001, 1001, 'success', 'card', 487.00, '2026-04-03 10:02:00'),
  (5002, 1002, 'success', 'wallet', 899.00, '2026-04-03 11:03:00'),
  (5003, 1004, 'success', 'card', 88.00, '2026-04-04 13:05:00'),
  (5004, 1005, 'success', 'wallet', 938.00, '2026-04-05 14:02:00');

INSERT INTO events VALUES
  (9001, 1, 'app_open', NULL, '2026-04-03 09:30:00'),
  (9002, 1, 'view_product', 101, '2026-04-03 09:35:00'),
  (9003, 1, 'purchase', 101, '2026-04-03 10:02:00'),
  (9004, 2, 'app_open', NULL, '2026-04-03 10:40:00'),
  (9005, 2, 'purchase', 102, '2026-04-03 11:03:00'),
  (9006, 3, 'app_open', NULL, '2026-04-04 12:30:00'),
  (9007, 3, 'purchase', 103, '2026-04-04 13:05:00'),
  (9008, 4, 'app_open', NULL, '2026-04-05 13:30:00'),
  (9009, 4, 'purchase', 102, '2026-04-05 14:02:00');

CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_events_time ON events(event_time);
