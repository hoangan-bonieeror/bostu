---
title: "Two Pointers and Sliding Window: two patterns behind dozens of problems"
summary: "Two techniques that turn O(n²) array and string solutions into O(n): converging pointers, fast–slow pointers, fixed windows and variable windows — with Python code and how to recognize them."
date: 2026-11-16
category: dsa
tags: [two-pointers, sliding-window, arrays, strings, python]
type: article
series: dsa-in-practice
seriesOrder: 2
---

> [!NOTE]
> Many array and string problems have a naive solution that tries every pair or every subarray, costing `O(n²)`. Two pointers and sliding windows exploit a property of the data (sorted order, or a condition that can be updated incrementally) to visit each element only a few times — `O(n)`.

## Converging two pointers

Put one pointer at the start, one at the end, and move them toward each other. This is typical when the **array is sorted** or the problem is **symmetric**.

### Pair with a target sum in a sorted array

```python
def pair_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        s = nums[left] + nums[right]
        if s == target:
            return left, right
        if s < target:
            left += 1       # need a bigger sum → raise the small number
        else:
            right -= 1      # need a smaller sum → lower the big number
    return None

pair_sum_sorted([1, 3, 4, 6, 8, 11], 10)   # (2, 3) because 4 + 6 = 10
```

| Step | left | right | Sum | Action |
|---|---|---|---|---|
| 1 | 1 (index 0) | 11 (index 5) | 12 | > 10 → `right -= 1` |
| 2 | 1 | 8 | 9 | < 10 → `left += 1` |
| 3 | 3 | 8 | 11 | > 10 → `right -= 1` |
| 4 | 3 | 6 | 9 | < 10 → `left += 1` |
| 5 | 4 | 6 | 10 | ✅ found |

Every step rules out one element that cannot be part of the answer, so there are at most `n` steps.

### Palindrome check

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

## Fast–slow pointers (same direction)

Both pointers move left to right at different speeds. The **fast** pointer explores; the **slow** pointer marks where to write the result.

```python
def remove_duplicates(nums):
    """Remove duplicates from a sorted array in place; return the new length."""
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

A famous variant is **Floyd's** tortoise-and-hare cycle detection in linked lists: the fast pointer moves two steps, the slow pointer one; if there is a cycle, they are guaranteed to meet.

## Fixed-size sliding window

A window is a contiguous range `[left, right]`. With a fixed size `k`, each step adds one element on the right and drops one on the left — no need to recompute the whole window.

```python
def max_sum_k(nums, k):
    window = sum(nums[:k])
    best = window
    for right in range(k, len(nums)):
        window += nums[right] - nums[right - k]   # add right, drop left: O(1)
        best = max(best, window)
    return best

max_sum_k([2, 1, 5, 1, 3, 2], 3)   # 9  (5 + 1 + 3)
```

## Variable-size sliding window

When the size isn't fixed, the window **expands** on the right until a condition breaks, then **shrinks** from the left until it holds again.

![A sliding window over "abcabcbb"](content/diagrams/sliding-window.en.svg "Longest substring without repeating characters")

### Longest substring without repeating characters

```python
def longest_unique(s):
    last_seen = {}
    left = best = 0
    for right, ch in enumerate(s):
        if ch in last_seen and last_seen[ch] >= left:
            left = last_seen[ch] + 1       # jump past the duplicate
        last_seen[ch] = right
        best = max(best, right - left + 1)
    return best

longest_unique("abcabcbb")   # 3 ("abc")
longest_unique("pwwkew")     # 3 ("wke")
```

### Shortest subarray with sum ≥ target

```python
def min_subarray_len(target, nums):
    left = total = 0
    best = float("inf")
    for right, x in enumerate(nums):
        total += x
        while total >= target:             # valid → try to shrink
            best = min(best, right - left + 1)
            total -= nums[left]
            left += 1
    return 0 if best == float("inf") else best

min_subarray_len(7, [2, 3, 1, 2, 4, 3])   # 2  ([4, 3])
```

Despite the `while` nested in the `for`, this is still `O(n)`: `left` only moves forward, at most `n` times in total.

## Which pattern when?

| Clue in the problem | Pattern to try |
|---|---|
| Sorted array, find a pair/triplet with a given sum | Converging pointers |
| Symmetry, reversal, matching both ends | Converging pointers |
| Remove/merge in place, no extra memory | Fast–slow |
| Cycle in a linked list, find the middle | Fast–slow (Floyd) |
| "Contiguous subarray/substring" of length `k` | Fixed window |
| "Longest / shortest" contiguous range satisfying a condition | Variable window |

## Common bugs

- **Forgetting the `left < right` stop condition**, letting the pointers cross.
- **Using a sliding window when the array has negative numbers** in a sum ≥ target problem: shrinking no longer decreases the sum monotonically, so the pattern breaks. Use prefix sums with a hash map or a deque instead.
- **Updating the answer at the wrong moment:** for variable windows, be explicit about updating before or after shrinking.

## Summary

- Two pointers and sliding windows cut `O(n²)` to `O(n)` by never revisiting work already done.
- Converging pointers suit sorted/symmetric data; fast–slow suits in-place processing and cycles.
- Fixed windows update by "add right, drop left"; variable windows "expand until invalid, shrink until valid".
- The precondition is **monotonicity**: moving a pointer must change the condition in one predictable direction.
