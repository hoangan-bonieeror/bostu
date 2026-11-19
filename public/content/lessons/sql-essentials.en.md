# SQL essentials for backend devs

> [!NOTE]
> **Goal:** confidently write the queries backends run every day. Every example runs in the **SQL Lab** against the sample shop database: `customers`, `products`, `orders`, `order_items`.

## 1. Logical execution order

You **write** `SELECT … FROM … WHERE …`, but the database **evaluates** it in this order:

```
FROM / JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```


![The order you write is not the order it runs](content/diagrams/sql-execution-order.en.svg "The order you write is not the order it runs")

This order explains why you **can't** use a `SELECT` alias inside `WHERE`, but you **can** use it in `ORDER BY`.

## 2. Filtering and sorting

```sql
SELECT name, price
FROM products
WHERE price BETWEEN 30 AND 100
  AND category IN ('Accessories', 'Office')
ORDER BY price DESC
LIMIT 5;
```

- `LIKE 'abc%'` (starts with), `LIKE '%abc'` (ends with).
- **NULL:** use `IS NULL`, never `= NULL`.

## 3. JOINs

```sql
-- INNER JOIN: only rows that match on both sides
SELECT o.id, c.name, o.status
FROM orders o
JOIN customers c ON c.id = o.customer_id;

-- LEFT JOIN: every customer, even those with no orders
SELECT c.name, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```


![Shaded areas are the rows returned](content/diagrams/sql-joins.en.svg "Shaded areas are the rows returned")

> [!TIP]
> The **"find what's missing"** pattern: `LEFT JOIN … WHERE b.id IS NULL`.

## 4. Aggregation

```sql
SELECT o.customer_id,
       COUNT(*)                          AS orders,
       SUM(oi.quantity * oi.unit_price)  AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'        -- filters ROWS before grouping
GROUP BY o.customer_id
HAVING SUM(oi.quantity * oi.unit_price) > 300;  -- filters GROUPS after
```

Rule: every column in `SELECT` must be in `GROUP BY` or wrapped in an aggregate (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`).

## 5. Subqueries and CTEs

CTEs (`WITH`) break a long query into named, readable steps:

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

## 6. Window functions

Window functions compute across a set of rows **without collapsing** them:

```sql
SELECT name, category, price,
       RANK() OVER (PARTITION BY category ORDER BY price DESC) AS rank_in_category,
       AVG(price) OVER (PARTITION BY category)                 AS avg_category_price
FROM products;
```

Common uses: rankings, top-N per group, running totals (`SUM(...) OVER (ORDER BY created_at)`), and comparing with the previous row (`LAG`).

## 7. In backend code: always use parameters

```python
# ❌ SQL injection: user_input = "1 OR 1=1"
cur.execute(f"SELECT * FROM orders WHERE customer_id = {user_input}")

# ✅ Parameterized query
cur.execute("SELECT * FROM orders WHERE customer_id = %s", (user_input,))
```

## 🧪 Practice

This lesson comes with 10 SQL Lab exercises, from level 1 to level 3. Try each one yourself before peeking at the hint!
