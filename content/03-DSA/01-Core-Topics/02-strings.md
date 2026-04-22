# Strings — Patterns, Techniques, and Interview Problems

> **Subject**: DSA · **Group**: 🧩 Core Topics · **Topic**: 02 of 6
> **Status**: ✅ Done

---

## PART 1

---

### 1. Core Concepts

Strings are sequences of characters. In Python, strings are **immutable** — operations like concatenation create new strings. Key operations and complexities:

```
STRING FUNDAMENTALS:
  Access by index: O(1)
  Length: O(1)
  Concatenation (+): O(n) per operation (creates new string)
    Better: use list/array and ''.join() at end — O(n) total
  Slicing s[l:r]: O(r-l)
  Substring search (naive): O(n×m); KMP: O(n+m)

PYTHON STRING TRICKS:
  ord('a') = 97           # character → ASCII
  chr(97) = 'a'           # ASCII → character
  s.lower(), s.upper()
  s.count('c')            # count occurrences
  s.split(' ')            # split by delimiter
  ' '.join(list)          # join list to string
  s[::-1]                 # reverse
  s.strip()               # remove whitespace
  collections.Counter(s)  # character frequency map
```

---

### 2. Two Pointers on Strings

```python
# VALID PALINDROME (LeetCode 125):
def is_palindrome(s):
    s = ''.join(c.lower() for c in s if c.isalnum())
    left, right = 0, len(s) - 1
    while left < right:
        if s[left] != s[right]:
            return False
        left += 1; right -= 1
    return True

# REVERSE WORDS IN STRING (LeetCode 151):
def reverse_words(s):
    return ' '.join(s.split()[::-1])
# s.split() handles multiple spaces automatically

# VALID PALINDROME II (at most 1 delete):
def valid_palindrome(s):
    def is_pal(s, l, r):
        while l < r:
            if s[l] != s[r]:
                return False
            l += 1; r -= 1
        return True

    l, r = 0, len(s) - 1
    while l < r:
        if s[l] != s[r]:
            return is_pal(s, l+1, r) or is_pal(s, l, r-1)
        l += 1; r -= 1
    return True
```

---

### 3. HashMap / Character Count

```python
# VALID ANAGRAM (LeetCode 242):
from collections import Counter

def is_anagram(s, t):
    return Counter(s) == Counter(t)
    # Or: use array of 26 for lowercase letters
    # O(n) time, O(1) space (fixed 26-char alphabet)

# GROUP ANAGRAMS (LeetCode 49):
def group_anagrams(strs):
    groups = {}
    for s in strs:
        key = tuple(sorted(s))  # or Counter as frozenset
        groups.setdefault(key, []).append(s)
    return list(groups.values())
# Time: O(n × k log k) where k = max string length

# FIRST UNIQUE CHARACTER (LeetCode 387):
def first_uniq_char(s):
    count = Counter(s)
    for i, c in enumerate(s):
        if count[c] == 1:
            return i
    return -1

# ENCODE/DECODE STRINGS (LeetCode 271):
def encode(strs):
    return ''.join(f'{len(s)}#{s}' for s in strs)

def decode(s):
    result, i = [], 0
    while i < len(s):
        j = s.index('#', i)
        length = int(s[i:j])
        result.append(s[j+1:j+1+length])
        i = j + 1 + length
    return result
```

---

### 4. String Manipulation

```python
# LONGEST COMMON PREFIX (LeetCode 14):
def longest_common_prefix(strs):
    if not strs:
        return ""
    prefix = strs[0]
    for s in strs[1:]:
        while not s.startswith(prefix):
            prefix = prefix[:-1]
            if not prefix:
                return ""
    return prefix

# ROMAN TO INTEGER (LeetCode 13):
def roman_to_int(s):
    values = {'I':1,'V':5,'X':10,'L':50,'C':100,'D':500,'M':1000}
    result = 0
    for i in range(len(s)):
        if i + 1 < len(s) and values[s[i]] < values[s[i+1]]:
            result -= values[s[i]]  # IV, IX, XL etc.
        else:
            result += values[s[i]]
    return result

# REVERSE STRING IN PLACE (LeetCode 344):
def reverse_string(s):
    left, right = 0, len(s) - 1
    while left < right:
        s[left], s[right] = s[right], s[left]
        left += 1; right -= 1

# ZIGZAG CONVERSION (LeetCode 6):
def convert(s, numRows):
    if numRows == 1 or numRows >= len(s):
        return s
    rows = [''] * numRows
    row, direction = 0, 1
    for c in s:
        rows[row] += c
        if row == 0:
            direction = 1
        elif row == numRows - 1:
            direction = -1
        row += direction
    return ''.join(rows)
```

---

### 5. Sliding Window for Strings

```python
# LONGEST SUBSTRING WITHOUT REPEATING CHARACTERS (LeetCode 3):
def length_of_longest_substring(s):
    seen = {}
    max_len = left = 0
    for right, c in enumerate(s):
        if c in seen and seen[c] >= left:
            left = seen[c] + 1  # shrink window
        seen[c] = right
        max_len = max(max_len, right - left + 1)
    return max_len
# Time: O(n), Space: O(min(n, alphabet))

# MINIMUM WINDOW SUBSTRING (LeetCode 76) — hard but common:
from collections import Counter

def min_window(s, t):
    need = Counter(t)
    missing = len(t)
    left = result_l = result_r = 0

    for right, c in enumerate(s, 1):
        if need[c] > 0:
            missing -= 1
        need[c] -= 1

        if missing == 0:  # all chars covered
            # shrink left as much as possible
            while need[s[left]] < 0:
                need[s[left]] += 1
                left += 1
            if result_r == 0 or right - left < result_r - result_l:
                result_l, result_r = left, right
            need[s[left]] += 1
            missing += 1
            left += 1

    return s[result_l:result_r]
```

---

## PART 2

---

### 6. Must-Know Problems

| Problem                       | LeetCode | Pattern            | Time        |
| ----------------------------- | -------- | ------------------ | ----------- |
| Valid Anagram                 | #242     | Counter/sort       | O(n)        |
| Valid Palindrome              | #125     | Two pointers       | O(n)        |
| Longest Substring No Repeat   | #3       | Sliding window     | O(n)        |
| Group Anagrams                | #49      | HashMap + sort key | O(nk log k) |
| Longest Palindromic Substring | #5       | Expand from center | O(n²)       |
| Minimum Window Substring      | #76      | Sliding window     | O(n)        |
| String to Integer (atoi)      | #8       | Edge cases         | O(n)        |
| Count and Say                 | #38      | Simulation         | O(2^n)      |
| Encode/Decode Strings         | #271     | Length-prefix      | O(n)        |
| Longest Common Prefix         | #14      | Prefix comparison  | O(nm)       |

---

### 7. Key Interview Patterns

```
DECISION FRAMEWORK:

  Q: "Is it a palindrome?" or "Palindrome check"
     → Two pointers (in, clean input first)

  Q: "Are two strings anagrams?" or "Same characters?"
     → Counter comparison or sort

  Q: "Group strings by property"
     → HashMap with canonical key (sorted string, character count tuple)

  Q: "Find substring/window with condition"
     → Sliding window + character count

  Q: "String contains all characters of another"
     → Sliding window (min window substring pattern)

  Q: "Concatenate/build string efficiently"
     → Use list, append, then ''.join() at end
     → NOT string += char (O(n) per concat → O(n²) total)

  Q: "Parse/validate string format"
     → Index walking; handle edge cases first
```

---

### 8. Longest Palindromic Substring

```python
# LeetCode 5 — Two approaches:

# APPROACH 1: Expand from Center O(n²)
def longest_palindrome(s):
    def expand(left, right):
        while left >= 0 and right < len(s) and s[left] == s[right]:
            left -= 1; right += 1
        return s[left+1:right]

    result = ""
    for i in range(len(s)):
        odd = expand(i, i)      # odd length: "aba"
        even = expand(i, i+1)   # even length: "abba"
        if len(odd) > len(result): result = odd
        if len(even) > len(result): result = even
    return result
# Time: O(n²), Space: O(1)

# APPROACH 2: Manacher's Algorithm O(n) — know exists, not memorize
# Extends palindromes using already computed information
# In interviews: expand-from-center is acceptable and expected
```

---

### 9. Interview-Ready Explanation (30 sec)

> _"String problems commonly use sliding window for substring problems, two pointers for palindrome checks, and HashMap (Counter) for character frequency and anagram detection._
>
> _Key efficiency rule: never build strings with `+=` in a loop — O(n²). Use list append and `''.join()` at the end._
>
> _Most hard string problems (Minimum Window Substring, Longest Substring Without Repeating) use the sliding window pattern: expand right pointer, track what's needed, shrink left when condition met. The core template is identical — only the condition changes."_

---

### 10. Common Interview Questions

**Q1: How do you find the longest substring without repeating characters?**

> Sliding window with HashMap tracking last seen index. Right pointer iterates through each character. If character already seen AND its last position ≥ left boundary, move left to `last_seen[char] + 1`. Update last seen index and track max window size. Key: check `seen[c] >= left` not just `c in seen` — the character might be in the map but outside the current window. Time O(n) — each character visited at most twice. Space O(min(n, charset)). Common mistake: resetting the entire window when duplicate found (incorrect — you only move left past the duplicate). Example: `s = "abcabcbb"`, when second `a` found at index 3, move left to 1 (not 0), window becomes `[1,3] = "bca"`.

**Q2: How do you group anagrams together efficiently?**

> Use a HashMap where the key is the canonical form of each string — either `tuple(sorted(s))` or a tuple of 26 character counts. Two strings are anagrams iff they have the same canonical form. Iterate through all strings, group by canonical key. Time: O(n × k log k) where n = number of strings, k = max string length (for sorting). Space: O(nk). Alternative canonical key: `tuple(Counter(s).items())` or a 26-element frequency array converted to tuple — O(k) per string instead of O(k log k). For lowercase letters only, the array approach is slightly faster. In interview: `sorted(s)` key is more readable and perfectly acceptable.

**Q3: What are edge cases to always check for string problems?**

> (1) Empty string — return "" or 0 as appropriate. (2) Single character — often edge case for palindromes, anagrams, window problems. (3) All same characters — e.g., "aaaa". (4) Case sensitivity — clarify: is 'A' == 'a'? (LeetCode 125 explicitly says ignore case). (5) Non-alphanumeric characters — palindrome checks often skip spaces and punctuation. (6) Unicode vs ASCII — clarify if input is always lowercase ASCII (simplifies to 26-char array). (7) String vs character array mutability — Java String is immutable (convert to char array for in-place); Python strings are immutable (use list). (8) Integer overflow in string-to-integer (atoi) — explicitly check against `INT_MAX = 2^31 - 1` and `INT_MIN = -2^31`.

---

> **Next Topic →** [03 · HashMap](./03-hashmap.md)
