var LESSONS_NEW_BEGINNER = [
  {
    id: "b11", track: "beginner", title: "Numbers & Math in Python",
    explain: "Python does arithmetic the way you expect, plus a few bonus operators: // for floor division, % for the remainder, and ** for powers. Whole numbers are ints, decimals are floats, and mixing them always gives a float.",
    takeaways: [
      "`//` divides and rounds down, `%` gives the remainder — together they split totals, like minutes into hours and minutes.",
      "`**` raises to a power: `2 ** 10` is 1024.",
      "Mixing an int and a float always gives a float: `3 + 0.5` is `3.5`."
    ],
    code: 'print(7 / 2)\nprint(7 // 2)\nprint(7 % 2)\nprint(2 ** 4)',
    quiz: [
      { q: "What does `print(10 % 3)` output?",
        options: ["1", "3", "3.33", "0"],
        answer: 0, why: "10 divided by 3 is 3 with remainder 1, and % gives the remainder." },
      { q: "What is the value of `2 ** 3`?",
        options: ["6", "8", "9", "5"],
        answer: 1, why: "** means 'to the power of': 2 * 2 * 2 = 8." },
      { q: "What type is the result of `4 + 1.5`?",
        options: ["int", "float", "str", "bool"],
        answer: 1, why: "Adding an int and a float always produces a float." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(2 ** 3)', options: ["6", "8", "9", "Error"], answer: 1,
      hint: "** means 'to the power of', not multiplication." }
  },
  {
    id: "b12", track: "beginner", title: "String Methods You Will Use Daily",
    explain: "Strings come with built-in tools called methods. Just a few — strip(), upper(), replace(), split() and join() — handle most everyday text jobs like cleaning up input or building messages.",
    takeaways: [
      "String methods return a NEW string; the original never changes, so write `s = s.strip()`.",
      "`split()` breaks text into a list; `' '.join(parts)` glues a list back into text.",
      "`strip()` removes whitespace from both ends — perfect for tidying user input."
    ],
    code: 'name = "  Ada  "\nprint(name.strip())\nprint(name.strip().upper())\nwords = "red,blue,green".split(",")\nprint(words)',
    quiz: [
      { q: "What does `'  hello  '.strip()` return?",
        options: ["'hello'", "'  hello'", "'HELLO'", "''"],
        answer: 0, why: "strip() removes the whitespace from both ends, leaving 'hello'." },
      { q: "After `s = 'a,b,c'` and `parts = s.split(',')`, what is `parts`?",
        options: ["['a', 'b', 'c']", "'a,b,c'", "['a,b,c']", "3"],
        answer: 0, why: "split(',') cuts the string at each comma into a list of three items." },
      { q: "Does `'Hi'.upper()` change the original string?",
        options: ["No — strings are immutable, it returns a new one", "Yes, it edits the string in place", "Only if you assign it back", "It raises an error"],
        answer: 0, why: "Strings can't be changed in place; upper() builds and returns a new string." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print("one two".split())', options: ["['one', 'two']", "'one two'", "['one two']", "Error"], answer: 0,
      hint: "split() with no arguments splits on any whitespace." }
  },
  {
    id: "b13", track: "beginner", title: "Slicing & Indexing Strings",
    explain: "Every character in a string has a position starting at 0. Indexing with s[i] grabs one character, and slicing with s[start:stop] grabs a range — the start is included but the stop is left out.",
    takeaways: [
      "Indexes start at 0; negative indexes count from the end, so `s[-1]` is the last character.",
      "In `s[start:stop]`, start is included but stop is excluded.",
      "`s[::-1]` reverses a string — a trick worth memorizing."
    ],
    code: 's = "Python"\nprint(s[0])\nprint(s[-1])\nprint(s[0:4])\nprint(s[::-1])',
    quiz: [
      { q: "If `s = 'Python'`, what is `s[1]`?",
        options: ["'y'", "'P'", "'h'", "Error"],
        answer: 0, why: "Counting starts at 0, so index 1 is the second character, 'y'." },
      { q: "What does `'Python'[1:4]` give?",
        options: ["'yth'", "'ytho'", "'Pyt'", "'ythn'"],
        answer: 0, why: "It takes indexes 1, 2 and 3 ('y', 't', 'h'); index 4 is excluded." },
      { q: "What is the value of `'abc'[-1]`?",
        options: ["'c'", "'a'", "'b'", "Error"],
        answer: 0, why: "Negative indexes count from the end, so -1 is the last character." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: "print('hello'[1:4])", options: ["ell", "ello", "hel", "llo"], answer: 0,
      hint: "Counting starts at 0, and the stop index is left out." }
  },
  {
    id: "b14", track: "beginner", title: "List Methods in Depth",
    explain: "Lists are mutable, and their methods change them in place. append() adds one item to the end, extend() adds many, insert() squeezes one in at a position, remove() deletes by value, and pop() takes an item out and hands it back.",
    takeaways: [
      "`append()` adds ONE item; `extend()` adds EACH item of another list.",
      "`pop()` removes AND returns an item; `remove()` deletes by value.",
      "Most list methods return None — the change happens to the list itself."
    ],
    code: 'nums = [1, 2]\nnums.append(3)\nnums.extend([4, 5])\nprint(nums)\nprint(nums.pop())\nprint(nums)',
    quiz: [
      { q: "After `a = [1, 2]` and `a.append([3, 4])`, what is `a`?",
        options: ["[1, 2, [3, 4]]", "[1, 2, 3, 4]", "[1, 2, 3]", "Error"],
        answer: 0, why: "append() adds its argument as a single item, so the list becomes nested." },
      { q: "What does `[10, 20, 30].pop(0)` return?",
        options: ["10", "30", "[20, 30]", "0"],
        answer: 0, why: "pop(0) removes and returns the item at index 0, which is 10." },
      { q: "Which removes the FIRST occurrence of the value 5 from `lst`?",
        options: ["lst.remove(5)", "lst.pop(5)", "del lst", "lst.clear(5)"],
        answer: 0, why: "remove() deletes by value; pop() works by index instead." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'a = [10, 20]\na.append(30)\nprint(len(a))', options: ["3", "2", "30", "Error"], answer: 0,
      hint: "len() counts items, and append() added one more." }
  },
  {
    id: "b15", track: "beginner", title: "Tuples: Unpacking & Immutability",
    explain: "A tuple is like a list you can't change — perfect for fixed data like coordinates or RGB colors. You can unpack a tuple into separate variables in one line, which makes swaps and multiple values elegant.",
    takeaways: [
      "Tuples are immutable: you can't add, remove, or change items after creation.",
      "Unpacking assigns each item to its own variable: `x, y = (3, 4)`.",
      "Use tuples for data that should never change, like coordinates or dates."
    ],
    code: 'point = (3, 4)\nx, y = point\nprint(x + y)\nprint((x, y))',
    quiz: [
      { q: "What happens when you run `(1, 2).append(3)`?",
        options: ["AttributeError — tuples have no append", "It works just like a list", "It returns (1, 2, 3)", "It converts to a list"],
        answer: 0, why: "Tuples are immutable and have no append method at all." },
      { q: "After `a, b = (5, 9)`, what is `a + b`?",
        options: ["14", "59", "Error", "(5, 9)"],
        answer: 0, why: "Unpacking gives a = 5 and b = 9, so a + b is 14." },
      { q: "Why choose a tuple over a list?",
        options: ["To protect data from accidental changes", "Tuples are always faster to type", "Tuples can hold more items", "Lists cannot store numbers"],
        answer: 0, why: "Immutability is a feature: it guarantees the data stays exactly as created." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'x, y = (10, 20)\nprint(y - x)', options: ["10", "-10", "30", "Error"], answer: 0,
      hint: "After unpacking, y is 20 and x is 10." }
  },
  {
    id: "b16", track: "beginner", title: "Dictionary Methods in Depth",
    explain: "Dictionaries store key-value pairs, and their methods make lookups safe and iteration easy. get() avoids KeyError crashes, keys()/values()/items() expose the contents, and update() merges another dictionary in.",
    takeaways: [
      "`d.get(key, default)` returns the default instead of crashing when a key is missing.",
      "`d.items()` lets you loop over key AND value together: `for k, v in d.items()`.",
      "`setdefault()` inserts a key only if it isn't already there."
    ],
    code: 'scores = {"ana": 9, "bob": 7}\nprint(scores.get("zoe", 0))\nscores.update({"zoe": 8})\nfor name, score in scores.items():\n    print(name, score)',
    quiz: [
      { q: "What does `{}.get('x', 'none')` return?",
        options: ["'none'", "None", "KeyError", "''"],
        answer: 0, why: "The key is missing, so get() returns the default you supplied." },
      { q: "Which loop prints both keys and values of `d`?",
        options: ["for k, v in d.items():", "for k in d:", "for v in d.values(k):", "for d in items():"],
        answer: 0, why: "items() yields (key, value) pairs, which unpack neatly into k and v." },
      { q: "After `d = {'a': 1}` and `d.update({'b': 2})`, what is `d`?",
        options: ["{'a': 1, 'b': 2}", "{'b': 2}", "{'a': 1}", "Error"],
        answer: 0, why: "update() merges the new pairs into the existing dictionary." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'd = {"x": 1}\nprint(d.get("y"))', options: ["None", "0", "KeyError", "''"], answer: 0,
      hint: "get() without a default returns None for missing keys." }
  },
  {
    id: "b17", track: "beginner", title: "Set Operations: Union, Intersection & Difference",
    explain: "Sets hold unique items and support math-style operations. Union (|) combines everything from both sets, intersection (&) keeps only what's in both, and difference (-) keeps what's only in the first.",
    takeaways: [
      "Sets automatically drop duplicates: `set([1, 1, 2])` is `{1, 2}`.",
      "`a | b` is the union, `a & b` the intersection, `a - b` the difference.",
      "Use a set for fast membership tests or to remove duplicates from a list."
    ],
    code: 'a = {1, 2, 3}\nb = {3, 4, 5}\nprint(a | b)\nprint(a & b)\nprint(a - b)',
    quiz: [
      { q: "What is `{1, 2} | {2, 3}`?",
        options: ["{1, 2, 3}", "{2}", "{1, 3}", "[1, 2, 2, 3]"],
        answer: 0, why: "Union combines all unique items from both sets." },
      { q: "What does `{1, 2, 3} & {2, 4}` give?",
        options: ["{2}", "{1, 2, 3, 4}", "set()", "{1, 3}"],
        answer: 0, why: "Intersection keeps only items present in BOTH sets — just 2." },
      { q: "What is `len(set([5, 5, 5, 6]))`?",
        options: ["2", "4", "1", "3"],
        answer: 0, why: "Duplicates collapse, leaving {5, 6}, which has 2 items." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print({1, 2, 3} - {2})', options: ["{1, 3}", "{2}", "{1, 2, 3}", "Error"], answer: 0,
      hint: "Difference keeps the items NOT in the second set." }
  },
  {
    id: "b18", track: "beginner", title: "Type Conversion & the input() Function",
    explain: "input() always returns text, even when the user types a number — so convert it with int() or float() before doing math. The same conversion functions switch between types anywhere: int('7') becomes 7, str(7) becomes '7'.",
    takeaways: [
      "`input()` returns a string — wrap it: `age = int(input('Age: '))`.",
      "`int('7')` gives 7, `str(7)` gives '7', `float('2.5')` gives 2.5.",
      "Converting bad text like `int('abc')` raises a ValueError."
    ],
    code: 'age_text = "21"\nage = int(age_text)\nprint(age + 4)\nprint("Next year: " + str(age + 1))',
    quiz: [
      { q: "If `n = input()` and the user types 5, what does `n + 1` do?",
        options: ["Raises TypeError — can't add int to str", "Gives 6", "Gives '51'", "Gives 5"],
        answer: 0, why: "n is the string '5', and adding a string and an int is a TypeError." },
      { q: "What does `int('42') + 8` equal?",
        options: ["50", "'428'", "42", "Error"],
        answer: 0, why: "int('42') becomes the number 42 first, then 42 + 8 = 50." },
      { q: "What does `str(3.5)` return?",
        options: ["'3.5'", "3.5", "3", "Error"],
        answer: 0, why: "str() converts the float into its text form, '3.5'." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(int("10") * 2)', options: ["20", "'1010'", "12", "Error"], answer: 0,
      hint: "int('10') becomes the number 10 before the multiplication." }
  },
  {
    id: "b19", track: "beginner", title: "Boolean Logic: and, or, not",
    explain: "and, or and not combine True/False values into decisions. `and` needs both sides true, `or` needs just one, and `not` flips a value — they're the building blocks of every if statement with multiple conditions.",
    takeaways: [
      "`and` is True only when BOTH sides are True; `or` needs just ONE.",
      "`not` flips a value: `not True` is False.",
      "Comparisons return booleans, so `age >= 18 and has_ticket` reads like English."
    ],
    code: 'age = 20\nhas_ticket = True\nprint(age >= 18 and has_ticket)\nprint(age < 13 or not has_ticket)',
    quiz: [
      { q: "What is `True and False`?",
        options: ["False", "True", "None", "Error"],
        answer: 0, why: "and needs both sides True, but one side is False." },
      { q: "What is `True or False`?",
        options: ["True", "False", "None", "Error"],
        answer: 0, why: "or needs only one side True, and the left side is True." },
      { q: "What does `not (5 > 3)` evaluate to?",
        options: ["False", "True", "5", "3"],
        answer: 0, why: "5 > 3 is True, and not flips it to False." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'x = 7\nprint(x > 5 and x < 10)', options: ["True", "False", "7", "Error"], answer: 0,
      hint: "Is 7 both greater than 5 AND less than 10?" }
  },
  {
    id: "b20", track: "beginner", title: "Nested Loops & Patterns",
    explain: "A loop inside another loop runs the inner loop fully for every single step of the outer one. That's exactly what you need to draw grids and patterns — think of the outer loop as rows and the inner loop as columns.",
    takeaways: [
      "The inner loop completes ALL its iterations for each ONE iteration of the outer loop.",
      "Use `print(..., end='')` to stay on the same line; a bare `print()` moves down a row.",
      "Outer loop = rows, inner loop = columns is the mental model for patterns."
    ],
    code: 'for row in range(3):\n    for col in range(3):\n        print("*", end="")\n    print()',
    quiz: [
      { q: "How many times does print run here? `for i in range(2):` then `for j in range(3): print(j)`",
        options: ["6", "5", "3", "2"],
        answer: 0, why: "The inner loop runs 3 times for each of the 2 outer iterations: 2 x 3 = 6." },
      { q: "What does `print('a', end='')` followed by `print('b')` output?",
        options: ["ab on one line", "a then b on separate lines", "'a b'", "Error"],
        answer: 0, why: "end='' replaces the newline, so 'b' prints right after 'a'." },
      { q: "In a pattern program, the outer loop usually represents…",
        options: ["rows", "columns", "pixels", "colors"],
        answer: 0, why: "Each outer iteration draws one full row; the inner loop draws its columns." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'for i in range(2):\n    print(i, end="-")', options: ["0-1-", "0 then 1 on separate lines", "1-2-", "01"], answer: 0,
      hint: "end='-' replaces the newline after each print." }
  },
  {
    id: "b21", track: "beginner", title: "break, continue & Loop else",
    explain: "break exits a loop immediately, continue skips to the next iteration, and a loop's else block runs only if the loop finished without break — perfect for 'search and not found' logic.",
    takeaways: [
      "`break` stops the whole loop; `continue` skips just the current round.",
      "A `for...else` runs its else only when NO break happened.",
      "Use break for 'found it, stop looking' searches."
    ],
    code: 'for n in [3, 8, 12, 5]:\n    if n > 10:\n        print("found", n)\n        break\nelse:\n    print("none over 10")',
    quiz: [
      { q: "What does `break` do inside a loop?",
        options: ["Exits the loop immediately", "Skips one iteration", "Restarts the loop", "Pauses for input"],
        answer: 0, why: "break jumps straight out of the loop; nothing after it in the loop runs." },
      { q: "When does a `for...else` block's else run?",
        options: ["Only if the loop never hit break", "Always, after every loop", "Only if the loop body is empty", "Whenever break is used"],
        answer: 0, why: "The else means 'completed normally' — a break skips it." },
      { q: "What prints? `for i in range(5):` `if i == 2: continue` `print(i, end='')`",
        options: ["0134", "01234", "012", "34"],
        answer: 0, why: "continue skips only the iteration where i is 2; the rest print." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'for i in range(4):\n    if i == 2:\n        break\n    print(i, end="")', options: ["01", "0123", "013", "2"], answer: 0,
      hint: "The loop stops the moment i becomes 2." }
  },
  {
    id: "b22", track: "beginner", title: "Function Arguments: Defaults & Keywords",
    explain: "Parameters can have default values, so callers may skip them — and any argument can be passed by name (keyword), which makes calls readable and frees you from remembering the order.",
    takeaways: [
      "A default like `def greet(name='friend')` makes that argument optional.",
      "Keyword arguments name the parameter: `greet(name='Ada')`.",
      "Once a parameter has a default, every parameter after it needs one too."
    ],
    code: 'def greet(name, punct="!"):\n    print("Hi " + name + punct)\ngreet("Ada")\ngreet("Bob", punct="?")\ngreet(name="Zoe", punct=".")',
    quiz: [
      { q: "Given `def f(a, b=5)`, which call is valid?",
        options: ["f(1)", "f()", "f(a=1, 2)", "f(b=2, 1)"],
        answer: 0, why: "f(1) sets a=1 and b falls back to 5; the others break argument rules." },
      { q: "What is `greet(name='Ada')` using?",
        options: ["A keyword argument", "A default value", "A global variable", "A decorator"],
        answer: 0, why: "Naming the parameter at the call site is a keyword argument." },
      { q: "Why is `def f(a=1, b):` invalid?",
        options: ["A non-default parameter can't follow a default one", "Defaults must be strings", "b is a bad name", "It is actually valid"],
        answer: 0, why: "Python requires all defaulted parameters to come after the required ones." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def add(a, b=10):\n    return a + b\nprint(add(5))', options: ["15", "5", "10", "Error"], answer: 0,
      hint: "b falls back to its default of 10." }
  },
  {
    id: "b23", track: "beginner", title: "Scope: Local vs Global",
    explain: "A variable created inside a function is local — it exists only while the function runs. Code outside can't see it, and a local with the same name as a global shadows (hides) it without changing the original.",
    takeaways: [
      "Local variables die when the function returns; they can't be used outside.",
      "Reading a global inside a function is fine; assigning to it creates a NEW local unless you write `global`.",
      "Same name inside and outside? The inner one wins — but only inside."
    ],
    code: 'x = 10\ndef show():\n    x = 99\n    print(x)\nshow()\nprint(x)',
    quiz: [
      { q: "What prints? `x = 1` then `def f():` `x = 2` then `f()` then `print(x)`",
        options: ["1", "2", "Error", "None"],
        answer: 0, why: "The x inside f() is a separate local; the global x stays 1." },
      { q: "Can code outside a function read a variable created inside it?",
        options: ["No — it is local to the function", "Yes, always", "Only if it holds a number", "Only with an import"],
        answer: 0, why: "Local variables exist only during the function's execution." },
      { q: "What does the `global` keyword do?",
        options: ["Lets a function assign to a module-level variable", "Makes a variable constant", "Shares data between files", "Deletes local variables"],
        answer: 0, why: "Without it, assignment inside a function creates a local instead." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'n = 5\ndef change():\n    n = 0\nchange()\nprint(n)', options: ["5", "0", "Error", "None"], answer: 0,
      hint: "The n inside change() is a separate local variable." }
  },
  {
    id: "b24", track: "beginner", title: "Docstrings & Getting Help",
    explain: "A docstring is a triple-quoted string right under a function's def line that documents what it does. Python's help() shows it, and good docstrings make your future self (and teammates) grateful.",
    takeaways: [
      "A docstring is the FIRST statement in a function, written in triple quotes.",
      "`help(func)` prints the docstring; `func.__doc__` gives it as a string.",
      "One line for what it does, plus the parameters, is enough for small functions."
    ],
    code: 'def square(n):\n    """Return n multiplied by itself."""\n    return n * n\nprint(square.__doc__)',
    quiz: [
      { q: "Where does a docstring go?",
        options: ["As the first statement inside the function", "Above the def line", "At the end of the file", "Only inside a comment"],
        answer: 0, why: "Python treats the first string literal in a function body as its documentation." },
      { q: "What does `help(len)` do?",
        options: ["Shows len's documentation", "Lists all variables", "Deletes len", "Runs len"],
        answer: 0, why: "help() displays the docstring and signature of any object." },
      { q: "Which follows the docstring convention?",
        options: ['"""Adds two numbers."""', '# Adds two numbers', 'docstring = "Adds"', '"""Adds'],
        answer: 0, why: "A triple-quoted string as the first statement is the documented convention." }
    ],
    challenge: { type: "blank", prompt: "Fill in the blank to print the function's docstring:",
      code: 'def add(a, b):\n    """Add a and b."""\n    return a + b\nprint(____)',
      answer: ["add.__doc__"], hint: "Docstrings live in the __doc__ attribute." }
  },
  {
    id: "b25", track: "beginner", title: "The random Module: Build a Guessing Game",
    explain: "The random module adds unpredictability: randint(a, b) picks an integer in a range, choice(seq) picks one item, and shuffle() mixes a list in place. Together they're all you need for games and simulations.",
    takeaways: [
      "`random.randint(1, 10)` can return 1 AND 10 — both ends are included.",
      "`random.choice(['a', 'b'])` picks one item from a sequence.",
      "`random.shuffle(deck)` shuffles in place and returns None."
    ],
    code: 'import random\nprint(random.randint(1, 6))\nprint(random.choice(["rock", "paper", "scissors"]))\ndeck = [1, 2, 3]\nrandom.shuffle(deck)\nprint(deck)',
    quiz: [
      { q: "What values can `random.randint(1, 3)` return?",
        options: ["1, 2, or 3", "1 or 2 only", "0, 1, 2, or 3", "Any decimal between 1 and 3"],
        answer: 0, why: "randint includes BOTH endpoints, unlike range()." },
      { q: "What does `random.shuffle(cards)` return?",
        options: ["None — it shuffles the list in place", "A new shuffled list", "The first card", "True"],
        answer: 0, why: "shuffle() mutates the list directly and returns None." },
      { q: "Which picks one random item from a list?",
        options: ["random.choice(items)", "random.pick(items)", "random.one(items)", "items.random()"],
        answer: 0, why: "choice() is the real function; the others don't exist." }
    ],
    challenge: { type: "predict", prompt: "What will this print? (seed() makes randomness repeatable)",
      code: 'import random\nrandom.seed(42)\nx = random.randint(1, 10)\nrandom.seed(42)\ny = random.randint(1, 10)\nprint(x == y)', options: ["True", "False", "Error", "None"], answer: 0,
      hint: "Same seed, same 'random' numbers." }
  },
  {
    id: "b26", track: "beginner", title: "Dates & Times with datetime",
    explain: "The datetime module handles dates and times: date.today() gives you today, timedelta does date arithmetic like '7 days from now', and strftime() formats a date into any string layout you like.",
    takeaways: [
      "`from datetime import date, timedelta`, then `date.today()` is today's date.",
      "Add `timedelta(days=7)` to a date to jump a week forward.",
      "`strftime('%d %b %Y')` formats a date like '03 Nov 2026'."
    ],
    code: 'from datetime import date, timedelta\ntoday = date.today()\nprint(today)\nprint(today + timedelta(days=7))',
    quiz: [
      { q: "What does `date.today() + timedelta(days=1)` give?",
        options: ["Tomorrow's date", "Today's date", "Yesterday's date", "An error"],
        answer: 0, why: "Adding a one-day timedelta moves the date one day forward." },
      { q: "What type of object does `date.today()` return?",
        options: ["A date object", "A string", "An integer timestamp", "A tuple"],
        answer: 0, why: "It returns a date object, which you can format or do math with." },
      { q: "How many days are in `timedelta(weeks=2)`?",
        options: ["14", "2", "7", "10"],
        answer: 0, why: "weeks=2 is converted to 14 days internally." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from datetime import date\nprint(date(2026, 1, 1).strftime("%A"))', options: ["Thursday", "Friday", "Monday", "Error"], answer: 0,
      hint: "%A is the full weekday name — New Year's Day 2026 is a Thursday." }
  },
  {
    id: "b27", track: "beginner", title: "None & Checking for Nothing",
    explain: "None is Python's way of saying 'no value here' — it's also what every function returns when it doesn't return anything. Always check for it with `is None`, never with `==`, because `is` tests identity.",
    takeaways: [
      "`None` means 'no value'; a function without return gives back None.",
      "Check with `is None` / `is not None` — not `==`.",
      "`None` is falsy, so `if result:` catches it too — but `is None` is explicit."
    ],
    code: 'def find_user(name):\n    return None\nuser = find_user("ada")\nprint(user is None)\nprint(user)',
    quiz: [
      { q: "What does this return? `def f():` followed by `x = 1` (no return statement)",
        options: ["None", "1", "0", "Error"],
        answer: 0, why: "A function without return always gives back None." },
      { q: "Which is the correct None check?",
        options: ["if x is None:", "if x == None:", "if x = None:", "if None == True:"],
        answer: 0, why: "is tests identity, which is the reliable way to check for None." },
      { q: "What is `bool(None)`?",
        options: ["False", "True", "None", "Error"],
        answer: 0, why: "None is falsy, like 0 and empty collections." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'x = None\nprint(x is None)', options: ["True", "False", "None", "Error"], answer: 0,
      hint: "is checks identity — x really is None." }
  },
  {
    id: "b28", track: "beginner", title: "Comments & Clean Code Style",
    explain: "Comments (#) explain WHY your code does something, not what — the code already says what. Clean style (clear names, blank lines between ideas, short lines) makes code readable for humans, including future you.",
    takeaways: [
      "Write comments for the WHY, not the WHAT: `# retry: the API is flaky`.",
      "Use descriptive names (`total_price`) over cryptic ones (`tp`).",
      "Python ignores everything after `#` on a line — handy for quick experiments."
    ],
    code: '# convert minutes into hours and leftover minutes\nmins = 135\nhours = mins // 60\nleft = mins % 60\nprint(hours, left)',
    quiz: [
      { q: "Which comment is most useful?",
        options: ["# retry 3 times: the API is flaky on weekends", "# set x to 5", "# this is a comment", "# code below"],
        answer: 0, why: "It explains WHY the code exists — the code itself already shows the what." },
      { q: "What does Python do with text after `#`?",
        options: ["Ignores it", "Prints it", "Runs it", "Saves it to a file"],
        answer: 0, why: "Everything from # to the end of the line is a comment." },
      { q: "Which variable name is cleanest?",
        options: ["total_price", "tp", "x1", "data2"],
        answer: 0, why: "Descriptive names read like English and need no decoding." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print("a")\n# print("b")\nprint("c")', options: ["a\nc", "a\nb\nc", "abc", "Error"], answer: 0,
      hint: "Lines starting with # never run." }
  },
  {
    id: "b29", track: "beginner", title: "Reading Tracebacks: Debugging Basics",
    explain: "When Python crashes it prints a traceback — read it BOTTOM-UP. The last line names the error (like NameError or TypeError), and the lines above show exactly where it happened. Most bugs are found in seconds once you read tracebacks this way.",
    takeaways: [
      "Read tracebacks bottom-up: the LAST line is the actual error.",
      "`NameError` = misspelled or undefined name; `TypeError` = wrong kind of operation.",
      "The `line N` part pinpoints exactly where it broke."
    ],
    code: 'try:\n    print(undeclared_var)\nexcept NameError as e:\n    print("Caught:", type(e).__name__)',
    quiz: [
      { q: "Where is the most useful line of a traceback?",
        options: ["The last line — it names the error", "The first line", "The middle", "Tracebacks have no useful lines"],
        answer: 0, why: "The final line states the error type and message; work upward from there." },
      { q: "What error does `print(5 + 'a')` raise?",
        options: ["TypeError", "NameError", "SyntaxError", "ValueError"],
        answer: 0, why: "Adding an int and a str is an operation on the wrong types." },
      { q: "What error does `print(x)` raise if x was never defined?",
        options: ["NameError", "TypeError", "IndexError", "KeyError"],
        answer: 0, why: "Using a name that doesn't exist is a NameError." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'try:\n    print([1, 2][5])\nexcept IndexError:\n    print("out of range")', options: ["out of range", "IndexError", "[1, 2]", "Error"], answer: 0,
      hint: "Index 5 doesn't exist in a 2-item list, so IndexError is raised and caught." }
  },
  {
    id: "b30", track: "beginner", title: "Capstone: Command-Line To-Do App",
    explain: "Time to put it all together: a to-do app using a list of dictionaries, one function per action, and a loop for the menu. This is how small real programs are structured — data plus functions plus a main loop.",
    takeaways: [
      "Model each to-do as a dict (`{'task': ..., 'done': False}`) inside a list.",
      "One function per action (add, list, complete) keeps the program organized.",
      "A `while True` loop with `break` on 'quit' is the classic menu pattern."
    ],
    code: 'todos = []\n\ndef add(task):\n    todos.append({"task": task, "done": False})\n\nadd("Study Python")\nadd("Build app")\ntodos[0]["done"] = True\nprint(len(todos), "tasks,", sum(1 for t in todos if t["done"]), "done")',
    quiz: [
      { q: "How is each to-do stored in the capstone app?",
        options: ["As a dict inside a list", "As a plain string", "As a tuple", "In a set"],
        answer: 0, why: "Each to-do is a dict with 'task' and 'done' keys, collected in a list." },
      { q: "How does the menu loop exit?",
        options: ["break when the user chooses quit", "It never exits", "With a return statement", "With an exception"],
        answer: 0, why: "The classic pattern is `while True` with `break` on the quit choice." },
      { q: "Why write one function per action?",
        options: ["Each piece is testable and readable on its own", "Functions run faster", "Python requires it", "Lists can't be global"],
        answer: 0, why: "Small functions are easier to understand, test, and reuse." }
    ],
    challenge: { type: "predict", prompt: "How many tasks are done here?",
      code: 'tasks = [{"t": "a", "done": True}, {"t": "b", "done": False}]\nprint(sum(1 for t in tasks if t["done"]))', options: ["1", "2", "0", "Error"], answer: 0,
      hint: "Only one dict has done set to True." }
  }
];
