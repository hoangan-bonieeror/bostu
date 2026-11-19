---
title: "Big-O in practice: reading complexity from code"
summary: "What Big-O measures, the common complexity classes, how to read complexity straight from loops and recursion, and the real cost of list, set and dict operations in Python."
date: 2026-11-13
category: dsa
tags: [big-o, complexity, python, algorithms]
type: article
series: dsa-in-practice
seriesOrder: 1
---

> [!NOTE]
> Big-O does not measure running time in seconds. It describes **how fast the amount of work grows as the input gets bigger** — which decides whether a program still works when data grows from a thousand to a million records.

## What Big-O measures

Big-O describes how the number of operations grows with the input size `n`, usually in the worst case. Three simplification rules:

- **Drop constants:** `3n + 5` becomes `O(n)`.
- **Keep the dominant term:** `n² + n` becomes `O(n²)`.
- **Different inputs get different variables:** walking two arrays of length `a` and `b` is `O(a + b)`, not `O(n)`.

![Growth curves of common complexity classes](content/diagrams/bigo-growth.en.svg "For small n the curves are close; for large n the gap becomes enormous")

## Common complexity classes

| Big-O | Name | Example | n = 1,000 | n = 1,000,000 |
|---|---|---|---:|---:|
| `O(1)` | Constant | Index access, dict lookup | 1 | 1 |
| `O(log n)` | Logarithmic | Binary search | ~10 | ~20 |
| `O(n)` | Linear | One pass over an array | 1,000 | 1,000,000 |
| `O(n log n)` | Linearithmic | Sorting (merge sort, Timsort) | ~10,000 | ~20 million |
| `O(n²)` | Quadratic | Two nested loops | 1 million | 1 trillion |
| `O(2ⁿ)` | Exponential | Every subset | huge | infeasible |

The last column shows why Big-O matters: with a million items, `O(n log n)` is about 20 million operations (well under a second), while `O(n²)` is a trillion (hours).

## Reading complexity from code

**One loop → `O(n)`**

```python
def total(nums):
    s = 0
    for x in nums:      # runs n times
        s += x          # O(1)
    return s            # overall: O(n)
```

**Two nested loops → `O(n²)`**

```python
def has_duplicate(nums):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):   # ~n²/2 pairs
            if nums[i] == nums[j]:
                return True
    return False
```

**Halving each step → `O(log n)`**

```python
def binary_search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:                 # the search range halves every iteration
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```

**Recursion:** count the calls and the work per call. Naive `fib(n) = fib(n-1) + fib(n-2)` builds a call tree with about `2ⁿ` nodes. Adding memoization (`@functools.cache`) computes each value once, bringing it down to `O(n)`.

## The real cost of Python data structures

| Operation | `list` | `set` / `dict` |
|---|---|---|
| Add at end / add item | `append`: `O(1)` amortized | `add` / `d[k] = v`: `O(1)` average |
| Insert or remove at the front | `insert(0, x)`, `pop(0)`: **`O(n)`** | — |
| Membership `x in ...` | **`O(n)`** | `O(1)` average |
| Access by index / key | `O(1)` | `O(1)` average |
| Sort | `sorted`: `O(n log n)` | — |

> [!TIP]
> Need to add/remove at both ends? Use `collections.deque` (`O(1)` `appendleft`, `popleft`). Need the smallest item repeatedly? Use `heapq` (`O(log n)` per operation).

## Amortized analysis

`list.append` occasionally has to allocate a bigger block and copy every element — an `O(n)` step. But capacity grows geometrically each time, so `n` appends still cost `O(n)` in total. Spread evenly, each append is `O(1)` **amortized**.

## Space complexity

Big-O applies to memory too. Building an extra dict of `n` items uses `O(n)` memory. Recursion `n` levels deep uses `O(n)` stack space; Python's default limit is around 1,000 levels, so very deep recursion raises `RecursionError`.

## Example: from `O(n²)` to `O(n)`

Problem: find two numbers in an array that add up to `target`.

```python
# O(n²): try every pair
def two_sum_slow(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return i, j

# O(n): trade memory for time — remember numbers seen so far in a dict
def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:          # dict lookup: O(1)
            return seen[target - x], i
        seen[x] = i

two_sum([2, 7, 11, 15], 9)   # (0, 1)
```

This trade-off is extremely common: spend `O(n)` extra memory to cut time from `O(n²)` to `O(n)`.

## Quick estimates from input size

A typical machine does around 10⁸ simple operations per second (Python is a few dozen times slower). That gives a feel for what complexity is acceptable:

| Input size `n` | Usually acceptable |
|---|---|
| ≤ 20 | `O(2ⁿ)`, `O(n!)` (brute force, backtracking) |
| ≤ 10⁴ | `O(n²)` |
| ≤ 10⁶ | `O(n log n)` |
| ≤ 10⁸ | `O(n)` |
| larger | `O(log n)`, `O(1)` |

## Summary

- Big-O describes how cost grows with input size: drop constants, keep the dominant term.
- A single loop is `O(n)`, nested loops `O(n²)`, halving each step `O(log n)`.
- Picking the right data structure is often the cheapest optimization: `x in set` is `O(1)`, `x in list` is `O(n)`.
- Trading memory for time is a core technique — and the basis of the patterns in the next post of this series.
