var LESSONS_NEW_BEGINNER = [
  {
    id: "b11", section: "base-camp", track: "beginner", title: "Numbers & Math in Python",
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
    id: "b12", section: "base-camp", track: "beginner", title: "String Methods You Will Use Daily",
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
    id: "b13", section: "base-camp", track: "beginner", title: "Slicing & Indexing Strings",
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
    id: "b14", section: "tool-shed", track: "beginner", title: "List Methods in Depth",
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
    id: "b15", section: "tool-shed", track: "beginner", title: "Tuples: Unpacking & Immutability",
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
    id: "b16", section: "tool-shed", track: "beginner", title: "Dictionary Methods in Depth",
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
    id: "b17", section: "tool-shed", track: "beginner", title: "Set Operations: Union, Intersection & Difference",
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
    id: "b18", section: "base-camp", track: "beginner", title: "Type Conversion & the input() Function",
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
    id: "b19", section: "base-camp", track: "beginner", title: "Boolean Logic: and, or, not",
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
    id: "b20", section: "base-camp", track: "beginner", title: "Nested Loops & Patterns",
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
    id: "b21", section: "base-camp", track: "beginner", title: "break, continue & Loop else",
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
    id: "b22", section: "base-camp", track: "beginner", title: "Function Arguments: Defaults & Keywords",
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
    id: "b23", section: "base-camp", track: "beginner", title: "Scope: Local vs Global",
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
    id: "b24", section: "base-camp", track: "beginner", title: "Docstrings & Getting Help",
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
    id: "b25", section: "base-camp", track: "beginner", title: "The random Module: Build a Guessing Game",
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
    id: "b26", section: "base-camp", track: "beginner", title: "Dates & Times with datetime",
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
    id: "b27", section: "base-camp", track: "beginner", title: "None & Checking for Nothing",
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
    id: "b28", section: "base-camp", track: "beginner", title: "Comments & Clean Code Style",
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
    id: "b29", section: "base-camp", track: "beginner", title: "Reading Tracebacks: Debugging Basics",
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
    id: "b30", section: "base-camp", track: "beginner", title: "Capstone: Command-Line To-Do App",
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
  },
{
    id: "b31", section: "base-camp", track: "beginner", title: "F-strings in Depth: Formatting Numbers & Dates",
    explain: "An f-string can do more than drop a variable into text: a format spec after a colon controls decimals, commas, and percentages. You can even format a date inside the same f-string, so one line builds a tidy message like a receipt or a report.",
    takeaways: [
      "`f'{price:.2f}'` shows a number with exactly 2 decimal places — perfect for money.",
      "`f'{big:,}'` adds thousand separators: `1234567` becomes `1,234,567`.",
      "`f'{share:.1%}'` turns `0.256` into `25.6%` — the format multiplies by 100 for you.",
      "Dates format with `strftime`, e.g. `date(2026, 11, 5).strftime('%d %b %Y')` gives `05 Nov 2026`.",
    ],
    code: 'price = 49.99\nprint(f"Price: ${price:.2f}")\nprint(f"Big number: {1234567:,}")\nprint(f"Share: {0.256:.1%}")\nfrom datetime import date\nprint(date(2026, 11, 5).strftime("%d %b %Y"))',
    quiz: [
      { q: "What does `f'{3.14159:.2f}'` produce?",
        options: ["'3.14'", "'3.142'", "'3.1'", "'3.14159'"],
        answer: 0, why: ".2f rounds the number to exactly 2 decimal places." },
      { q: "What does `f'{1000000:,}'` produce?",
        options: ["'1.000.000'", "'1 000 000'", "'1000000'", "'1,000,000'"],
        answer: 3, why: "The comma in the format spec adds thousand separators." },
      { q: "In `date(2026, 11, 5).strftime('%Y')`, what does `%Y` give?",
        options: ["'Thursday'", "'2026'", "'05'", "'Nov'"],
        answer: 1, why: "%Y is the four-digit year, so it gives '2026'." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(f"{1234.5678:,.2f}")', options: ["1,234.56", "1,234.57", "1,234.5678", "1234.57"], answer: 1,
      hint: "The comma adds separators and .2f rounds to 2 decimal places." }
  },
  {
    id: "b32", section: "base-camp", track: "beginner", title: "String Building: join() vs + in Loops",
    explain: "You can glue strings together with + or with join(), but they are not equal in a loop. Each + makes a brand-new string and copies everything again, while join() builds the final string in one pass — so for lists of words, join() is both tidier and faster.",
    takeaways: [
      "`', '.join(words)` puts the separator BETWEEN items, not after the last one.",
      "`''.join(parts)` glues with no separator at all.",
      "In a loop, prefer collecting pieces in a list and joining once over `result += piece` each time.",
      "`join()` only works on strings — convert numbers with `str()` first.",
    ],
    code: 'words = ["Ava", "Bo", "Al"]\nprint(" | ".join(words))\nparts = []\nfor name in words:\n    parts.append(name.upper())\nprint(" ".join(parts))',
    quiz: [
      { q: "What does `', '.join(['a', 'b'])` return?",
        options: ["['a', 'b']", "'a b'", "'ab'", "'a, b'"],
        answer: 3, why: "join() places the separator ', ' between the two items." },
      { q: "Why is join() better than `+` inside a loop?",
        options: ["Because + is slower only for lists", "Because join() only works on numbers", "Because join() builds the string in one pass instead of copying it on every +", "Because + does not work on strings"],
        answer: 2, why: "Each + copies the whole string so far; join() assembles the pieces once." },
      { q: "What does `''.join(['p', 'y'])` return?",
        options: ["'p y'", "'py'", "['p', 'y']", "Error"],
        answer: 1, why: "An empty separator glues the pieces directly together." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print("-".join(["2026", "11", "05"]))', options: ["Error", "2026-11-05", "2026 11 05", "20261105"], answer: 1,
      hint: "join() puts the separator between the items." }
  },
  {
    id: "b33", section: "base-camp", track: "beginner", title: "Working with User Input: Validation Basics",
    explain: "Input from a user always arrives as a string, and users type surprises — spaces, letters, or nothing at all. Before you trust it, tidy it with strip() and check it with isdigit(), so a bad answer gets a friendly retry instead of a crash.",
    takeaways: [
      "`input()` always returns a string, even when the user types digits.",
      "`strip()` removes spaces from both ends: `'  27 '.strip()` is `'27'`.",
      "`'42'.isdigit()` is True, but `'twenty'.isdigit()` is False — use it to check before converting.",
      "Only call `int()` after the check passes, or a bad value raises a `ValueError`.",
    ],
    code: 'raw = "  27 "\nclean = raw.strip()\nprint(clean.isdigit())\nprint(int(clean) + 3)\nbad = "twenty"\nprint(bad.isdigit())\nprint("Age OK" if clean.isdigit() else "Try again")',
    quiz: [
      { q: "What does `'42'.isdigit()` return?",
        options: ["Error", "'42'", "True", "False"],
        answer: 2, why: "The string holds only digits, so isdigit() is True." },
      { q: "What does `strip()` do to a string?",
        options: ["Splits the text into a list", "Returns True or False about digits", "Removes whitespace from both ends", "Converts the text to an integer"],
        answer: 2, why: "strip() trims spaces (and other whitespace) from the start and end only." },
      { q: "What happens when you run `int('12a')`?",
        options: ["12", "ValueError", "0", "'12a'"],
        answer: 1, why: "'12a' is not a plain number, so int() raises a ValueError." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print("  9 ".strip())', options: ["  9 ", " 9", "9 ", "9"], answer: 3,
      hint: "strip() trims the spaces from both ends." }
  },
  {
    id: "b34", section: "base-camp", track: "beginner", title: "Numbers: Rounding, abs, min/max in Practice",
    explain: "Real programs rarely want a raw number — they want it rounded, made positive, or picked from a group. round() trims decimals, abs() drops the minus sign, and min() / max() pick the smallest or largest value, which covers most everyday number jobs.",
    takeaways: [
      "`round(3.14159, 2)` is `3.14` — the second argument is how many decimals to keep.",
      "`abs(-7)` is `7`: abs() gives the distance from zero, ignoring the sign.",
      "`min()` and `max()` take several values or a list: `max(4, 9, 2)` is `9`.",
      "`round()` with no second argument returns a whole number, e.g. `round(3.6)` is `4`.",
    ],
    code: 'print(round(3.14159, 2))\nprint(round(16.789, 1))\nprint(abs(-7))\nprint(min(4, 9, 2))\nprint(max(4, 9, 2))',
    quiz: [
      { q: "What is `round(2.718, 1)`?",
        options: ["2.7", "3", "2.8", "2.71"],
        answer: 0, why: "Rounding to 1 decimal place keeps the 7, since the next digit is 1." },
      { q: "What is `abs(-12)`?",
        options: ["12", "-12", "0", "Error"],
        answer: 0, why: "abs() drops the sign, so -12 becomes 12." },
      { q: "What is `min([5, 3, 8])`?",
        options: ["3", "8", "5", "1"],
        answer: 0, why: "min() picks the smallest value in the list, which is 3." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(max(3, 11, 7))', options: ["3", "7", "21", "11"], answer: 3,
      hint: "max() picks the largest of the three." }
  },
  {
    id: "b35", section: "base-camp", track: "beginner", title: "Comparisons & Chaining Conditions",
    explain: "Python lets you chain comparisons the way you would say them out loud: `18 <= age < 65` means age is at least 18 AND under 65. The chain is just a neat shortcut for two comparisons joined by and, and it reads far more clearly.",
    takeaways: [
      "`18 <= age < 65` checks both sides at once — it means `18 <= age and age < 65`.",
      "Every link in the chain must be True for the whole thing to be True.",
      "`==` compares values; `=` assigns a value — mixing them up is a classic bug.",
      "Chained comparisons work with any values you can compare, like scores or temperatures.",
    ],
    code: 'age = 25\nprint(18 <= age < 65)\nscore = 85\nprint(80 <= score <= 100)\nprint(1 < 2 < 3)',
    quiz: [
      { q: "What is the value of `5 < 8 < 10`?",
        options: ["None", "True", "False", "Error"],
        answer: 1, why: "Both 5 < 8 and 8 < 10 are True, so the chain is True." },
      { q: "What is the value of `10 <= 10`?",
        options: ["True", "False", "Error", "10"],
        answer: 0, why: "<= means 'less than or equal to', and 10 equals 10." },
      { q: "Which checks that age is between 13 and 19, including both ends?",
        options: ["`age == 13 or age == 19`", "`13 < age < 19`", "`13 <= age < 19`", "`13 <= age <= 19`"],
        answer: 3, why: "<= on both sides includes 13 and 19 themselves." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(2 <= 2 < 5)', options: ["True", "False", "2", "Error"], answer: 0,
      hint: "Both parts of the chain must be true — check each one." }
  },
  {
    id: "b36", section: "base-camp", track: "beginner", title: "Truthiness: What Counts as False?",
    explain: "In an if statement, Python treats more than just False as false. Zero, empty strings, empty lists, empty dicts, and None all count as False — everything else counts as True. Once you know the list, you can write short checks like `if names:` instead of `if len(names) > 0:`.",
    takeaways: [
      "Falsy values: `False`, `0`, `0.0`, `''`, `[]`, `{}`, and `None` — everything else is truthy.",
      "`bool()` shows the truth value: `bool('')` is False, `bool('hi')` is True.",
      "`if names:` is the idiomatic way to check a list is not empty.",
      "Watch out: `[0]` is truthy, because the list is not empty — only the empty list is falsy.",
    ],
    code: 'print(bool(0))\nprint(bool(""))\nprint(bool([]))\nprint(bool("hi"))\nprint(bool([0]))',
    quiz: [
      { q: "Which of these is falsy?",
        options: ["'hi'", "[0]", "1", "0"],
        answer: 3, why: "Zero counts as False; the others are all truthy." },
      { q: "What is `bool('False')`?",
        options: ["True", "False", "Error", "None"],
        answer: 0, why: "It is a non-empty string, and any non-empty string is truthy." },
      { q: "What is `bool([])`?",
        options: ["False", "Error", "[]", "True"],
        answer: 0, why: "An empty list is falsy, so bool() gives False." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(bool(""))', options: ["Error", "False", "True", "''"], answer: 1,
      hint: "An empty string counts as False." }
  },
  {
    id: "b37", section: "base-camp", track: "beginner", title: "while Loops: Sentinels & Menus",
    explain: "A while loop is perfect when you do not know how many rounds you need — like a menu that repeats until the user picks quit. A sentinel is a special value, such as 'done' or 0, that means stop, and the loop keeps going until it shows up.",
    takeaways: [
      "A sentinel is an agreed stop value, e.g. `'done'` or `0`, that ends the loop.",
      "A while loop repeats while its condition is True — check the sentinel in the condition.",
      "Always move toward the sentinel inside the loop, or the loop never ends.",
      "Menus use the same pattern: show options, read a choice, repeat until the choice is quit.",
    ],
    code: 'entries = ["5", "9", "done"]\ntotal = 0\nidx = 0\nwhile entries[idx] != "done":\n    total += int(entries[idx])\n    idx += 1\nprint(total)',
    quiz: [
      { q: "What is a sentinel value?",
        options: ["A special value that signals the loop to stop", "The error message", "The first item in the list", "A loop counter variable"],
        answer: 0, why: "The sentinel is the agreed value that tells the loop it is time to stop." },
      { q: "In a menu loop, when does the loop stop if the sentinel is 'quit'?",
        options: ["It never stops on its own", "When the input equals 'quit'", "When the input is a number", "After exactly 10 rounds"],
        answer: 1, why: "The loop condition checks for the sentinel, so it stops on 'quit'." },
      { q: "What happens if the sentinel value never appears?",
        options: ["It becomes an infinite loop", "The loop is skipped", "The loop runs exactly once", "Python raises an error at once"],
        answer: 0, why: "With no sentinel and no other exit, the while condition stays True forever." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'x = 0\nwhile x < 3:\n    x += 1\nprint(x)', options: ["2", "Error", "0", "3"], answer: 3,
      hint: "The loop stops as soon as x reaches 3." }
  },
  {
    id: "b38", section: "base-camp", track: "beginner", title: "for Loops over Dictionaries",
    explain: "A dictionary holds pairs of keys and values, and a for loop can walk through them in three ways. Looping directly gives you the keys, .values() gives you the values, and .items() gives you both at once — which is the one you will reach for most.",
    takeaways: [
      "`for key in scores:` loops over the keys only.",
      "`for name, score in scores.items():` unpacks each key and value together.",
      "`.keys()` and `.values()` give you just the keys or just the values.",
      "Dictionary order follows insertion order — items come out in the order you added them.",
    ],
    code: 'scores = {"Ava": 9, "Bo": 7, "Al": 8}\nfor name, score in scores.items():\n    print(name, score)\nprint(list(scores.keys()))',
    quiz: [
      { q: "What does `for k in my_dict:` loop over?",
        options: ["Key-value pairs", "Keys", "Nothing", "Values"],
        answer: 1, why: "Looping a dictionary directly yields its keys, one at a time." },
      { q: "What does `.items()` give you?",
        options: ["Only the values", "Only the keys", "Pairs of (key, value)", "A sorted copy"],
        answer: 2, why: "items() yields each key together with its value as a pair." },
      { q: "If `scores = {'Ava': 9, 'Bo': 7}`, what does `scores.values()` hold?",
        options: ["Error", "The scores 9 and 7", "['Ava', 'Bo']", "9"],
        answer: 1, why: "values() gives the values, 9 and 7, without the keys." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'for k in {"a": 1, "b": 2}:\n    print(k)', options: ["1\n2", "a: 1\nb: 2", "a\nb", "Error"], answer: 2,
      hint: "Looping over a dictionary gives you its keys." }
  },
  {
    id: "b39", section: "base-camp", track: "beginner", title: "List Comprehension: A Gentle First Look",
    explain: "A list comprehension builds a new list in a single line: `[n * n for n in nums]` reads as 'give me n squared for every n in nums'. It does exactly what a small for loop with append() does, just more compactly — start with simple ones like this and the pattern will click.",
    takeaways: [
      "`[n * n for n in nums]` makes a NEW list; the original is unchanged.",
      "Read it as: expression first, then the loop — `[n.upper() for n in names]`.",
      "It replaces a loop that only appends to a list — nothing more, nothing less.",
      "Keep comprehensions short; if the logic gets complicated, use a plain loop instead.",
    ],
    code: 'nums = [1, 2, 3, 4]\nsquares = [n * n for n in nums]\nprint(squares)\nnames = ["ava", "bo"]\nprint([n.upper() for n in names])',
    quiz: [
      { q: "What is `[n * 2 for n in [1, 2, 3]]`?",
        options: ["[1, 2, 3]", "[2, 4, 6]", "Error", "[3, 6, 9]"],
        answer: 1, why: "Each item is doubled: 1 becomes 2, 2 becomes 4, 3 becomes 6." },
      { q: "What is a list comprehension, in plain words?",
        options: ["A function definition", "A loop that builds a new list in one line", "A dictionary literal", "A way to delete list items"],
        answer: 1, why: "It is shorthand for a loop that appends each result to a new list." },
      { q: "How many items are in `[x for x in [1, 2]]`?",
        options: ["2", "1", "Error", "3"],
        answer: 0, why: "One output item is produced for each input item, so there are 2." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print([x + 10 for x in [1, 2]])', options: ["[10, 20]", "Error", "[1, 2]", "[11, 12]"], answer: 3,
      hint: "Each item gets 10 added to it." }
  },
  {
    id: "b40", section: "tool-shed", track: "beginner", title: "Dictionaries in Practice: Counting & Grouping",
    explain: "Counting things is one of the most common jobs in programming — votes, words, survey answers — and a dictionary is the natural tool. Each distinct value becomes a key, and the value is how many times you have seen it, with .get() handling the first sighting safely.",
    takeaways: [
      "`counts.get(v, 0)` returns 0 for a key you have not seen yet, so no KeyError.",
      "The counting pattern is: `counts[v] = counts.get(v, 0) + 1`.",
      "Grouping works the same way: the key is the group name, the value is a list or a count.",
      "After the loop, `counts['red']` tells you how many reds there were.",
    ],
    code: 'votes = ["red", "blue", "red", "red", "blue"]\ncounts = {}\nfor v in votes:\n    counts[v] = counts.get(v, 0) + 1\nprint(counts)\nprint(counts["red"])',
    quiz: [
      { q: "If `counts` has no key 'green', what is `counts.get('green', 0)`?",
        options: ["Error", "None", "0", "'green'"],
        answer: 2, why: "get() returns the fallback 0 when the key is missing." },
      { q: "Why use `.get(v, 0)` when counting?",
        options: ["It avoids a KeyError for a key seen the first time", "It deletes the key after counting", "It makes the count start at 1", "It sorts the dictionary"],
        answer: 0, why: "The first sighting has no entry yet, and get() supplies 0 instead of crashing." },
      { q: "After counting `['red', 'blue', 'red', 'red', 'blue']`, what is `counts['blue']`?",
        options: ["1", "5", "2", "3"],
        answer: 2, why: "'blue' appears twice in the list." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'word = "banana"\nc = {}\nfor ch in word:\n    c[ch] = c.get(ch, 0) + 1\nprint(c["a"])', options: ["3", "1", "2", "6"], answer: 0,
      hint: "Count how many times the letter a appears in banana." }
  },
  {
    id: "b41", section: "tool-shed", track: "beginner", title: "Sets in Practice: Deduplication",
    explain: "A set is a collection that refuses to hold duplicates — add the same value twice and it simply stays once. That makes sets the quickest way to clean a list of repeats, or to check whether something has been seen before.",
    takeaways: [
      "`set([3, 1, 3, 2])` is `{1, 2, 3}` — duplicates are dropped automatically.",
      "`len(set(items))` tells you how many DISTINCT values there are.",
      "Sets are unordered, so sort the result with `sorted()` when order matters.",
      "`'Ava' in my_set` is a fast membership check — use it instead of scanning a list.",
    ],
    code: 'nums = [3, 1, 3, 2, 1, 3]\nprint(sorted(set(nums)))\nprint(len(set(nums)))\nnames = {"Ava", "Bo"}\nprint("Ava" in names)',
    quiz: [
      { q: "What is `set([1, 1, 2])`?",
        options: ["Error", "{1, 1, 2}", "{1, 2}", "[1, 1, 2]"],
        answer: 2, why: "A set keeps each value only once, so the duplicate 1 disappears." },
      { q: "Why use `sorted(set(...))` instead of just `set(...)`?",
        options: ["Sets cannot be sorted", "Sets keep their items in order anyway", "Sets have no order, so sorting gives a tidy result", "sorted() removes the duplicates"],
        answer: 2, why: "Set order is not guaranteed, so sorted() arranges the unique values neatly." },
      { q: "What is `len(set('hello'))`?",
        options: ["5", "4", "1", "3"],
        answer: 1, why: "'hello' has the distinct letters h, e, l, o — four in total." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(len(set([1, 2, 2, 3, 3, 3])))', options: ["6", "2", "4", "3"], answer: 3,
      hint: "Duplicates collapse, so only the distinct values are counted." }
  },
  {
    id: "b42", section: "tool-shed", track: "beginner", title: "Tuples in Practice: Returning Multiple Values",
    explain: "A function can only return one thing — but that one thing can be a tuple holding several values. Return `min(nums), max(nums)` and the caller unpacks them into two variables in one line, which is how Python functions hand back a low and a high together.",
    takeaways: [
      "`return min(nums), max(nums)` returns ONE tuple with two values inside.",
      "Unpack on the receiving side: `low, high = min_max([4, 1, 9])`.",
      "The caller can also keep the tuple whole: `result = min_max([5, 2])` is `(2, 5)`.",
      "Return a tuple whenever a function naturally produces two or more related answers.",
    ],
    code: 'def min_max(nums):\n    return min(nums), max(nums)\nlow, high = min_max([4, 1, 9, 3])\nprint(low, high)\nprint(min_max([5, 2]))',
    quiz: [
      { q: "What does `return 2, 3` hand back?",
        options: ["An error", "A tuple (2, 3)", "A list [2, 3]", "Two separate return values"],
        answer: 1, why: "Comma-separated values in a return become a single tuple." },
      { q: "After `a, b = (10, 20)`, what is `a`?",
        options: ["Error", "20", "10", "(10, 20)"],
        answer: 2, why: "Unpacking assigns the first item to a and the second to b." },
      { q: "Why return a tuple from a function?",
        options: ["To make the function run faster", "Because tuples are required in functions", "To hand back several values in one return", "To print several values"],
        answer: 2, why: "One return can only carry one object, and a tuple bundles several values into it." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def swap(a, b):\n    return b, a\nx, y = swap(1, 2)\nprint(x)', options: ["(1, 2)", "Error", "2", "1"], answer: 2,
      hint: "swap returns (2, 1), and x gets the first value." }
  },
  {
    id: "b43", section: "base-camp", track: "beginner", title: "Functions: Return vs Print",
    explain: "Print and return look similar because both show you a value, but they do very different jobs. print() displays a value on the screen and then it is gone; return hands the value back to the caller, who can store it, compare it, or pass it on — which is what you want when a function computes an answer.",
    takeaways: [
      "`return a + b` hands the answer back; `print(a + b)` only shows it.",
      "A function with no return gives back `None` — even if it printed something.",
      "Use return when the caller needs the result; use print when a human needs to see it.",
      "You can do both: return the value AND print a message about it.",
    ],
    code: 'def add(a, b):\n    return a + b\nprint(add(2, 3))\ndef shout(word):\n    print(word.upper())\nresult = shout("hi")\nprint(result)',
    quiz: [
      { q: "What does a function give back if it has no return statement?",
        options: ["None", "Error", "''", "0"],
        answer: 0, why: "Python returns None automatically when a function ends without return." },
      { q: "What is the difference between print() and return inside a function?",
        options: ["print() stores the value in a variable", "They do exactly the same thing", "return prints the value on screen", "print() shows a value; return hands it back so code can use it"],
        answer: 3, why: "print() is for humans to see; return is for the calling code to use." },
      { q: "If `add` returns `a + b`, what is `total = add(2, 3)`?",
        options: ["5", "'5'", "None", "Error"],
        answer: 0, why: "return hands 5 back, and the assignment stores it in total." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def f():\n    print("hi")\nx = f()\nprint(x)', options: ["hi", "None", "hi\nNone", "hi\nhi"], answer: 2,
      hint: "f prints hi, but with no return it gives back None." }
  },
  {
    id: "b44", section: "base-camp", track: "beginner", title: "Functions: Passing Lists & Dicts",
    explain: "When you pass a list or a dictionary to a function, the function receives the very same object — not a copy. So append() or an assignment inside the function changes the caller's data too. That is powerful, but you must do it on purpose, never by accident.",
    takeaways: [
      "Lists and dicts are passed by reference: the function sees the caller's object itself.",
      "`scores.append(30)` inside a function changes the list outside it too.",
      "Assigning a new value to a dict key inside a function also shows up outside.",
      "Pass `my_list.copy()` when the function should work on its own copy.",
    ],
    code: 'def add_score(scores, n):\n    scores.append(n)\nmy_scores = [10, 20]\nadd_score(my_scores, 30)\nprint(my_scores)\ndef set_name(user, name):\n    user["name"] = name\nuser = {"name": "Ava"}\nset_name(user, "Bo")\nprint(user)',
    quiz: [
      { q: "A function appends to a list passed in as an argument. What happens to the list outside?",
        options: ["It is unchanged", "It is deleted", "It becomes an empty list", "It gains the new item"],
        answer: 3, why: "The function appends to the very same list object the caller passed in." },
      { q: "Why does the change show up outside the function?",
        options: ["Python copies every list before passing it", "The function sees the very same list object", "Functions share all their variables", "append() returns a brand-new list"],
        answer: 1, why: "Lists are passed by reference, so caller and function share one object." },
      { q: "How do you pass a list so the function cannot change the original?",
        options: ["scores", "scores.copy()", "str(scores)", "scores[0]"],
        answer: 1, why: "copy() makes a separate list, so appends inside the function stay local." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def add(lst):\n    lst.append(3)\na = [1, 2]\nadd(a)\nprint(a)', options: ["[1, 2]", "Error", "[3]", "[1, 2, 3]"], answer: 3,
      hint: "append() changes the same list the caller passed in." }
  },
  {
    id: "b45", section: "base-camp", track: "beginner", title: "Default Arguments & the Mutable Default Trap",
    explain: "Default arguments are handy, but there is a famous trap: a default list is created ONCE, when the function is defined, and every call without that argument shares the same list. Items from one call leak into the next — the fix is to default to None and build a fresh list inside.",
    takeaways: [
      "A default value is created once at definition time, not fresh on each call.",
      "Sharing a default list makes calls leak into each other — the classic mutable default trap.",
      "The fix: `def add(item, bag=None):` then `if bag is None: bag = []` inside.",
      "Defaults like numbers and strings are safe, because they cannot be changed in place.",
    ],
    code: 'def add_buggy(item, bag=[]):\n    bag.append(item)\n    return bag\nprint(add_buggy("a"))\nprint(add_buggy("b"))\ndef add_fixed(item, bag=None):\n    if bag is None:\n        bag = []\n    bag.append(item)\n    return bag\nprint(add_fixed("a"))\nprint(add_fixed("b"))',
    quiz: [
      { q: "When is a default argument value created?",
        options: ["Fresh on every call", "Only on the first call", "Never — defaults are not stored", "Once, when the function is defined"],
        answer: 3, why: "Python evaluates the default once at definition time and reuses it." },
      { q: "How do you fix the mutable default trap?",
        options: ["Use a tuple as the default", "Use a global list instead", "Use None as the default and create a fresh list inside", "Remove the parameter"],
        answer: 2, why: "None is immutable, and a new list built inside the function is fresh each call." },
      { q: "After `print(add_buggy('a'))` then `print(add_buggy('b'))`, what does the second call return?",
        options: ["[]", "['a', 'b']", "['b']", "Error"],
        answer: 1, why: "Both calls share the one default list, so 'a' is still in it." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def f(x, bag=[]):\n    bag.append(x)\n    return bag\nprint(f(1))\nprint(f(2))', options: ["[1]\n[1, 2]", "Error", "[2]\n[1, 2]", "[1]\n[2]"], answer: 0,
      hint: "The same default list is reused by both calls." }
  },
  {
    id: "b46", section: "base-camp", track: "beginner", title: "Errors You Will Meet: NameError, TypeError, IndexError",
    explain: "Three errors show up in almost every beginner program, and each one points at a different mistake. NameError means you used a name Python has never seen, TypeError means the operation does not fit the types, and IndexError means you asked a list for a position that is not there.",
    takeaways: [
      "`NameError`: a name was never defined, or is misspelled — check the spelling.",
      "`TypeError`: the operation does not work on those types, e.g. `10 + '5'`.",
      "`IndexError`: the list index is out of range, e.g. `[1, 2][5]`.",
      "Read the LAST line of the traceback first — it names the error and the line.",
    ],
    code: 'try:\n    print(10 + "5")\nexcept TypeError:\n    print("TypeError caught")\ntry:\n    print([1, 2][5])\nexcept IndexError:\n    print("IndexError caught")\ntry:\n    print(missing_name)\nexcept NameError:\n    print("NameError caught")',
    quiz: [
      { q: "What error does `print(x)` raise if `x` was never defined?",
        options: ["NameError", "ValueError", "IndexError", "TypeError"],
        answer: 0, why: "Using a name that does not exist is a NameError." },
      { q: "What error does `[1, 2][5]` raise?",
        options: ["NameError", "IndexError", "KeyError", "TypeError"],
        answer: 1, why: "Index 5 is out of range for a 2-item list." },
      { q: "What error does `5 + 'a'` raise?",
        options: ["NameError", "ValueError", "TypeError", "SyntaxError"],
        answer: 2, why: "Adding an int and a str is an operation on the wrong types." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'try:\n    print(unknown)\nexcept NameError:\n    print("oops")', options: ["NameError", "oops", "Error", "unknown"], answer: 1,
      hint: "unknown was never defined, so NameError is raised and caught." }
  },
  {
    id: "b47", section: "tool-shed", track: "beginner", title: "Reading & Writing Text Files: A Gentle Start",
    explain: "Files let your program remember things after it stops running. open() with 'w' creates a file for writing, open() with no mode reads it back, and the with statement closes the file for you — even if something goes wrong in the middle.",
    takeaways: [
      "`open('notes.txt', 'w')` creates the file (or wipes it) for writing.",
      "`open('notes.txt')` opens it for reading; `.read()` returns the whole file as one string.",
      "Always use `with open(...) as f:` — it closes the file for you automatically.",
      "`f.write()` does NOT add a newline; include `'\\n'` yourself when you want one.",
    ],
    code: 'with open("notes.txt", "w") as f:\n    f.write("Hello, Ava!\\n")\n    f.write("Python is fun.\\n")\nwith open("notes.txt") as f:\n    print(f.read())',
    quiz: [
      { q: "What does opening a file with mode 'w' do?",
        options: ["Reads the file only", "Deletes the file", "Appends to the end", "Creates or overwrites the file for writing"],
        answer: 3, why: "'w' opens the file for writing, creating it or wiping its old contents." },
      { q: "Why use `with open(...) as f:`?",
        options: ["It creates the file if missing", "It prints the contents", "It closes the file automatically, even if an error happens", "It makes reading faster"],
        answer: 2, why: "The with block guarantees the file is closed when the block ends." },
      { q: "What does `f.read()` return?",
        options: ["The whole file as one string", "A list of lines", "True or False", "Only the first line"],
        answer: 0, why: "read() with no arguments returns the entire file contents as a single string." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'with open("t.txt", "w") as f:\n    f.write("abc")\nwith open("t.txt") as f:\n    print(f.read())', options: ["t.txt", "abc", "'abc'", "Error"], answer: 1,
      hint: "read() returns the contents that were written." }
  },
  {
    id: "b48", section: "base-camp", track: "beginner", title: "The math Module: Everyday Helpers",
    explain: "The math module is a small toolbox for numbers you will use constantly: sqrt() for square roots, ceil() and floor() for rounding up or down, and constants like pi. Import it once, and these helpers are ready whenever a calculation needs them.",
    takeaways: [
      "`math.sqrt(16)` is `4.0` — square roots always come back as floats.",
      "`math.ceil(4.2)` is `5` (rounds up) and `math.floor(4.8)` is `4` (rounds down).",
      "`math.pi` is 3.14159... — use it instead of typing 3.14 yourself.",
      "Always `import math` first; the helpers live inside the module, not built in.",
    ],
    code: 'import math\nprint(math.sqrt(16))\nprint(math.ceil(4.2))\nprint(math.floor(4.8))\nprint(round(math.pi, 2))',
    quiz: [
      { q: "What is `math.sqrt(25)`?",
        options: ["Error", "25", "5", "5.0"],
        answer: 3, why: "sqrt() returns a float, so the square root of 25 is 5.0." },
      { q: "What is `math.ceil(3.1)`?",
        options: ["3", "3.1", "0", "4"],
        answer: 3, why: "ceil() rounds UP to the next whole number, which is 4." },
      { q: "What is `math.pi` approximately?",
        options: ["2.71", "0", "1.61", "3.14"],
        answer: 3, why: "pi is about 3.14159, so 3.14 is the closest choice." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import math\nprint(math.floor(9.9))', options: ["Error", "10", "9.9", "9"], answer: 3,
      hint: "floor() always rounds down to the whole number below." }
  },
  {
    id: "b49", section: "base-camp", track: "beginner", title: "The string Module & Constants",
    explain: "The string module holds ready-made constants so you never have to type the alphabet or the digits by hand. string.ascii_lowercase, string.ascii_uppercase, string.digits, and string.punctuation are the four you will use most — for validation, passwords, and text checks.",
    takeaways: [
      "`string.ascii_lowercase` is `'abcdefghijklmnopqrstuvwxyz'`.",
      "`string.digits` is `'0123456789'` and `string.punctuation` holds all the symbols.",
      "`string.capwords('hello world')` gives `'Hello World'` — handy for tidying titles.",
      "Use these constants instead of typing character lists yourself — fewer typos.",
    ],
    code: 'import string\nprint(string.ascii_lowercase[:5])\nprint(string.digits)\nprint(string.punctuation[:4])\nprint(string.capwords("hello world"))',
    quiz: [
      { q: "What is `string.digits`?",
        options: ["'abcdef'", "'0123456789'", "'!@#'", "'ABC'"],
        answer: 1, why: "digits is the string of all ten decimal digits." },
      { q: "What does `string.ascii_uppercase` start with?",
        options: ["'123'", "'abc'", "'ABC'", "'XYZ'"],
        answer: 2, why: "It is the uppercase alphabet, starting with A, B, C." },
      { q: "What is `string.capwords('hi there')`?",
        options: ["'HI THERE'", "'hi there'", "'Hi There'", "'Hi there'"],
        answer: 2, why: "capwords() capitalizes the first letter of every word." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import string\nprint(string.ascii_lowercase[0])', options: ["A", "0", "a", "Error"], answer: 2,
      hint: "The lowercase alphabet starts with a." }
  },
  {
    id: "b50", section: "base-camp", track: "beginner", title: "Guided Project: Number Guessing Game",
    explain: "This project pulls together everything in the beginner track: a secret number, a loop over guesses, if/elif/else hints, and a break when the player wins. Follow the shape below, then make it yours — in the real game the secret comes from random.randint(1, 10) so every round is different.",
    takeaways: [
      "Pick the secret first — in the real game use `random.randint(1, 10)` for a fresh one each round.",
      "Compare each guess: too low means guess higher, too high means guess lower.",
      "`break` stops the loop the moment the player wins — no extra guesses.",
      "Count tries as you go, so the win message can say how many guesses it took.",
    ],
    code: 'secret = 7\nguesses = [3, 9, 7]\ntries = 0\nfor guess in guesses:\n    tries += 1\n    if guess < secret:\n        print(guess, "too low")\n    elif guess > secret:\n        print(guess, "too high")\n    else:\n        print("You win in", tries, "tries!")\n        break',
    quiz: [
      { q: "What makes the game different every time you play it?",
        options: ["Picking a fresh secret with random.randint(1, 10) each game", "Printing the secret at the start", "Hard-coding the secret as 7", "Using a for loop"],
        answer: 0, why: "randint() picks a new secret number each game, so no two rounds are alike." },
      { q: "Why use `break` after the player guesses correctly?",
        options: ["To stop the loop once the game is won", "To print the secret", "To count the tries", "To start a new game"],
        answer: 0, why: "The game is over, so break ends the loop instead of asking for more guesses." },
      { q: "A guess is smaller than the secret. What should the game say?",
        options: ["Too low — guess higher", "Too high — guess lower", "Correct — you win", "Game over"],
        answer: 0, why: "A smaller guess is too low, so the player should try a bigger number." },
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'secret = 5\nfor guess in [5]:\n    if guess == secret:\n        print("You win!")', options: ["Too low", "Nothing prints", "You win!", "Too high"], answer: 2,
      hint: "The guess equals the secret, so the win branch runs." }
  },
{
    id: "b51", section: "base-camp", track: "beginner", title: "Guided Project: Simple Quiz App",
    explain: "A quiz app is a list of questions, a loop that asks each one, and a score that grows with every right answer. Store each question as a dictionary with the question text and its correct answer, then compare the player's answer with the stored one.",
    takeaways: [
      "Store each question as a dict like `{\"question\": ..., \"answer\": ...}` inside a list.",
      "Loop over the questions and compare the player's answer with `q[\"answer\"]`.",
      "Keep a `score` counter and print it as `score/len(questions)` at the end."
    ],
    code: 'questions = [{"question": "What is 2 + 3?", "answer": "5"}, {"question": "Capital of France?", "answer": "Paris"}]\nanswers = ["5", "London"]\nscore = 0\nfor q, a in zip(questions, answers):\n    if a == q["answer"]:\n        score += 1\nprint(f"Score: {score}/{len(questions)}")',
    quiz: [
      { q: "How should you store the questions in a quiz app?",
        options: ["A single string with all questions joined together", "A list of dicts, one per question with its answer", "A set of answers only", "A tuple of numbers"],
        answer: 1, why: "Each question needs its text and its correct answer together, so a list of dicts is the natural fit." },
      { q: "If a player answers 2 of 3 questions correctly, what is the score?",
        options: ["1", "2", "3", "0"],
        answer: 1, why: "The score counts correct answers, and 2 of the 3 were right." },
      { q: "Why compare the player's answer with the stored answer?",
        options: ["To make the program run faster", "To sort the questions alphabetically", "To decide whether the answer is correct and add to the score", "To delete the question from the list"],
        answer: 2, why: "The comparison is the check itself: a match means the answer was right." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'questions = [{"question": "What is 2 + 2?", "answer": "4"}, {"question": "Capital of France?", "answer": "Paris"}]\nanswers = ["4", "Paris"]\nscore = sum(1 for q, a in zip(questions, answers) if a == q["answer"])\nprint(f"{score}/{len(questions)}")', options: ["2/2", "1/2", "0/2", "Score: 2"], answer: 0,
      hint: "Both answers match their stored answers, so both count." }
  },
  {
    id: "b52", section: "base-camp", track: "beginner", title: "Guided Project: Rock, Paper, Scissors",
    explain: "Rock, Paper, Scissors is a small game with three rules: rock beats scissors, scissors beats paper, and paper beats rock. The computer picks with random.choice(), and a helper function decides the winner from the two choices.",
    takeaways: [
      "`random.choice([\"rock\", \"paper\", \"scissors\"])` picks the computer's move.",
      "A `winner(you, computer)` function keeps the rules in one place instead of scattered ifs.",
      "Check for a draw first, then the three winning pairs, and let anything else mean the computer wins."
    ],
    code: 'import random\n\ndef winner(you, computer):\n    if you == computer:\n        return "Draw!"\n    if (you, computer) in [("rock", "scissors"), ("paper", "rock"), ("scissors", "paper")]:\n        return "You win!"\n    return "Computer wins!"\n\nrandom.seed(3)\nyou = "rock"\ncomputer = random.choice(["rock", "paper", "scissors"])\nprint("You:", you)\nprint("Computer:", computer)\nprint(winner(you, computer))',
    quiz: [
      { q: "Which move beats rock?",
        options: ["Scissors", "Paper", "Rock", "None of them"],
        answer: 1, why: "Paper covers rock, so paper beats rock." },
      { q: "How does the computer pick its move?",
        options: ["With random.choice() from the three moves", "By asking the player", "By always picking rock", "With random.shuffle()"],
        answer: 0, why: "choice() picks one item from the list of moves at random." },
      { q: "What should the winner function return when both players pick paper?",
        options: ["You win!", "Computer wins!", "Draw!", "An error"],
        answer: 2, why: "Equal moves are a draw, so that check comes first." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def winner(you, computer):\n    if you == computer:\n        return "Draw!"\n    if (you, computer) in [("rock", "scissors"), ("paper", "rock"), ("scissors", "paper")]:\n        return "You win!"\n    return "Computer wins!"\n\nprint(winner("paper", "rock"))', options: ["Computer wins!", "Draw!", "You win!", "Error"], answer: 2,
      hint: "Paper covers rock — which of the three winning pairs is that?" }
  },
  {
    id: "b53", section: "base-camp", track: "beginner", title: "Guided Project: Password Generator",
    explain: "A password generator builds a string by picking random characters, one at a time, from a pool of letters and digits. random.choice() picks one character, and a loop (or a short comprehension) repeats that for the length you want.",
    takeaways: [
      "`string.ascii_letters + string.digits` is a handy pool of characters to pick from.",
      "`random.choice(pool)` picks one random character; repeat it to build the password.",
      "`\"\".join(...)` glues the picked characters into a single string."
    ],
    code: 'import random\nimport string\n\nrandom.seed(7)\nchars = string.ascii_letters + string.digits\npassword = "".join(random.choice(chars) for _ in range(8))\nprint(password)\nprint(len(password))',
    quiz: [
      { q: "What does `random.choice(chars)` return?",
        options: ["The whole password", "A shuffled copy of chars", "One random character from chars", "A random number"],
        answer: 2, why: "choice() picks exactly one item from the sequence you give it." },
      { q: "How do you turn 8 picked characters into one password string?",
        options: ["With .split()", "With .upper()", "With len()", "With \"\".join(...)"],
        answer: 3, why: "join() glues the characters together with no separator between them." },
      { q: "What is `len(password)` if the password was built with `range(8)`?",
        options: ["7", "9", "8", "It varies each run"],
        answer: 2, why: "range(8) picks exactly 8 characters, so the password is 8 long." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import random\nimport string\nrandom.seed(7)\npassword = "".join(random.choice(string.ascii_letters) for _ in range(10))\nprint(len(password))', options: ["10", "8", "0", "Error"], answer: 0,
      hint: "Count how many times the loop picks a character." }
  },
  {
    id: "b54", section: "base-camp", track: "beginner", title: "Guided Project: Simple Calculator with Functions",
    explain: "A calculator is cleaner when each operation is its own small function: add, subtract, multiply and divide each take two numbers and return the result. The main code then just calls the right function instead of repeating arithmetic everywhere.",
    takeaways: [
      "One small function per operation (`add`, `subtract`, `multiply`, `divide`) keeps the calculator organised.",
      "Each function should `return` its result so the caller can print it or use it further.",
      "Calling `divide(6, 3)` gives `2.0` because `/` always returns a float."
    ],
    code: 'def add(a, b):\n    return a + b\n\ndef subtract(a, b):\n    return a - b\n\ndef multiply(a, b):\n    return a * b\n\ndef divide(a, b):\n    return a / b\n\nprint(add(6, 3))\nprint(multiply(6, 3))\nprint(divide(6, 3))',
    quiz: [
      { q: "Why write a separate function for each operation?",
        options: ["So each operation is named, testable and reusable", "So the program runs faster", "Because Python requires it", "So the numbers become strings"],
        answer: 0, why: "Small named functions are easier to understand, test and reuse than repeated arithmetic." },
      { q: "What does `divide(6, 3)` return?",
        options: ["2", "2.0", "3", "18"],
        answer: 1, why: "The / operator always returns a float, even when the result is a whole number." },
      { q: "What happens if a calculator function uses `print` instead of `return`?",
        options: ["The caller cannot use the result in further maths", "The result becomes a string", "The function runs twice", "Nothing changes"],
        answer: 0, why: "print only shows the value; return hands it back so the caller can store or combine it." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def multiply(a, b):\n    return a * b\n\nprint(multiply(3, 4))', options: ["7", "34", "Error", "12"], answer: 3,
      hint: "multiply returns a times b — work out 3 times 4." }
  },
  {
    id: "b55", section: "base-camp", track: "beginner", title: "Guided Project: Word Counter Script",
    explain: "A word counter turns text into a list of words with split(), then counts them. len(words) is the total, len(set(words)) is the number of unique words, and words.count(\"python\") tells you how often one word appears.",
    takeaways: [
      "`text.split()` breaks text into a list of words, splitting on whitespace.",
      "`len(words)` is the total word count; `len(set(words))` counts unique words.",
      "`words.count(\"python\")` counts how many times one word appears — lower the text first so \"Python\" and \"python\" match."
    ],
    code: 'text = "Python is fun and Python is useful"\nwords = text.lower().split()\nprint("Words:", len(words))\nprint("Unique:", len(set(words)))\nprint("Python appears:", words.count("python"))',
    quiz: [
      { q: "What does `\"hello world\".split()` return?",
        options: ["['hello', 'world']", "'hello world'", "['hello world']", "2"],
        answer: 0, why: "split() cuts the string at whitespace into a list of two words." },
      { q: "How do you count the unique words in a list called `words`?",
        options: ["len(set(words))", "len(words) + 1", "words.count()", "set(words) - 1"],
        answer: 0, why: "A set drops duplicates, so its length is the number of distinct words." },
      { q: "Why call `.lower()` before counting the word \"python\"?",
        options: ["So \"Python\" and \"python\" count as the same word", "To make the text shorter", "To remove spaces", "To sort the words"],
        answer: 0, why: "Without lowercasing, \"Python\" and \"python\" are different strings and would be counted separately." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'text = "one two two three"\nwords = text.split()\nprint(len(set(words)))', options: ["4", "2", "3", "1"], answer: 2,
      hint: "The set drops the repeated word — how many distinct words are left?" }
  },
  {
    id: "b56", section: "tool-shed", track: "beginner", title: "Lists of Dictionaries: Tiny Address Book",
    explain: "A list of dictionaries is a simple way to store records: each dictionary is one person, with keys like name and phone, and the list holds them all. You add a record with append(), and you find one by looping and checking a key.",
    takeaways: [
      "Each record is a dict (`{\"name\": ..., \"phone\": ...}`) and the list holds all records.",
      "`contacts.append({...})` adds a new person to the address book.",
      "To find someone, loop over the list and check `c[\"name\"] == \"Ava\"`."
    ],
    code: 'contacts = [{"name": "Ava", "phone": "555-0101"}, {"name": "Bo", "phone": "555-0102"}]\ncontacts.append({"name": "Al", "phone": "555-0103"})\nfor c in contacts:\n    print(c["name"], c["phone"])\nprint("Total:", len(contacts))',
    quiz: [
      { q: "How is one person stored in this address book?",
        options: ["As a plain string", "As a tuple of numbers", "As a set of phones", "As a dict with name and phone keys"],
        answer: 3, why: "Each person is a dict so their name and phone stay together as one record." },
      { q: "How do you add a new contact to the list?",
        options: ["contacts.add({...})", "contacts.append({...})", "contacts.insert() with no arguments", "contacts + 1"],
        answer: 1, why: "append() adds one new item — here, one new dict — to the end of the list." },
      { q: "After the code runs, what is `len(contacts)`?",
        options: ["3", "2", "4", "1"],
        answer: 0, why: "It starts with 2 contacts and append() adds a third." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'contacts = [{"name": "Ava", "phone": "555-0101"}, {"name": "Bo", "phone": "555-0102"}]\nprint(contacts[1]["name"])', options: ["Ava", "Bo", "555-0102", "Error"], answer: 1,
      hint: "Index 1 is the second item, and [\"name\"] picks its name." }
  },
  {
    id: "b57", section: "tool-shed", track: "beginner", title: "Sorting Simple Data with sorted()",
    explain: "sorted() takes a list and returns a new list in order — numbers smallest first, strings alphabetically — without changing the original. Add reverse=True to flip the order, and use the key argument when you want to sort by something derived, like length.",
    takeaways: [
      "`sorted([3, 1, 2])` returns `[1, 2, 3]` and leaves the original list unchanged.",
      "`sorted(names, reverse=True)` sorts from Z to A instead of A to Z.",
      "`sorted(words, key=len)` sorts by word length — `key` says what to compare."
    ],
    code: 'nums = [5, 2, 9, 1]\nprint(sorted(nums))\nprint(sorted(nums, reverse=True))\nprint(nums)\nprint(sorted(["Zoe", "Ana", "Max"]))',
    quiz: [
      { q: "What does `sorted([3, 1, 2])` return?",
        options: ["[3, 1, 2]", "[3, 2, 1]", "[1, 2, 3]", "None"],
        answer: 2, why: "sorted() returns a new list in ascending order." },
      { q: "Does `sorted(nums)` change `nums` itself?",
        options: ["Yes, it sorts nums in place", "It empties nums", "It reverses nums", "No — it returns a new list and leaves nums unchanged"],
        answer: 3, why: "sorted() builds and returns a fresh list; the original is untouched." },
      { q: "What does `sorted([\"bb\", \"a\", \"ccc\"], key=len)` give?",
        options: ["['a', 'bb', 'ccc']", "['ccc', 'bb', 'a']", "['a', 'ccc', 'bb']", "['bb', 'a', 'ccc']"],
        answer: 0, why: "key=len compares by length, so the 1-letter word comes first, then 2, then 3." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(sorted([3, 1, 2]))', options: ["[1, 2, 3]", "[3, 1, 2]", "[2, 1, 3]", "None"], answer: 0,
      hint: "sorted() returns the numbers in ascending order." }
  },
  {
    id: "b58", section: "tool-shed", track: "beginner", title: "min/max with key: Picking Winners",
    explain: "min() and max() find the smallest and largest items, but with a key function they can compare by something inside each item — like a player's score inside a dictionary. max(players, key=lambda p: p[\"score\"]) returns the whole winning dict, not just the number.",
    takeaways: [
      "`max(players, key=lambda p: p[\"score\"])` returns the player dict with the highest score.",
      "`key` tells min/max WHAT to compare — without it, Python would try to compare the dicts themselves and fail.",
      "The result is the whole item, so use `[\"name\"]` on it to get the winner's name."
    ],
    code: 'players = [{"name": "Ava", "score": 88}, {"name": "Bo", "score": 95}, {"name": "Al", "score": 79}]\nbest = max(players, key=lambda p: p["score"])\nprint(best["name"], best["score"])\nlowest = min(players, key=lambda p: p["score"])\nprint(lowest["name"], lowest["score"])',
    quiz: [
      { q: "What does `max(players, key=lambda p: p[\"score\"])` return?",
        options: ["The highest score number", "The whole player dict with the highest score", "The player's name only", "A sorted list of players"],
        answer: 1, why: "max() returns the winning item itself — the full dict — not just the key value." },
      { q: "Why is the `key` argument needed here?",
        options: ["Because dicts cannot be compared directly", "Because max() only works on numbers", "To sort the list first", "To convert scores to strings"],
        answer: 0, why: "Python cannot decide which dict is bigger, so key says to compare by score." },
      { q: "Who has the lowest score among Ava 88, Bo 95 and Al 79?",
        options: ["Ava", "Bo", "Al", "They are tied"],
        answer: 2, why: "79 is the smallest of the three scores, and it belongs to Al." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'players = [{"name": "A", "score": 10}, {"name": "B", "score": 20}]\nprint(max(players, key=lambda p: p["score"])["name"])', options: ["A", "20", "10", "B"], answer: 3,
      hint: "The highest score is 20 — whose name goes with it?" }
  },
  {
    id: "b59", section: "tool-shed", track: "beginner", title: "any() & all(): Quick Checks",
    explain: "any() asks 'is at least one of these True?' and all() asks 'are ALL of these True?' — both take a list of True/False values (often made with a generator expression) and give you a single True or False answer for the whole group.",
    takeaways: [
      "`any(...)` is True if at least ONE item is True; `all(...)` needs EVERY item True.",
      "A generator like `(s >= 90 for s in scores)` builds the True/False values to check.",
      "Use `any()` for 'did anyone pass?' and `all()` for 'did everyone pass?'."
    ],
    code: 'scores = [72, 85, 90]\nprint(any(s >= 90 for s in scores))\nprint(all(s >= 50 for s in scores))\nprint(all(s >= 90 for s in scores))',
    quiz: [
      { q: "What does `any([False, True, False])` return?",
        options: ["False", "None", "True", "Error"],
        answer: 2, why: "any() only needs one True, and the middle item is True." },
      { q: "What does `all([True, True, False])` return?",
        options: ["True", "False", "None", "Error"],
        answer: 1, why: "all() needs every item True, but the last one is False." },
      { q: "For scores [72, 85, 90], what is `any(s >= 90 for s in scores)`?",
        options: ["False", "90", "3", "True"],
        answer: 3, why: "90 is >= 90, so at least one score passes the check." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(all([True, True, False]))', options: ["False", "True", "None", "Error"], answer: 0,
      hint: "all() needs every single item to be True." }
  },
  {
    id: "b60", section: "tool-shed", track: "beginner", title: "zip() in Practice: Pairing Data",
    explain: "zip() pairs items from two lists position by position: the first name with the first score, the second with the second, and so on. Loop over the pairs to print them together, or turn them into a dictionary with dict(zip(...)).",
    takeaways: [
      "`zip(names, scores)` pairs the first item of each list, then the second, and so on.",
      "`for name, score in zip(names, scores):` unpacks each pair straight into two variables.",
      "`dict(zip(names, scores))` builds a name-to-score dictionary from the pairs."
    ],
    code: 'names = ["Ava", "Bo", "Al"]\nscores = [88, 95, 79]\nfor name, score in zip(names, scores):\n    print(name, score)\npaired = dict(zip(names, scores))\nprint(paired["Bo"])',
    quiz: [
      { q: "What does `zip([\"a\", \"b\"], [1, 2])` produce?",
        options: ["['a', 'b', 1, 2]", "[('a', 'b'), (1, 2)]", "[('a', 1), ('b', 2)]", "Error"],
        answer: 2, why: "zip() pairs items by position: a with 1, and b with 2." },
      { q: "If the lists have different lengths, what does zip() do?",
        options: ["It fills the gaps with None", "It stops at the end of the shorter list", "It raises an error", "It repeats the shorter list"],
        answer: 1, why: "zip() stops as soon as the shortest input runs out of items." },
      { q: "How do you make a dictionary from two lists, `names` and `scores`?",
        options: ["dict(zip(names, scores))", "zip(names + scores)", "{names: scores}", "dict(names, scores)"],
        answer: 0, why: "zip() makes the pairs, and dict() turns each pair into a key-value entry." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(list(zip(["a", "b"], [1, 2])))', options: ["['a', 'b', 1, 2]", "[('a', 'b'), (1, 2)]", "[('a', 1), ('b', 2)]", "Error"], answer: 2,
      hint: "Pair the first items together, then the second items." }
  },
  {
    id: "b61", section: "tool-shed", track: "beginner", title: "enumerate() in Practice: Numbered Lists",
    explain: "enumerate() loops over a list and hands you both the position and the item, so you can print numbered lists without counting by hand. By default counting starts at 0, but start=1 gives you human-friendly numbering.",
    takeaways: [
      "`for i, task in enumerate(tasks):` gives you the index AND the item in one loop.",
      "Counting starts at 0 unless you pass `start=1`.",
      "Use enumerate() whenever the position matters — numbered lists, rankings, line numbers."
    ],
    code: 'tasks = ["Buy milk", "Call Ava", "Read"]\nfor i, task in enumerate(tasks, start=1):\n    print(f"{i}. {task}")',
    quiz: [
      { q: "What does `enumerate([\"a\", \"b\"])` give on its first iteration?",
        options: ["(1, 'a')", "('a', 0)", "'a'", "(0, 'a')"],
        answer: 3, why: "enumerate() starts counting at 0 by default, so the first pair is (0, 'a')." },
      { q: "How do you number a list starting from 1?",
        options: ["enumerate(tasks, start=0)", "enumerate(tasks) + 1", "enumerate(tasks, start=1)", "range(tasks, 1)"],
        answer: 2, why: "The start keyword sets the first index to 1." },
      { q: "Why use enumerate() instead of a manual counter variable?",
        options: ["It is shorter and cannot drift out of sync with the loop", "It runs faster than any loop", "It sorts the list", "It removes duplicates"],
        answer: 0, why: "enumerate() handles the counting for you, so there is no counter to forget to update." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(list(enumerate(["x", "y"], start=1)))', options: ["[(0, 'x'), (1, 'y')]", "[(1, 'x'), (2, 'y')]", "['x', 'y']", "Error"], answer: 1,
      hint: "start=1 means the first index is 1, not 0." }
  },
  {
    id: "b62", section: "base-camp", track: "beginner", title: "Working with Dates: Birthdays & Deadlines",
    explain: "Subtracting one date from another gives a timedelta, and its .days tells you how many days are between them — perfect for counting down to a birthday or an exam. strftime() then formats a date into a readable string like '20 Nov 2026'.",
    takeaways: [
      "`date(2026, 11, 20) - date(2026, 11, 5)` is a timedelta; `.days` gives 15.",
      "`date.today()` gives today's real date; use it instead of a fixed date in real programs.",
      "`birthday.strftime(\"%d %b %Y\")` formats a date as '20 Nov 2026'."
    ],
    code: 'from datetime import date\ntoday = date(2026, 11, 5)\nbirthday = date(2026, 11, 20)\nprint("Days until birthday:", (birthday - today).days)\ndeadline = date(2026, 11, 12)\nprint("Days until exam:", (deadline - today).days)\nprint(birthday.strftime("%d %b %Y"))',
    quiz: [
      { q: "What is `(date(2026, 11, 10) - date(2026, 11, 5)).days`?",
        options: ["15", "5", "10", "Error"],
        answer: 1, why: "10 November is 5 days after 5 November." },
      { q: "What does `date.today()` return?",
        options: ["Today's date as a date object", "Today's date as a string", "The current time only", "The number of days in the month"],
        answer: 0, why: "It returns a date object for today, which you can format or do maths with." },
      { q: "What does `date(2026, 11, 20).strftime(\"%d %b %Y\")` produce?",
        options: ["'20 Nov 2026'", "'2026-11-20'", "'Nov 20'", "'20/11/2026'"],
        answer: 0, why: "%d is the day, %b the short month name, and %Y the four-digit year." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from datetime import date\nprint((date(2026, 11, 10) - date(2026, 11, 5)).days)', options: ["15", "5", "10", "Error"], answer: 1,
      hint: "Count the days from the 5th to the 10th." }
  },
  {
    id: "b63", section: "base-camp", track: "beginner", title: "Time Delays & Timers with time",
    explain: "time.sleep(seconds) pauses your program for that long — handy for countdowns, retries and rate limits. time.time() returns the current time as a number of seconds, so subtracting a start time from an end time tells you how long something took.",
    takeaways: [
      "`time.sleep(0.2)` pauses the program for about 0.2 seconds.",
      "`time.time()` returns seconds since 1970; `end - start` is the elapsed time.",
      "`time.sleep()` returns None — it pauses, it does not give you a value."
    ],
    code: 'import time\nstart = time.time()\nprint("Start")\ntime.sleep(0.2)\nprint("End")\nprint("Elapsed:", round(time.time() - start, 1))',
    quiz: [
      { q: "What does `time.sleep(1)` do?",
        options: ["Pauses the program for about 1 second", "Stops the program forever", "Returns the current time", "Prints the time"],
        answer: 0, why: "sleep() waits for the given number of seconds, then lets the program continue." },
      { q: "How do you measure how long a piece of code took?",
        options: ["Record time.time() before and after, then subtract", "Call time.sleep() twice", "Use time.now()", "Count the lines of code"],
        answer: 0, why: "The difference between the two timestamps is the elapsed time." },
      { q: "What does `time.sleep(0.2)` return?",
        options: ["0.2", "None", "True", "The current time"],
        answer: 1, why: "sleep() only pauses; like most functions that just do something, it returns None." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import time\nprint(time.sleep(0.1) is None)', options: ["False", "0.1", "True", "Error"], answer: 2,
      hint: "sleep() pauses and returns nothing — what does a function that returns nothing give back?" }
  },
  {
    id: "b64", section: "base-camp", track: "beginner", title: "Command-Line Arguments Basics (sys.argv)",
    explain: "When you run `python greet.py Ava`, Python puts the words after the script name into sys.argv — a list where argv[0] is the script's own name and argv[1] is the first real argument. Always check len(sys.argv) before reading argv[1], or the program crashes when run with no arguments.",
    takeaways: [
      "`sys.argv` is a list of the words typed after `python script.py`.",
      "`sys.argv[0]` is the script name; the first real argument is `sys.argv[1]`.",
      "Guard with `if len(sys.argv) > 1` and fall back to a default when no argument was given."
    ],
    code: 'import sys\nname = sys.argv[1] if len(sys.argv) > 1 else "friend"\nprint(f"Hello, {name}!")\nprint("Arguments:", len(sys.argv))',
    quiz: [
      { q: "If you run `python greet.py Ava`, what is `sys.argv[1]`?",
        options: ["'Ava'", "'greet.py'", "'python'", "1"],
        answer: 0, why: "argv[0] is the script name, so argv[1] is the first argument after it." },
      { q: "What is `sys.argv[0]`?",
        options: ["The first argument", "The script's own name", "The Python version", "The number of arguments"],
        answer: 1, why: "Python always puts the script filename in argv[0]." },
      { q: "What happens if you read `sys.argv[1]` when the program was run with no arguments?",
        options: ["It returns None", "It returns an empty string", "It raises IndexError", "It waits for input"],
        answer: 2, why: "With no arguments the list has only argv[0], so index 1 does not exist." }
    ],
    challenge: { type: "predict", prompt: "What will this print when run with NO arguments?",
      code: 'import sys\nname = sys.argv[1] if len(sys.argv) > 1 else "guest"\nprint(name)', options: ["guest", "IndexError", "friend", "None"], answer: 0,
      hint: "With no arguments, len(sys.argv) is 1 — so which branch runs?" }
  },
  {
    id: "b65", section: "base-camp", track: "beginner", title: "Environment Variables & Secrets Basics",
    explain: "Environment variables are settings that live outside your code — like which mode your app runs in — so the same code behaves differently on your laptop and on a server. Secrets like API keys belong there too, never written into your code, because code gets shared and secrets must not.",
    takeaways: [
      "`os.environ.get(\"APP_MODE\", \"development\")` reads a setting, falling back to \"development\" if it is not set.",
      "Never hard-code a secret in your code — read it from an environment variable instead.",
      "`\"MY_API_KEY\" in os.environ` tells you whether a variable is set at all."
    ],
    code: 'import os\nmode = os.environ.get("APP_MODE", "development")\nprint("Mode:", mode)\nprint("Has API key:", "MY_API_KEY" in os.environ)',
    quiz: [
      { q: "What does `os.environ.get(\"APP_MODE\", \"development\")` return when APP_MODE is not set?",
        options: ["None", "An error", "\"development\"", "\"APP_MODE\""],
        answer: 2, why: "get() returns the default you supplied when the variable is missing." },
      { q: "Where should an API key live?",
        options: ["In an environment variable, outside the code", "Hard-coded at the top of the file", "In a comment", "In the file name"],
        answer: 0, why: "Code gets shared and published; a key in the code leaks the moment it does." },
      { q: "How do you check whether a variable called MY_API_KEY is set?",
        options: ["\"MY_API_KEY\" in os.environ", "os.environ.get() with no arguments", "import MY_API_KEY", "os.getenv() with no arguments"],
        answer: 0, why: "os.environ behaves like a dict, so `in` tests whether the key exists." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import os\nprint(os.environ.get("DOES_NOT_EXIST", "fallback"))', options: ["None", "DOES_NOT_EXIST", "Error", "fallback"], answer: 3,
      hint: "The variable is not set, so get() returns the second argument." }
  },
  {
    id: "b66", section: "tool-shed", track: "beginner", title: "JSON Basics: Saving Your Data",
    explain: "JSON is the plain-text format programs use to save and swap structured data — dictionaries become {\"name\": \"Ava\"} text that any language can read. json.dump() writes a dict to a file, json.load() reads it back, and json.dumps()/json.loads() do the same with strings.",
    takeaways: [
      "`json.dump(data, f)` saves a dict to a file; `json.load(f)` reads it back into a dict.",
      "`json.dumps(data)` turns a dict into a JSON string; `json.loads(text)` parses one back.",
      "JSON keys are always strings, and values are strings, numbers, booleans, lists or dicts."
    ],
    code: 'import json\ndata = {"name": "Ava", "score": 90, "passed": True}\nwith open("scores.json", "w") as f:\n    json.dump(data, f)\nwith open("scores.json") as f:\n    loaded = json.load(f)\nprint(loaded["name"], loaded["score"])',
    quiz: [
      { q: "Which function writes a dict to a JSON file?",
        options: ["json.load()", "json.loads()", "json.dump(data, f)", "json.read()"],
        answer: 2, why: "dump() (with a p) writes to a file; load() reads from one." },
      { q: "What does `json.loads('{\"score\": 42}')` return?",
        options: ["The string '{\"score\": 42}'", "The dict {\"score\": 42}", "The number 42", "A file object"],
        answer: 1, why: "loads() parses a JSON string back into a Python dict." },
      { q: "After saving and loading, what type is `loaded[\"score\"]`?",
        options: ["int", "str", "list", "bool"],
        answer: 0, why: "JSON numbers come back as Python ints, so 90 stays an int." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import json\nprint(json.loads(\'{"score": 42}\')["score"])', options: ["42", "'42'", "{'score': 42}", "Error"], answer: 0,
      hint: "loads() parses the text, then [\"score\"] picks the value — a number, not a string." }
  },
  {
    id: "b67", section: "base-camp", track: "beginner", title: "Debugging with print(): A Systematic Approach",
    explain: "Debugging with print() means placing prints on purpose: one before a suspicious step showing the inputs, and one after showing the result. When the printed values stop matching what you expected, you have found the exact line where things went wrong.",
    takeaways: [
      "Print the INPUTS before a step and the RESULT after it, so you can see where they diverge.",
      "Print inside a loop to watch a value change each round — `print(\"total so far:\", total)`.",
      "Narrow down first, then fix: a print that shows the wrong value halfway through beats guessing at the end."
    ],
    code: 'for n in [4, 0, 2]:\n    print("Trying:", n)\n    if n == 0:\n        print("Skipping zero")\n    else:\n        print("Result:", 10 // n)',
    quiz: [
      { q: "Where is the most useful place for a debug print?",
        options: ["Only at the very end of the program", "Before and after the suspicious step, showing inputs and results", "Only inside comments", "Only in the first line"],
        answer: 1, why: "Seeing both sides of a step shows exactly where the value first goes wrong." },
      { q: "What does printing inside a loop help you see?",
        options: ["How a value changes on each round", "The number of lines in the file", "The Python version", "The file name"],
        answer: 0, why: "One print per round gives you a trace of the value over time." },
      { q: "Your print shows the total is wrong after the third loop round. What next?",
        options: ["Fix the code inside that round — that is where it went wrong", "Delete all the prints", "Rewrite the whole program", "Ignore it and hope"],
        answer: 0, why: "The first round where the value goes wrong pinpoints the faulty step." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(f"10 // 2 = {10 // 2}")', options: ["10 // 2 = 5", "10 // 2 = 2", "5", "Error"], answer: 0,
      hint: "10 // 2 is floor division — work out 10 divided by 2, rounded down." }
  },
  {
    id: "b68", section: "base-camp", track: "beginner", title: "Code Style: Naming Things Well",
    explain: "A good name says what a value IS, so the code reads like a sentence: total_price and final_price need no explanation, while tp and x do. Pick names that are specific, use full words, and say what the thing means — not what type it is.",
    takeaways: [
      "Name values by MEANING: `total_price` beats `tp`, and `final_price` beats `x`.",
      "Use full words and underscores: `item_count`, not `ic` or `itemcount`.",
      "A clear name is documentation — if you need a comment to explain a name, rename it."
    ],
    code: 'total_price = 120\ndiscount = 20\nfinal_price = total_price - discount\nprint("Final price:", final_price)',
    quiz: [
      { q: "Which variable name is clearest for a shopping total?",
        options: ["tp", "x", "total_price", "data"],
        answer: 2, why: "total_price says exactly what the value is, with no decoding needed." },
      { q: "Why are single-letter names like `x` usually a bad choice?",
        options: ["They make the code run slower", "They say nothing about what the value means", "Python forbids them", "They use too much memory"],
        answer: 1, why: "A name's job is to explain the value; x explains nothing." },
      { q: "What should you do if a name needs a comment to explain it?",
        options: ["Rename it so the name explains itself", "Keep the name and add a longer comment", "Delete the variable", "Use a shorter name"],
        answer: 0, why: "A good name is its own documentation — renaming fixes the real problem." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'item_count = 3\nprice_per_item = 10\nprint(item_count * price_per_item)', options: ["13", "30", "3", "10"], answer: 1,
      hint: "3 items at 10 each — multiply them." }
  },
  {
    id: "b69", section: "base-camp", track: "beginner", title: "Capstone: Personal Expense Tracker",
    explain: "An expense tracker is a list of dictionaries — each expense has an item, an amount and a category — plus a few sums: total spent, and totals per category. sum() with a generator expression does the adding in one line, and a filter (if e[\"category\"] == \"food\") narrows it to one category.",
    takeaways: [
      "Each expense is a dict (`{\"item\": ..., \"amount\": ..., \"category\": ...}`) in a list.",
      "`sum(e[\"amount\"] for e in expenses)` adds up every expense in one line.",
      "Add `if e[\"category\"] == \"food\"` inside the sum to total just one category."
    ],
    code: 'expenses = [{"item": "Lunch", "amount": 150, "category": "food"}, {"item": "Bus", "amount": 40, "category": "travel"}, {"item": "Book", "amount": 200, "category": "study"}]\ntotal = sum(e["amount"] for e in expenses)\nprint("Total spent:", total)\nprint("Food total:", sum(e["amount"] for e in expenses if e["category"] == "food"))',
    quiz: [
      { q: "How is each expense stored in this tracker?",
        options: ["As a plain number", "As a dict with item, amount and category", "As a tuple of strings", "As a set of amounts"],
        answer: 1, why: "Each expense needs its item, amount and category together, so a dict is the fit." },
      { q: "What is the total of expenses 150, 40 and 200?",
        options: ["350", "390", "400", "290"],
        answer: 1, why: "150 + 40 + 200 = 390." },
      { q: "How do you total only the food expenses?",
        options: ["sum(e[\"amount\"] for e in expenses if e[\"category\"] == \"food\")", "sum(expenses)", "len(expenses)", "max(expenses)"],
        answer: 0, why: "The if inside the generator keeps only food expenses before adding them up." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'expenses = [{"amount": 100}, {"amount": 50}]\nprint(sum(e["amount"] for e in expenses))', options: ["50", "100", "150", "Error"], answer: 2,
      hint: "Add the two amounts together." }
  },
  {
    id: "b70", section: "base-camp", track: "beginner", title: "Capstone: Flashcard Quiz App",
    explain: "A flashcard app is the quiz idea taken one step further: each card is a dictionary with a question and an answer, the app shows the question, checks the answer, and reports the score. The same list-of-dicts pattern you used for quizzes and expenses powers this whole app.",
    takeaways: [
      "Each flashcard is a dict (`{\"question\": ..., \"answer\": ...}`) in a list.",
      "Compare each answer with the card's stored answer and count the matches.",
      "The same pattern — list of dicts, loop, compare, score — builds quizzes, flashcards and trackers."
    ],
    code: 'cards = [{"question": "What is 2 + 2?", "answer": "4"}, {"question": "Capital of France?", "answer": "Paris"}, {"question": "What is 5 * 3?", "answer": "15"}]\nanswers = ["4", "London", "15"]\nscore = sum(1 for c, a in zip(cards, answers) if a == c["answer"])\nprint(f"You got {score}/{len(cards)} right")',
    quiz: [
      { q: "How is one flashcard stored?",
        options: ["As a string", "As a dict with a question and an answer", "As a set", "As a number"],
        answer: 1, why: "Each card pairs its question with its correct answer, so a dict is the natural fit." },
      { q: "With answers [\"4\", \"London\", \"15\"] against cards 2+2=4, Paris, 5*3=15, what is the score?",
        options: ["3", "2", "1", "0"],
        answer: 1, why: "Two answers match (4 and 15); London is wrong for Paris." },
      { q: "What pattern do the quiz app, flashcard app and expense tracker share?",
        options: ["A list of dicts, a loop, and a summary at the end", "A while True menu only", "Reading from a file only", "Random numbers only"],
        answer: 0, why: "All three store records as dicts in a list, loop over them, and summarise the result." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'cards = [{"question": "What is 2 + 2?", "answer": "4"}]\nanswers = ["4"]\nscore = sum(1 for c, a in zip(cards, answers) if a == c["answer"])\nprint(f"{score}/{len(cards)}")', options: ["0/1", "1/0", "Error", "1/1"], answer: 3,
      hint: "The one answer matches the one stored answer." }
  }
];
