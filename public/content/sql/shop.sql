-- E-commerce demo database (SQLite)
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('pending','paid','shipped','cancelled')),
  created_at TEXT NOT NULL
);
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL
);
INSERT INTO customers VALUES
 (1,'Nguyen Van An','an.nguyen@gmail.com','Ho Chi Minh City','2025-01-15'),
 (2,'Tran Thi Binh','binh.tran@yahoo.com','Hanoi','2025-02-03'),
 (3,'Le Minh Chau','chau.le@gmail.com','Da Nang','2025-03-21'),
 (4,'Pham Quoc Dung','dung.pham@outlook.com','Hanoi','2025-05-10'),
 (5,'Emily Carter','emily.carter@gmail.com','Seattle','2025-06-01'),
 (6,'James Wilson','jwilson@company.io','San Francisco','2025-07-19'),
 (7,'Hoang Thu Ha','ha.hoang@gmail.com','Ho Chi Minh City','2025-08-30'),
 (8,'Sophia Martinez','sophia.m@outlook.com','Seattle','2025-09-12');
INSERT INTO products VALUES
 (1,'Mechanical Keyboard','Accessories',89.00,25),
 (2,'Wireless Mouse','Accessories',29.50,60),
 (3,'27-inch 4K Monitor','Displays',329.00,12),
 (4,'USB-C Hub','Accessories',45.00,40),
 (5,'Laptop Stand','Accessories',39.90,30),
 (6,'Noise-Cancelling Headphones','Audio',199.00,18),
 (7,'Webcam 1080p','Video',59.00,22),
 (8,'Portable SSD 1TB','Storage',119.00,35),
 (9,'LED Desk Lamp','Office',34.00,50),
 (10,'Ergonomic Chair','Office',289.00,8);
INSERT INTO orders VALUES
 (1,1,'shipped','2026-08-02'),
 (2,2,'paid','2026-08-15'),
 (3,1,'paid','2026-09-01'),
 (4,3,'shipped','2026-09-05'),
 (5,5,'cancelled','2026-09-12'),
 (6,6,'shipped','2026-09-20'),
 (7,2,'shipped','2026-10-03'),
 (8,7,'pending','2026-10-08'),
 (9,5,'paid','2026-10-15'),
 (10,1,'shipped','2026-10-22'),
 (11,6,'paid','2026-11-02'),
 (12,3,'pending','2026-11-10');
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
 (1,1,1,89.00),(1,2,2,29.50),
 (2,3,1,329.00),
 (3,8,2,119.00),(3,4,1,45.00),
 (4,6,1,199.00),
 (5,10,1,289.00),(5,9,1,34.00),
 (6,3,2,329.00),(6,7,1,59.00),
 (7,5,1,39.90),(7,9,2,34.00),
 (8,2,1,29.50),
 (9,6,1,199.00),(9,8,1,119.00),
 (10,10,1,289.00),
 (11,1,1,89.00),(11,4,2,45.00),(11,2,1,29.50),
 (12,7,1,59.00);
