---
title: "SQL thiết yếu cho Backend"
summary: "SELECT, JOIN, GROUP BY, window function — kèm ví dụ chạy thật."
date: 2026-11-08
category: database
tags: [sql, join, window-functions]
type: article
series: backend-essentials
seriesOrder: 3
cover: content/covers/sql-essentials.svg
---

> [!NOTE]
> **Mục tiêu:** viết tự tin các truy vấn mà backend dùng hằng ngày. Các ô SQL trong bài chạy được ngay trên trình duyệt (SQLite), trên cơ sở dữ liệu bán hàng mẫu: `customers`, `products`, `orders`, `order_items`.

## 1. Thứ tự thực thi logic

Bạn **viết** câu lệnh theo thứ tự `SELECT … FROM … WHERE …`, nhưng database **thực thi** theo thứ tự:

```
FROM / JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```


![Thứ tự viết khác với thứ tự thực thi](content/diagrams/sql-execution-order.vi.svg "Thứ tự viết khác với thứ tự thực thi")

Hiểu thứ tự này sẽ giải thích vì sao bạn **không thể** dùng alias của `SELECT` trong `WHERE`, nhưng **dùng được** trong `ORDER BY`.

## 2. Lọc và sắp xếp

```sql-run
SELECT name, price
FROM products
WHERE price BETWEEN 30 AND 100
  AND category IN ('Accessories', 'Office')
ORDER BY price DESC
LIMIT 5;
```

- `LIKE 'abc%'` (bắt đầu bằng), `LIKE '%abc'` (kết thúc bằng).
- **NULL:** dùng `IS NULL`, không bao giờ dùng `= NULL`.

## 3. JOIN

```sql-run
-- INNER JOIN: chỉ giữ các dòng khớp ở cả hai bảng
SELECT o.id, c.name, o.status
FROM orders o
JOIN customers c ON c.id = o.customer_id;
```

```sql-run
-- LEFT JOIN: giữ mọi khách hàng, kể cả người chưa có đơn
SELECT c.name, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```


![Phần tô màu là các dòng được trả về](content/diagrams/sql-joins.vi.svg "Phần tô màu là các dòng được trả về")

> [!TIP]
> Mẫu **"tìm thứ không tồn tại"**: `LEFT JOIN … WHERE b.id IS NULL`.

## 4. Gom nhóm

```sql-run
SELECT o.customer_id,
       COUNT(*)                          AS orders,
       SUM(oi.quantity * oi.unit_price)  AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'        -- lọc DÒNG trước khi gom nhóm
GROUP BY o.customer_id
HAVING SUM(oi.quantity * oi.unit_price) > 300;  -- lọc NHÓM sau khi gom
```

Quy tắc: mọi cột trong `SELECT` phải nằm trong `GROUP BY` hoặc nằm trong một hàm tổng hợp (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`).

## 5. Subquery và CTE

CTE (`WITH`) giúp chia một truy vấn dài thành các bước có tên, dễ đọc hơn:

```sql-run
WITH order_totals AS (
  SELECT order_id, SUM(quantity * unit_price) AS total
  FROM order_items
  GROUP BY order_id
)
SELECT o.id, c.name, t.total
FROM order_totals t
JOIN orders o    ON o.id = t.order_id
JOIN customers c ON c.id = o.customer_id
WHERE t.total > (SELECT AVG(total) FROM order_totals);
```

## 6. Window function

Window function tính toán trên một nhóm dòng nhưng **không gộp** các dòng lại:

```sql-run
SELECT name, category, price,
       RANK() OVER (PARTITION BY category ORDER BY price DESC) AS rank_in_category,
       AVG(price) OVER (PARTITION BY category)                 AS avg_category_price
FROM products;
```

Ứng dụng thường gặp: xếp hạng, top-N mỗi nhóm, tổng lũy kế (`SUM(...) OVER (ORDER BY created_at)`), so với dòng trước (`LAG`).

## 7. Trong code backend: luôn dùng tham số

```python
# ❌ SQL injection: user_input = "1 OR 1=1"
cur.execute(f"SELECT * FROM orders WHERE customer_id = {user_input}")

# ✅ Parameterized query
cur.execute("SELECT * FROM orders WHERE customer_id = %s", (user_input,))
```

## Thử thêm

Ô dưới đây để trống phần lớn: thử tự viết truy vấn trả lời từng câu hỏi trong phần chú thích, rồi bấm **Chạy**.

```sql-run
-- 1) Khách hàng nào chưa từng đặt đơn?
-- 2) Doanh thu theo tháng (chỉ đơn 'paid' hoặc 'shipped')?
-- 3) Top 3 sản phẩm theo doanh thu, bỏ qua đơn 'cancelled'?
SELECT strftime('%Y-%m', o.created_at) AS month,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status IN ('paid', 'shipped')
GROUP BY month
ORDER BY month;
```
