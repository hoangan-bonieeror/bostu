---
title: "Big-O trong thực tế: đọc độ phức tạp từ code"
summary: "Big-O đo điều gì, các lớp độ phức tạp hay gặp, cách đọc độ phức tạp trực tiếp từ vòng lặp và đệ quy, chi phí thật của các thao tác trên list, set, dict trong Python."
date: 2026-11-13
category: dsa
tags: [big-o, complexity, python, algorithms]
type: article
series: dsa-in-practice
seriesOrder: 1
---

> [!NOTE]
> Big-O không đo thời gian chạy tính bằng giây. Nó mô tả **khối lượng công việc tăng nhanh đến đâu khi đầu vào lớn dần**. Đó là thứ quyết định một chương trình còn dùng được hay không khi dữ liệu tăng từ một nghìn lên một triệu bản ghi.

## Big-O đo điều gì

Big-O mô tả xu hướng tăng của số phép tính theo kích thước đầu vào `n`, thường xét trong trường hợp xấu nhất. Có ba quy tắc rút gọn:

- **Bỏ hằng số:** `3n + 5` được viết là `O(n)`.
- **Giữ số hạng lớn nhất:** `n² + n` được viết là `O(n²)`.
- **Các đầu vào khác nhau dùng biến khác nhau:** duyệt hai mảng độ dài `a` và `b` là `O(a + b)`, không phải `O(n)`.

![Đồ thị tăng trưởng của các lớp độ phức tạp](content/diagrams/bigo-growth.vi.svg "Với n nhỏ các đường gần nhau; khi n lớn, khoảng cách trở nên khổng lồ")

## Các lớp độ phức tạp hay gặp

| Big-O | Tên gọi | Ví dụ | n = 1.000 | n = 1.000.000 |
|---|---|---|---:|---:|
| `O(1)` | Hằng số | Lấy phần tử theo chỉ số, tra dict | 1 | 1 |
| `O(log n)` | Logarit | Binary search | ~10 | ~20 |
| `O(n)` | Tuyến tính | Duyệt mảng một lần | 1.000 | 1.000.000 |
| `O(n log n)` | Tuyến tính-logarit | Sắp xếp (merge sort, Timsort) | ~10.000 | ~20 triệu |
| `O(n²)` | Bậc hai | Hai vòng lặp lồng nhau | 1 triệu | 1.000 tỷ |
| `O(2ⁿ)` | Hàm mũ | Duyệt mọi tập con | rất lớn | không khả thi |

Cột cuối cho thấy vì sao Big-O quan trọng: với một triệu phần tử, `O(n log n)` khoảng 20 triệu phép tính (chạy trong chưa tới một giây), còn `O(n²)` lên tới 1.000 tỷ (mất hàng giờ).

## Đọc độ phức tạp từ code

**Một vòng lặp → `O(n)`**

```python
def total(nums):
    s = 0
    for x in nums:      # chạy n lần
        s += x          # O(1)
    return s            # tổng: O(n)
```

**Hai vòng lặp lồng nhau → `O(n²)`**

```python
def has_duplicate(nums):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):   # ~n²/2 cặp
            if nums[i] == nums[j]:
                return True
    return False
```

**Mỗi bước chia đôi → `O(log n)`**

```python
def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:                 # vùng tìm kiếm giảm một nửa mỗi vòng
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```

**Đệ quy:** đếm số lời gọi và công việc ở mỗi lời gọi. `fib(n) = fib(n-1) + fib(n-2)` không ghi nhớ kết quả tạo ra cây gọi với khoảng `2ⁿ` nút. Thêm ghi nhớ (`@functools.cache`) thì mỗi giá trị chỉ tính một lần, độ phức tạp còn `O(n)`.

## Chi phí thật của cấu trúc dữ liệu trong Python

| Thao tác | `list` | `set` / `dict` |
|---|---|---|
| Thêm vào cuối / thêm phần tử | `append`: `O(1)` trung bình | `add` / `d[k] = v`: `O(1)` trung bình |
| Chèn hoặc xóa ở đầu | `insert(0, x)`, `pop(0)`: **`O(n)`** | — |
| Kiểm tra tồn tại `x in ...` | **`O(n)`** | `O(1)` trung bình |
| Lấy theo chỉ số / khóa | `O(1)` | `O(1)` trung bình |
| Sắp xếp | `sorted`: `O(n log n)` | — |

> [!TIP]
> Cần thêm/xóa ở cả hai đầu thì dùng `collections.deque` (`O(1)` cho `appendleft`, `popleft`). Cần lấy liên tục phần tử nhỏ nhất thì dùng `heapq` (`O(log n)` mỗi lần).

## Phân tích khấu hao (amortized)

`list.append` thỉnh thoảng phải cấp phát vùng nhớ lớn hơn và chép toàn bộ phần tử sang, tốn `O(n)`. Tuy vậy, mỗi lần cấp phát, dung lượng tăng theo cấp số nhân, nên tổng chi phí của `n` lần append vẫn là `O(n)`. Chia đều ra, mỗi lần append tốn `O(1)` **khấu hao**.

## Độ phức tạp bộ nhớ

Big-O cũng áp dụng cho bộ nhớ. Tạo thêm một dict chứa `n` phần tử tốn `O(n)` bộ nhớ. Đệ quy sâu `n` tầng tốn `O(n)` bộ nhớ ngăn xếp; Python mặc định giới hạn khoảng 1.000 tầng, nên đệ quy quá sâu sẽ gây lỗi `RecursionError`.

## Ví dụ: từ `O(n²)` xuống `O(n)`

Bài toán: tìm hai số trong mảng có tổng bằng `target`.

```python
# O(n²): thử mọi cặp
def two_sum_slow(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return i, j

# O(n): đổi bộ nhớ lấy thời gian — nhớ các số đã gặp trong một dict
def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:          # tra dict: O(1)
            return seen[target - x], i
        seen[x] = i

two_sum([2, 7, 11, 15], 9)   # (0, 1)
```

Đây là kiểu đánh đổi rất phổ biến: dùng thêm `O(n)` bộ nhớ để giảm thời gian từ `O(n²)` xuống `O(n)`.

## Ước lượng nhanh theo kích thước đầu vào

Một máy tính thông thường thực hiện khoảng 10⁸ phép tính đơn giản mỗi giây (với Python thì ít hơn vài chục lần). Từ đó có thể đoán độ phức tạp chấp nhận được:

| Kích thước `n` | Độ phức tạp thường chấp nhận được |
|---|---|
| ≤ 20 | `O(2ⁿ)`, `O(n!)` (vét cạn, backtracking) |
| ≤ 10⁴ | `O(n²)` |
| ≤ 10⁶ | `O(n log n)` |
| ≤ 10⁸ | `O(n)` |
| lớn hơn | `O(log n)`, `O(1)` |

## Tóm tắt

- Big-O mô tả tốc độ tăng của chi phí khi đầu vào tăng: bỏ hằng số, giữ số hạng lớn nhất.
- Vòng lặp đơn là `O(n)`, lồng nhau là `O(n²)`, chia đôi mỗi bước là `O(log n)`.
- Chọn đúng cấu trúc dữ liệu thường là cách tối ưu rẻ nhất: `x in set` là `O(1)`, còn `x in list` là `O(n)`.
- Đổi bộ nhớ lấy thời gian là kỹ thuật cốt lõi, và là nền tảng của các mẫu ở bài tiếp theo trong series.
