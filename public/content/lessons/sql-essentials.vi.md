# SQL thiết yếu cho Backend

> [!NOTE]
> **Mục tiêu:** viết tự tin các truy vấn mà backend dùng hằng ngày. Mọi ví dụ đều chạy được trong **SQL Lab** trên cơ sở dữ liệu bán hàng mẫu: `customers`, `products`, `orders`, `order_items`.

## 1. Thứ tự thực thi logic

Bạn **viết** câu lệnh theo thứ tự `SELECT … FROM … WHERE …`, nhưng database **thực thi** theo thứ tự:

```
FROM / JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```


![Thứ tự viết khác với thứ tự thực thi](content/diagrams/sql-execution-order.vi.svg "Thứ tự viết khác với thứ tự thực thi")

Hiểu thứ tự này sẽ giải thích vì sao bạn **không thể** dùng alias của `SELECT` trong `WHERE`, nhưng **dùng được** trong `ORDER BY`.

## 2. Lọc và sắp xếp

```sql
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

```sql
-- INNER JOIN: chỉ giữ các dòng khớp ở cả hai bảng
SELECT o.id, c.name, o.status
FROM orders o
JOIN customers c ON c.id = o.customer_id;

-- LEFT JOIN: giữ mọi khách hàng, kể cả người chưa có đơn
SELECT c.name, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```


![Phần tô màu là các dòng được trả về](content/diagrams/sql-joins.vi.svg "Phần tô màu là các dòng được trả về")

> [!TIP]
> Mẫu **"tìm thứ không tồn tại"**: `LEFT JOIN … WHERE b.id IS NULL`.

## 4. Gom nhóm

```sql
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

```sql
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

```sql
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

## 🧪 Luyện tập

Bài học này có 10 bài tập trong SQL Lab, từ cấp 1 đến cấp 3. Hãy tự giải trước rồi mới xem gợi ý!
