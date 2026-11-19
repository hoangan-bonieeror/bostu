---
title: "Two Pointers và Sliding Window: hai mẫu giải hàng chục bài toán"
summary: "Hai kỹ thuật biến lời giải O(n²) thành O(n) trên mảng và chuỗi: con trỏ ngược chiều, con trỏ nhanh–chậm, cửa sổ cố định và cửa sổ co giãn, kèm code Python và cách nhận diện."
date: 2026-11-16
category: dsa
tags: [two-pointers, sliding-window, arrays, strings, python]
type: article
series: dsa-in-practice
seriesOrder: 2
---

> [!NOTE]
> Nhiều bài toán trên mảng và chuỗi có lời giải "ngây thơ" là thử mọi cặp hoặc mọi đoạn con, tốn `O(n²)`. Hai con trỏ và cửa sổ trượt tận dụng một tính chất của dữ liệu (đã sắp xếp, hoặc điều kiện có thể cập nhật dần) để chỉ duyệt mỗi phần tử một vài lần, còn `O(n)`.

## Two pointers ngược chiều

Đặt một con trỏ ở đầu, một con trỏ ở cuối, rồi di chuyển chúng về phía nhau. Kỹ thuật này thường dùng khi **mảng đã sắp xếp** hoặc bài toán có tính **đối xứng**.

### Tìm cặp có tổng bằng target trong mảng đã sắp xếp

```python
def pair_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        s = nums[left] + nums[right]
        if s == target:
            return left, right
        if s < target:
            left += 1       # cần tổng lớn hơn → tăng số nhỏ
        else:
            right -= 1      # cần tổng nhỏ hơn → giảm số lớn
    return None

pair_sum_sorted([1, 3, 4, 6, 8, 11], 10)   # (2, 3) vì 4 + 6 = 10
```

| Bước | left | right | Tổng | Hành động |
|---|---|---|---|---|
| 1 | 1 (chỉ số 0) | 11 (chỉ số 5) | 12 | lớn hơn 10 → `right -= 1` |
| 2 | 1 | 8 | 9 | nhỏ hơn 10 → `left += 1` |
| 3 | 3 | 8 | 11 | lớn hơn 10 → `right -= 1` |
| 4 | 3 | 6 | 9 | nhỏ hơn 10 → `left += 1` |
| 5 | 4 | 6 | 10 | ✅ tìm thấy |

Mỗi bước loại bỏ được một phần tử chắc chắn không thuộc đáp án, nên tổng số bước tối đa là `n`.

### Kiểm tra chuỗi đối xứng (palindrome)

```python
def is_palindrome(s):
    left, right = 0, len(s) - 1
    while left < right:
        while left < right and not s[left].isalnum():
            left += 1
        while left < right and not s[right].isalnum():
            right -= 1
        if s[left].lower() != s[right].lower():
            return False
        left += 1
        right -= 1
    return True

is_palindrome("A man, a plan, a canal: Panama")   # True
```

## Two pointers nhanh–chậm (cùng chiều)

Hai con trỏ cùng đi từ trái sang phải với tốc độ khác nhau. Con trỏ **nhanh** dò đường, con trỏ **chậm** đánh dấu vị trí ghi kết quả.

```python
def remove_duplicates(nums):
    """Xóa phần tử trùng trong mảng đã sắp xếp, tại chỗ, trả về độ dài mới."""
    if not nums:
        return 0
    slow = 0
    for fast in range(1, len(nums)):
        if nums[fast] != nums[slow]:
            slow += 1
            nums[slow] = nums[fast]
    return slow + 1

a = [1, 1, 2, 3, 3, 3, 4]
n = remove_duplicates(a)   # n = 4, a[:4] = [1, 2, 3, 4]
```

Biến thể nổi tiếng là thuật toán **Floyd** (rùa và thỏ) phát hiện chu trình trong danh sách liên kết: con trỏ nhanh đi hai bước, con trỏ chậm đi một bước; nếu có chu trình, hai con trỏ chắc chắn gặp nhau.

## Sliding window kích thước cố định

Cửa sổ là một đoạn liên tiếp `[left, right]`. Với kích thước cố định `k`, mỗi bước thêm một phần tử bên phải và bỏ một phần tử bên trái. Không cần tính lại toàn bộ cửa sổ.

```python
def max_sum_k(nums, k):
    window = sum(nums[:k])
    best = window
    for right in range(k, len(nums)):
        window += nums[right] - nums[right - k]   # thêm phải, bỏ trái: O(1)
        best = max(best, window)
    return best

max_sum_k([2, 1, 5, 1, 3, 2], 3)   # 9  (5 + 1 + 3)
```

## Sliding window co giãn

Khi kích thước không cố định, cửa sổ **mở rộng** bên phải cho đến khi vi phạm điều kiện, rồi **thu hẹp** bên trái cho đến khi hợp lệ trở lại.

![Minh họa cửa sổ trượt trên chuỗi "abcabcbb"](content/diagrams/sliding-window.vi.svg "Bài toán chuỗi con dài nhất không có ký tự lặp")

### Chuỗi con dài nhất không có ký tự lặp

```python
def longest_unique(s):
    last_seen = {}
    left = best = 0
    for right, ch in enumerate(s):
        if ch in last_seen and last_seen[ch] >= left:
            left = last_seen[ch] + 1       # nhảy qua ký tự bị trùng
        last_seen[ch] = right
        best = max(best, right - left + 1)
    return best

longest_unique("abcabcbb")   # 3 ("abc")
longest_unique("pwwkew")     # 3 ("wke")
```

### Đoạn con ngắn nhất có tổng ≥ target

```python
def min_subarray_len(target, nums):
    left = total = 0
    best = float("inf")
    for right, x in enumerate(nums):
        total += x
        while total >= target:             # hợp lệ → thử thu hẹp
            best = min(best, right - left + 1)
            total -= nums[left]
            left += 1
    return 0 if best == float("inf") else best

min_subarray_len(7, [2, 3, 1, 2, 4, 3])   # 2  ([4, 3])
```

Dù có vòng `while` lồng trong `for`, độ phức tạp vẫn là `O(n)`: `left` chỉ tiến về phía trước, tổng cộng không quá `n` lần.

## Khi nào dùng mẫu nào?

| Dấu hiệu trong đề bài | Mẫu nên thử |
|---|---|
| Mảng đã sắp xếp, tìm cặp/bộ ba có tổng cho trước | Two pointers ngược chiều |
| Đối xứng, đảo ngược, so khớp hai đầu | Two pointers ngược chiều |
| Xóa/gộp tại chỗ, không dùng thêm bộ nhớ | Nhanh–chậm |
| Chu trình trong danh sách liên kết, tìm điểm giữa | Nhanh–chậm (Floyd) |
| "Đoạn con / chuỗi con liên tiếp" có độ dài `k` | Cửa sổ cố định |
| "Dài nhất / ngắn nhất" đoạn liên tiếp thỏa điều kiện | Cửa sổ co giãn |

## Lỗi hay gặp

- **Quên điều kiện dừng `left < right`**, khiến hai con trỏ vượt qua nhau.
- **Dùng sliding window khi mảng có số âm** trong bài tổng ≥ target: thu hẹp cửa sổ không còn làm tổng giảm đơn điệu, nên mẫu không đúng nữa. Khi đó cần prefix sum kết hợp hash map hoặc deque.
- **Cập nhật kết quả sai thời điểm:** với cửa sổ co giãn, cần xác định rõ cập nhật trước hay sau khi thu hẹp.

## Tóm tắt

- Two pointers và sliding window đều giảm `O(n²)` xuống `O(n)` bằng cách không duyệt lại phần đã xét.
- Ngược chiều cho dữ liệu sắp xếp/đối xứng; nhanh–chậm cho xử lý tại chỗ và chu trình.
- Cửa sổ cố định cập nhật bằng "thêm phải, bỏ trái"; cửa sổ co giãn "mở rộng đến khi sai, thu hẹp đến khi đúng".
- Điều kiện để áp dụng là tính **đơn điệu**: di chuyển một con trỏ phải làm điều kiện thay đổi theo một chiều xác định.
