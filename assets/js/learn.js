/* ============================================================
   Skillzify v2 — learn.js (advanced learning path)
   Duolingo-style visual path · progressive unlocking · lesson
   modal with quiz + coding challenge · XP & levels · confetti.

   Progress (source of truth, dashboard-compatible):
     localStorage "skillzify_progress"  -> { lessonId: true }
   Extensions (new, dashboard-safe):
     localStorage "skillzify_xp"          -> total XP (number)
     localStorage "skillzify_lesson_state"-> { lessonId: { quiz: [bool...], challenge: bool } }
   ============================================================ */
(function () {
  "use strict";

  var PROGRESS_KEY = "skillzify_progress";
  var XP_KEY = "skillzify_xp";
  var STATE_KEY = "skillzify_lesson_state";

  /* ================= Lesson catalog ================= */
  var LESSONS = [
    /* ---------------- BEGINNER ---------------- */
    {
      id: "b1", track: "beginner", title: "Hello, Python! Your First Program",
      explain: "The print() function displays text on the screen. Text wrapped in quotes is called a string. This is the traditional first step in every programming language — and every Python journey.",
      takeaways: [
        "print() sends output to the screen — your program talking back to you.",
        "Text in quotes (\"...\" or '...') is called a string.",
        "Python runs top to bottom, one line at a time."
      ],
      code: 'print("Hello, Skillzify!")\nprint("I am learning Python 🚀")',
      quiz: [
        { q: "What does print(\"Hi\") do?",
          options: ["Displays Hi on the screen", "Saves Hi to a file", "Creates a variable named Hi", "Clears the screen"],
          answer: 0, why: "print() sends text to the program's output — usually your screen or console." },
        { q: "In Python, text wrapped in quotes is called a…",
          options: ["number", "string", "loop", "comment"],
          answer: 1, why: "Quoted text is a string (str) — one of Python's core data types." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: 'print("3" + "4")',
        options: ["7", "34", "12", "Error"],
        answer: 1, hint: "With strings, + joins (concatenates) them instead of adding." }
    },
    {
      id: "b2", track: "beginner", title: "Variables & Data Types",
      explain: "Variables store values under a name. Python figures out the type automatically — int for whole numbers, float for decimals, str for text, and bool for True/False. Think of a variable as a labelled box you can put things in and swap out later.",
      takeaways: [
        "Create a variable with name = value — no type declaration needed.",
        "Core types: int, float, str, bool. Check with type().",
        "Variable names use letters, digits, _ — and can't start with a digit."
      ],
      code: 'name = "Vikas"\nage = 20\nheight = 5.9\nis_student = True\n\nprint(name, age, height, is_student)\nprint(type(age))  # <class \'int\'>',
      quiz: [
        { q: "What is the type of x = 3.14?",
          options: ["int", "float", "str", "bool"],
          answer: 1, why: "A number with a decimal point is a float (floating-point)." },
        { q: "Which is a valid variable name?",
          options: ["2cool", "my_var", "my-var", "class"],
          answer: 1, why: "Names can't start with a digit, can't contain '-', and can't be Python keywords like class." }
      ],
      challenge: { type: "blank", prompt: "Fill the blank so the program prints 25:",
        code: "age = ____\nprint(age + 5)  # should print 25",
        answer: ["20"], hint: "age + 5 = 25, so age must be the integer 20." }
    },
    {
      id: "b3", track: "beginner", title: "Strings & f-strings",
      explain: "f-strings let you embed variables directly inside text using curly braces — just prefix the string with f. They're the cleanest, fastest way to build messages in modern Python, and you'll use them everywhere.",
      takeaways: [
        "Prefix a string with f to embed {expressions} inside it.",
        "String methods like .upper(), .lower(), .strip() return new strings.",
        "len(s) gives the number of characters in a string."
      ],
      code: 'name = "Vikas"\nscore = 95\n\nmessage = f"{name} scored {score} marks!"\nprint(message)\nprint(name.upper())\nprint(len(name))',
      quiz: [
        { q: "What does f\"{name}!\" do?",
          options: ["Inserts the value of name", "Prints the letter f", "Creates a file", "Deletes the variable"],
          answer: 0, why: "The f prefix turns {name} into the variable's value inside the string." },
        { q: "What is len(\"Python\")?",
          options: ["5", "6", "7", "Error"],
          answer: 1, why: "P-y-t-h-o-n = 6 characters." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: 's = "abc"\nprint(s.upper() + str(len(s)))',
        options: ["ABC3", "abc3", "ABC", "Error"],
        answer: 0, hint: "s.upper() → \"ABC\", len(s) → 3, str(3) → \"3\", then + joins them." }
    },
    {
      id: "b4", track: "beginner", title: "Conditionals: if / elif / else",
      explain: "Conditionals let your program make decisions. Python checks each condition top to bottom and runs the first block that is True. Indentation (4 spaces) defines which lines belong to each block — get it wrong and Python complains.",
      takeaways: [
        "if / elif / else chain: first True condition wins, the rest are skipped.",
        "Conditions use comparisons: ==, !=, <, >, <=, >=",
        "Indentation is syntax in Python — it defines code blocks."
      ],
      code: 'marks = 82\n\nif marks >= 90:\n    print("Grade: A")\nelif marks >= 75:\n    print("Grade: B")\nelif marks >= 50:\n    print("Grade: C")\nelse:\n    print("Keep practicing!")',
      quiz: [
        { q: "With marks = 82, what prints?",
          options: ["Grade: A", "Grade: B", "Grade: C", "Keep practicing!"],
          answer: 1, why: "82 >= 90 is False, 82 >= 75 is True → the elif branch runs." },
        { q: "Which keyword tests another condition after if?",
          options: ["elif", "else if", "then", "otherwise"],
          answer: 0, why: "elif is short for 'else if' — Python's own keyword." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: "x = 10\nif x > 5:\n    print(\"big\")\nif x > 8:\n    print(\"huge\")",
        options: ["big", "huge", "big, then huge (two lines)", "nothing"],
        answer: 2, hint: "These are two separate if statements — both conditions are True, so both run." }
    },
    {
      id: "b5", track: "beginner", title: "Loops: for & while",
      explain: "Loops repeat work without repeating code. A for loop walks through a sequence — range(n) gives 0 … n-1. A while loop repeats while its condition stays True. The classic beginner bug: a while loop whose condition never becomes False runs forever!",
      takeaways: [
        "for i in range(5) loops with i = 0, 1, 2, 3, 4.",
        "while repeats while its condition is True — make sure it can end.",
        "break exits a loop immediately; continue skips to the next round."
      ],
      code: 'print("For loop:")\nfor i in range(1, 6):\n    print(f"  2 x {i} = {2 * i}")\n\nprint("While loop:")\ncount = 3\nwhile count > 0:\n    print(f"  Countdown: {count}")\n    count -= 1\nprint("Go! 🚀")',
      quiz: [
        { q: "What numbers does range(1, 6) produce?",
          options: ["1 to 6", "0 to 5", "1 to 5", "6 to 1"],
          answer: 2, why: "range(start, stop) includes start but stops before stop." },
        { q: "What does break do inside a loop?",
          options: ["Skips to the next iteration", "Exits the loop immediately", "Restarts the loop", "Pauses for 1 second"],
          answer: 1, why: "break jumps straight out of the loop. (continue skips to the next iteration.)" }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: "total = 0\nfor i in range(4):\n    total += i\nprint(total)",
        options: ["4", "6", "10", "0"],
        answer: 1, hint: "range(4) → 0,1,2,3. Add them: 0+1+2+3 = 6." }
    },
    /* ---------------- INTERMEDIATE ---------------- */
    {
      id: "i1", track: "intermediate", title: "Functions & Return Values",
      explain: "Functions package reusable logic under a name. def defines one, parameters receive input, and return sends a result back to the caller. Default parameters (like greeting=\"Hello\") make arguments optional — callers can skip them.",
      takeaways: [
        "def name(params): defines a function; call it with name(args).",
        "return sends a value back. Without it, a function returns None.",
        "Default parameters make arguments optional."
      ],
      code: 'def greet(name, greeting="Hello"):\n    return f"{greeting}, {name}!"\n\ndef add(a, b):\n    return a + b\n\nprint(greet("Vikas"))\nprint(greet("Sara", greeting="Welcome"))\nprint("Sum:", add(7, 5))',
      quiz: [
        { q: "What does return do?",
          options: ["Prints a value", "Sends a value back to the caller", "Ends the program", "Defines a function"],
          answer: 1, why: "return hands a value back to whoever called the function; print just displays it." },
        { q: "In def greet(name, greeting=\"Hello\"), greeting is…",
          options: ["a required argument", "a default parameter", "a global variable", "a return value"],
          answer: 1, why: "It has a default value, so callers may omit it." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: "def add(a, b=10):\n    return a + b\nprint(add(5))",
        options: ["5", "10", "15", "Error"],
        answer: 2, hint: "b isn't given, so the default 10 is used: 5 + 10." }
    },
    {
      id: "i2", track: "intermediate", title: "Lists, Tuples & Dictionaries",
      explain: "Lists are ordered and changeable — your everyday workhorse. Tuples are ordered but frozen (great for fixed data like coordinates). Dictionaries map keys to values for fast lookups. These three cover most data you'll ever handle.",
      takeaways: [
        "Lists: ordered, mutable. Use append(), indexing, negative indices.",
        "Tuples: ordered, immutable — safe for fixed collections.",
        "Dicts: key → value pairs. Access with d[key], list keys with d.keys()."
      ],
      code: 'skills = ["Python", "HTML", "CSS"]\nskills.append("JavaScript")\nprint(skills[0], "→", skills[-1])\n\npoint = (18.5, 73.7)  # tuple: (lat, lon)\nprint("Pune coords:", point)\n\nstudent = {"name": "Vikas", "track": "CSE", "cgpa": 8.6}\nprint(student["name"], "studies", student["track"])\nprint("Keys:", list(student.keys()))',
      quiz: [
        { q: "Which of these is immutable?",
          options: ["list", "tuple", "dict", "set"],
          answer: 1, why: "Tuples can't be changed after creation — that's their whole point." },
        { q: "skills[-1] gives you…",
          options: ["the first element", "the last element", "an error", "the length"],
          answer: 1, why: "Negative indices count from the end: -1 is the last item." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: 'd = {"a": 1, "b": 2}\nprint(d["b"] + len(d))',
        options: ["3", "4", "22", "Error"],
        answer: 1, hint: "d[\"b\"] is 2, and the dict has 2 keys → 2 + 2." }
    },
    {
      id: "i3", track: "intermediate", title: "Error Handling with try/except",
      explain: "Errors (exceptions) crash programs unless handled. Wrap risky code in try, catch specific problems with except, and use finally for cleanup that must always run. Handling specific errors beats a bare except — it keeps real bugs visible.",
      takeaways: [
        "try/except catches exceptions so your program survives them.",
        "Catch specific errors (ZeroDivisionError) before general ones.",
        "finally always runs — perfect for cleanup."
      ],
      code: 'def safe_divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return "Cannot divide by zero!"\n    except TypeError:\n        return "Numbers only, please."\n\nprint(safe_divide(10, 2))\nprint(safe_divide(10, 0))',
      quiz: [
        { q: "Without try/except, what happens on 10 / 0?",
          options: ["Returns 0", "Program crashes with ZeroDivisionError", "Prints a warning", "Retries automatically"],
          answer: 1, why: "An unhandled exception terminates the program with a traceback." },
        { q: "A finally block…",
          options: ["runs only on error", "always runs", "never runs", "runs before try"],
          answer: 1, why: "finally executes whether or not an exception occurred." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: 'try:\n    print(int("abc"))\nexcept ValueError:\n    print("bad number")',
        options: ["abc", "bad number", "0", "Error"],
        answer: 1, hint: "int(\"abc\") raises ValueError, which the except catches." }
    },
    {
      id: "i4", track: "intermediate", title: "OOP Basics: Classes & Objects",
      explain: "Classes are blueprints; objects are the things built from them. __init__ runs when an object is created to set it up, self refers to the object itself, and methods are functions that belong to the class. OOP shines when you model real things with state + behaviour.",
      takeaways: [
        "class defines a blueprint; ClassName() creates an object (instance).",
        "__init__ initialises each object; self is the object itself.",
        "Methods are functions inside the class that operate on the object."
      ],
      code: 'class Student:\n    def __init__(self, name, track):\n        self.name = name\n        self.track = track\n        self.xp = 0\n\n    def complete_lesson(self, points=10):\n        self.xp += points\n        return f"{self.name} earned {points} XP (total {self.xp})"\n\ns = Student("Vikas", "CSE")\nprint(s.complete_lesson())\nprint(s.complete_lesson(20))',
      quiz: [
        { q: "What is self inside a method?",
          options: ["The class name", "A reference to the object itself", "A parent class", "A static value"],
          answer: 1, why: "self is how a method talks about the specific object it's working on." },
        { q: "Which method sets up a new object?",
          options: ["__start__", "__init__", "__main__", "setup()"],
          answer: 1, why: "__init__ (the constructor) runs automatically when you create an object." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: 'class Dog:\n    def __init__(self, name):\n        self.name = name\nd = Dog("Rex")\nprint(d.name)',
        options: ["Dog", "Rex", "None", "Error"],
        answer: 1, hint: "__init__ stored \"Rex\" in d.name." }
    },
    {
      id: "i5", track: "intermediate", title: "Recursion: Functions That Call Themselves",
      explain: "A recursive function solves a problem by calling itself on a smaller piece of it. Every recursion needs two parts: a base case where it stops, and a recursive step that shrinks the problem. Miss the base case and you get infinite recursion → RecursionError.",
      takeaways: [
        "Base case: the stopping condition. Recursive step: call with smaller input.",
        "Recursion is natural for trees, nested data, divide-and-conquer.",
        "Python limits recursion depth (~1000) — loops suit very deep repetition."
      ],
      code: 'def countdown(n):\n    if n <= 0:            # base case\n        print("Blast off! 🚀")\n        return\n    print(n)\n    countdown(n - 1)      # recursive step\n\ncountdown(3)\n\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint("5! =", factorial(5))',
      quiz: [
        { q: "What stops a recursive function from running forever?",
          options: ["A base case", "A for loop", "A return type", "An import"],
          answer: 0, why: "The base case is the condition where the function returns instead of calling itself." },
        { q: "factorial(3) equals…",
          options: ["3", "6", "9", "Error"],
          answer: 1, why: "3 × 2 × 1 = 6." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: "def f(n):\n    if n == 0:\n        return 0\n    return n + f(n - 1)\nprint(f(4))",
        options: ["4", "7", "10", "0"],
        answer: 2, hint: "Unfold it: 4 + 3 + 2 + 1 + 0 = 10." }
    },
    {
      id: "i6", track: "intermediate", title: "File Handling: Read & Write Files",
      explain: "Files let programs remember things permanently. open(path, mode) opens a file: \"w\" writes (overwrites!), \"r\" reads, \"a\" appends. Always use the with statement — Python then closes the file automatically, even if an error strikes mid-way.",
      takeaways: [
        "Modes: \"w\" write, \"r\" read, \"a\" append. \"w\" erases existing content!",
        "with open(...) as f: auto-closes the file — the safe pattern.",
        "f.write() saves text; f.read() loads it all back."
      ],
      code: '# Write\nwith open("notes.txt", "w") as f:\n    f.write("Learn. Build. Shine.\\n")\n    f.write("Day 1: Python basics\\n")\n\n# Read it back\nwith open("notes.txt", "r") as f:\n    content = f.read()\n\nprint(content)\nprint("Lines:", content.strip().split("\\n"))',
      quiz: [
        { q: "Which mode appends to a file without erasing it?",
          options: ["w", "r", "a", "x"],
          answer: 2, why: "\"a\" = append. \"w\" would wipe the file first!" },
        { q: "Why is with open(...) preferred?",
          options: ["It's faster", "It auto-closes the file safely", "It encrypts data", "It deletes the file"],
          answer: 1, why: "The with block guarantees the file is closed, even on errors." }
      ],
      challenge: { type: "blank", prompt: "Fill the blank to open a file for writing:",
        code: 'with open("data.txt", ___) as f:\n    f.write("hi")',
        answer: ["w", "'w'", '"w"'], hint: "The write mode is a single letter…" }
    },
    /* ---------------- ADVANCED ---------------- */
    {
      id: "a1", track: "advanced", title: "List Comprehensions & Lambdas",
      explain: "Comprehensions build lists in one expressive line — [expr for x in items if cond]. They're faster to read and often faster to run than manual loops. Lambdas are tiny anonymous functions, perfect for short transformations you pass to sorted(), map() or filter().",
      takeaways: [
        "[x**2 for x in range(5)] builds a list in a single line.",
        "Add if to filter: [x for x in items if x > 0].",
        "lambda args: expr creates a throwaway one-line function."
      ],
      code: 'squares = [x**2 for x in range(1, 11)]\nprint("Squares:", squares)\n\nevens = [x for x in range(20) if x % 2 == 0]\nprint("Evens:", evens)\n\nnums = [5, 2, 9, 1]\nprint("Sorted desc:", sorted(nums, key=lambda x: -x))',
      quiz: [
        { q: "[x**2 for x in range(3)] equals…",
          options: ["[0, 1, 4]", "[1, 4, 9]", "[0, 1, 2]", "Error"],
          answer: 0, why: "range(3) gives 0, 1, 2 — and their squares are 0, 1, 4." },
        { q: "A lambda is…",
          options: ["a named function", "an anonymous one-line function", "a loop", "a module"],
          answer: 1, why: "lambda creates a small anonymous function, e.g. lambda x: x * 2." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: "nums = [1, 2, 3, 4]\nprint([n * 2 for n in nums if n % 2 == 0])",
        options: ["[2, 4, 6, 8]", "[4, 8]", "[2, 4]", "[4]"],
        answer: 1, hint: "Filter keeps 2 and 4, then doubles each → [4, 8]." }
    },
    {
      id: "a2", track: "advanced", title: "Generators & yield",
      explain: "Generators produce values lazily — one at a time, using almost no memory. yield pauses the function, hands out a value, and resumes where it left off when asked for the next one. Perfect for huge or infinite sequences that would never fit in a list.",
      takeaways: [
        "yield turns a function into a generator that produces values on demand.",
        "Generators are memory-efficient: items are made one at a time.",
        "(expr for x in items) is a generator expression — like a comprehension but lazy."
      ],
      code: 'def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        yield a\n        a, b = b, a + b\n\nprint(list(fibonacci(10)))\n\n# Memory-friendly: squares of 1M numbers, one at a time\ngen = (x**2 for x in range(1_000_000))\nprint("First 3:", [next(gen) for _ in range(3)])',
      quiz: [
        { q: "What does yield do?",
          options: ["Returns and destroys the function", "Pauses, producing one value lazily", "Prints a value", "Raises an error"],
          answer: 1, why: "yield hands out a value and freezes the function's state until the next value is requested." },
        { q: "Why use a generator for a million items?",
          options: ["Faster CPU", "Almost no memory use", "Shorter code", "Better syntax"],
          answer: 1, why: "Items are produced one at a time instead of building a giant list in memory." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: "def gen():\n    yield 1\n    yield 2\ng = gen()\nprint(next(g))",
        options: ["1", "2", "[1, 2]", "Error"],
        answer: 0, hint: "next() resumes the generator up to the first yield → 1." }
    },
    {
      id: "a3", track: "advanced", title: "Decorators",
      explain: "Decorators wrap functions to add behaviour — timing, logging, caching, access control — without touching the function's own code. The @ syntax applies a decorator cleanly. Under the hood, @timer on f is just f = timer(f).",
      takeaways: [
        "@decorator above def applies wrapper logic around the function.",
        "The wrapper uses *args, **kwargs to accept any arguments.",
        "@wraps(func) preserves the original function's name and docstring."
      ],
      code: 'import time\nfrom functools import wraps\n\ndef timer(func):\n    @wraps(func)\n    def wrapper(*args, **kwargs):\n        start = time.time()\n        result = func(*args, **kwargs)\n        print(f"{func.__name__} took {time.time()-start:.4f}s")\n        return result\n    return wrapper\n\n@timer\ndef slow_add(a, b):\n    time.sleep(0.2)\n    return a + b\n\nprint(slow_add(3, 4))',
      quiz: [
        { q: "What does @timer above def slow_add do?",
          options: ["Deletes the function", "Wraps it to add timing behaviour", "Renames it", "Runs it twice"],
          answer: 1, why: "The decorator replaces slow_add with wrapper, which times the call then returns the result." },
        { q: "Why use @wraps(func) inside a decorator?",
          options: ["Speed", "Preserves the original function's name/docstring", "Required by Python", "Encrypts the code"],
          answer: 1, why: "Without it, the wrapped function would report the wrapper's name instead of the original." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: "def shout(fn):\n    def wrapper():\n        return fn().upper()\n    return wrapper\n\n@shout\ndef greet():\n    return \"hello\"\n\nprint(greet())",
        options: ["hello", "HELLO", "None", "Error"],
        answer: 1, hint: "@shout replaces greet with wrapper, which uppercases the result." }
    },
    {
      id: "a4", track: "advanced", title: "Modules, pip & Virtual Environments",
      explain: "Modules organise code into importable files. pip installs third-party packages from PyPI. Virtual environments (venv) give each project its own isolated set of packages so versions never clash. This trio is the professional Python workflow — learn it now and every future project gets easier.",
      takeaways: [
        "import brings in stdlib or third-party modules; pip installs them.",
        "python -m venv venv creates an isolated environment per project.",
        "pip freeze > requirements.txt locks exact versions for sharing."
      ],
      code: '# mymath.py  →  import mymath\n# def square(x): return x * x\n\n# In your terminal:\n#   python -m venv venv        # create isolated environment\n#   source venv/bin/activate   # activate it\n#   pip install requests       # install a package\n#   pip freeze > requirements.txt   # lock dependencies\n\nimport math, random\nprint("π ≈", round(math.pi, 4))\nprint("Lucky number:", random.randint(1, 100))',
      quiz: [
        { q: "What does pip install requests do?",
          options: ["Runs a program", "Downloads a third-party package", "Creates a venv", "Deletes the cache"],
          answer: 1, why: "pip is Python's package installer; it fetches packages from PyPI." },
        { q: "Why use a virtual environment?",
          options: ["Faster internet", "Isolate each project's dependencies", "Required for print()", "Smaller files"],
          answer: 1, why: "Each project gets its own package versions — no conflicts between projects." }
      ],
      challenge: { type: "blank", prompt: "Fill the blank to create a virtual environment named venv:",
        code: "python -m ___ venv",
        answer: ["venv"], hint: "The stdlib module for virtual environments is called venv." }
    },
    {
      id: "a5", track: "advanced", title: "Context Managers & the with Statement",
      explain: "You've already used with open(...) — but with works with any context manager, guaranteeing setup and cleanup even when errors strike. Files close, locks release, timers stop. You can build your own with a class defining __enter__/__exit__, or more simply with the @contextmanager decorator: code before yield runs on entry, code after yield runs on exit.",
      takeaways: [
        "with guarantees cleanup (close, release, rollback) even on errors.",
        "@contextmanager: code before yield = setup, after yield = teardown.",
        "Use them for files, locks, timers, database transactions."
      ],
      code: 'from contextlib import contextmanager\nimport time\n\n@contextmanager\ndef stopwatch(label):\n    start = time.time()\n    print(f"START {label}...")\n    try:\n        yield  # your code runs here\n    finally:\n        print(f"DONE {label} in {time.time()-start:.2f}s")\n\nwith stopwatch("data crunch"):\n    total = sum(range(100000))\n    print("total =", total)',
      quiz: [
        { q: "What does a context manager guarantee?",
          options: ["Faster code", "Cleanup runs even if errors occur", "Auto-imports", "Type checking"],
          answer: 1, why: "That's the whole point of with — reliable teardown no matter what." },
        { q: "In a @contextmanager function, code after yield runs…",
          options: ["never", "when the with block exits", "before the with block", "only on error"],
          answer: 1, why: "yield splits the function: before = setup, after = teardown on exit." }
      ],
      challenge: { type: "predict", prompt: "What will this print?",
        code: 'from contextlib import contextmanager\n@contextmanager\ndef tag(name):\n    print(f"<{name}>")\n    yield\n    print(f"</{name}>")\n\nwith tag("b"):\n    print("hi")',
        options: ["<b>, then hi, then </b> (3 lines)", "hi only", "</b>, then hi, then <b>", "Error"],
        answer: 0, hint: "Entry prints <b>, the body prints hi, exit prints </b>." }
    }
  ];

  var TRACKS = [
    { id: "beginner", name: "Beginner", desc: "Zero to confident — syntax, variables, logic and loops.", icon: "🌱", needs: null },
    { id: "intermediate", name: "Intermediate", desc: "Functions, data structures, errors, OOP, recursion and files.", icon: "⚙️", needs: "beginner" },
    { id: "advanced", name: "Advanced", desc: "Pythonic mastery — generators, decorators, tooling and beyond.", icon: "🚀", needs: "intermediate" }
  ];

  var LEVELS = [
    { xp: 0, name: "🌱 Novice" },
    { xp: 80, name: "🔍 Explorer" },
    { xp: 180, name: "💻 Coder" },
    { xp: 300, name: "🛠️ Builder" },
    { xp: 450, name: "🐍 Pythonista" },
    { xp: 600, name: "🏆 Python Master" }
  ];

  /* ================= Storage ================= */
  function getProgress() { return window.Skillzify.storeGet(PROGRESS_KEY, {}); }
  function saveProgress(p) { window.Skillzify.storeSet(PROGRESS_KEY, p); }
  function getXP() { return window.Skillzify.storeGet(XP_KEY, 0) || 0; }
  function addXP(n) {
    var xp = getXP() + n;
    window.Skillzify.storeSet(XP_KEY, xp);
    return xp;
  }
  function getState() { return window.Skillzify.storeGet(STATE_KEY, {}); }
  function saveState(s) { window.Skillzify.storeSet(STATE_KEY, s); }
  function levelFor(xp) {
    var l = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) l = LEVELS[i];
    return l;
  }
  function nextLevel(xp) {
    for (var i = 0; i < LEVELS.length; i++) if (xp < LEVELS[i].xp) return LEVELS[i];
    return null;
  }
  function bumpStreak() {
    var s = window.Skillzify.storeGet("skillzify_streak", { last: null, count: 0 });
    var today = new Date().toDateString();
    if (s.last === today) return s;
    var yesterday = new Date(Date.now() - 864e5).toDateString();
    s.count = (s.last === yesterday) ? s.count + 1 : 1;
    s.last = today;
    window.Skillzify.storeSet("skillzify_streak", s);
    return s;
  }

  /* ================= Unlock logic ================= */
  function idxOf(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return i; return -1; }
  function isDone(id) { return !!getProgress()[id]; }
  function isUnlocked(gi) {
    if (gi <= 0) return true;
    return isDone(LESSONS[gi - 1].id);
  }
  function trackLessons(trackId) { return LESSONS.filter(function (l) { return l.track === trackId; }); }
  function trackUnlocked(trackId) {
    var t = TRACKS.filter(function (x) { return x.id === trackId; })[0];
    if (!t || !t.needs) return true;
    return trackLessons(t.needs).every(function (l) { return isDone(l.id); });
  }
  function trackPct(trackId) {
    var ls = trackLessons(trackId), p = getProgress();
    var done = ls.filter(function (l) { return p[l.id]; }).length;
    return ls.length ? Math.round(done / ls.length * 100) : 0;
  }
  function currentIdx() {
    for (var i = 0; i < LESSONS.length; i++) {
      if (isUnlocked(i) && !isDone(LESSONS[i].id)) return i;
    }
    return -1;
  }
  function nextLesson() {
    var i = currentIdx();
    return i >= 0 ? LESSONS[i] : null;
  }

  /* ================= Tiny Python highlighter ================= */
  function highlightPython(src) {
    var esc = window.Skillzify.esc;
    var re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(\d[\d_]*(?:\.\d+)?)\b|\b(import|from|def|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|class|try|except|finally|with|as|lambda|yield|raise|pass|break|continue|assert|del|global|nonlocal|self)\b|([A-Za-z_]\w*)(?=\s*\()/g;
    var out = "", last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      var tok = m[0];
      if (m[1]) out += '<span class="tok-c">' + esc(tok) + "</span>";
      else if (m[2]) out += '<span class="tok-s">' + esc(tok) + "</span>";
      else if (m[3]) out += '<span class="tok-n">' + esc(tok) + "</span>";
      else if (m[4]) out += '<span class="tok-k">' + esc(tok) + "</span>";
      else if (m[5]) out += '<span class="tok-f">' + esc(tok) + "</span>";
      else out += esc(tok);
      last = m.index + tok.length;
    }
    out += esc(src.slice(last));
    return out;
  }

  /* ================= DOM helpers ================= */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function esc(s) { return window.Skillzify.esc(s); }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function copyCode(btn, code) {
    var done = function () {
      var old = btn.innerHTML;
      btn.innerHTML = "✓ Copied";
      setTimeout(function () { btn.innerHTML = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () { fallbackCopy(code); done(); });
    } else { fallbackCopy(code); done(); }
  }
  function fallbackCopy(code) {
    var ta = document.createElement("textarea");
    ta.value = code; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  function tryInCompiler(code) {
    try { localStorage.setItem("skillzify_compiler_code", code); } catch (e) {}
    location.href = "compiler.html";
  }

  /* ================= Path rendering ================= */
  function renderHero() {
    var card = document.getElementById("xp-card");
    if (!card) return;
    var xp = getXP(), lvl = levelFor(xp), nx = nextLevel(xp);
    var pct = nx ? Math.round((xp - lvl.xp) / (nx.xp - lvl.xp) * 100) : 100;
    card.innerHTML =
      '<div><div class="xp-num">' + xp + ' <span style="font-size:1rem">XP</span></div>' +
      '<div class="xp-lvl">' + esc(lvl.name) + (nx ? " · " + (nx.xp - xp) + " XP to " + esc(nx.name) : " · max level!") + "</div>" +
      '<div class="xp-bar"><span style="width:' + pct + '%"></span></div></div>' +
      '<div style="font-size:2.2rem">🏅</div>';
  }

  function renderProgress() {
    var box = document.getElementById("progress-box");
    if (!box) return;
    var p = getProgress(), total = LESSONS.length;
    var done = LESSONS.filter(function (l) { return p[l.id]; }).length;
    var html = '<div class="progress-row"><span class="lbl">Overall journey</span>' +
      '<div class="bar"><span style="width:' + Math.round(done / total * 100) + '%"></span></div>' +
      '<span class="pct">' + done + "/" + total + "</span></div>";
    TRACKS.forEach(function (t) {
      var pct = trackPct(t.id);
      html += '<div class="progress-row"><span class="lbl">' + t.icon + " " + esc(t.name) + "</span>" +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
        '<span class="pct">' + pct + "%</span></div>";
    });
    box.innerHTML = html;
  }

  function nodeRow(lesson, gi, num) {
    var done = isDone(lesson.id), unlocked = isUnlocked(gi), cur = currentIdx() === gi;
    var row = el("div", "node-row" + (cur ? " is-current" : ""));
    var btn = el("button", "node" + (done ? " is-done" : cur ? " is-current" : !unlocked ? " is-locked" : ""));
    var core = done ? "✓" : !unlocked ? "🔒" : String(num);
    btn.innerHTML = '<span>' + core + "</span>";
    btn.setAttribute("aria-label", "Lesson " + num + ": " + lesson.title +
      (done ? " (completed)" : !unlocked ? " (locked)" : cur ? " (current)" : ""));
    if (!unlocked) { btn.disabled = true; btn.title = "Complete the previous lesson to unlock"; }
    else btn.addEventListener("click", function () { openLesson(gi); });
    var amp = window.innerWidth < 720 ? 34 : 72;
    row.style.setProperty("--ox", Math.round(Math.sin(gi * 1.15) * amp) + "px");
    row.appendChild(btn);
    var lbl = el("div", "node-label", "<strong>" + num + ".</strong> " + esc(lesson.title) +
      (done ? ' <span class="mini-xp">+XP ✓</span>' : ""));
    row.appendChild(lbl);
    return row;
  }

  function lockedTrackCard(t) {
    var prev = TRACKS.filter(function (x) { return x.id === t.needs; })[0];
    var card = el("div", "track-locked");
    card.innerHTML = '<div class="big">🔒</div>' +
      "<h3>" + t.icon + " " + esc(t.name) + " track is locked</h3>" +
      "<p>Finish every lesson in <strong>" + esc(prev.name) + "</strong> (" + trackPct(prev.id) + "% done) to unlock " +
      trackLessons(t.id).length + " new " + esc(t.name.toLowerCase()) + " lessons.</p>" +
      '<div class="bar" style="max-width:280px;margin:16px auto 0"><span style="width:' + trackPct(prev.id) + '%"></span></div>';
    return card;
  }

  function renderTracks() {
    var mount = document.getElementById("tracks");
    if (!mount) return;
    mount.innerHTML = "";
    var lessonNum = 0;
    TRACKS.forEach(function (t) {
      var sec = el("section", "track-section");
      var head = el("div", "track-head",
        '<span class="t-icon">' + t.icon + "</span>" +
        "<div><h2>" + esc(t.name) + "</h2>" +
        '<div class="t-desc">' + esc(t.desc) + "</div></div>" +
        '<span class="t-pct">' + trackPct(t.id) + "%</span>");
      sec.appendChild(head);
      if (!trackUnlocked(t.id)) {
        sec.appendChild(lockedTrackCard(t));
      } else {
        var path = el("div", "path");
        path.id = "path-" + t.id;
        path.innerHTML = '<svg class="path-svg" aria-hidden="true"><defs>' +
          '<linearGradient id="pg-' + t.id + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#6c7bff"/><stop offset="1" stop-color="#22d3ee"/>' +
          "</linearGradient></defs>" +
          '<path class="p-base" d=""/><path class="p-prog" stroke="url(#pg-' + t.id + ')" d=""/></svg>';
        trackLessons(t.id).forEach(function (l) {
          lessonNum++;
          path.appendChild(nodeRow(l, idxOf(l.id), lessonNum));
        });
        sec.appendChild(path);
      }
      mount.appendChild(sec);
    });
  }

  function smoothPath(p) {
    if (p.length < 2) return "";
    var d = "M" + p[0][0].toFixed(1) + " " + p[0][1].toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " + c2x.toFixed(1) + " " + c2y.toFixed(1) +
           " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d;
  }

  function drawPaths() {
    document.querySelectorAll(".path").forEach(function (path) {
      var svg = path.querySelector(".path-svg");
      var rows = path.querySelectorAll(".node-row");
      if (!svg || !rows.length) return;
      var pr = path.getBoundingClientRect(), pts = [];
      rows.forEach(function (r) {
        var b = r.querySelector(".node").getBoundingClientRect();
        pts.push([b.left - pr.left + b.width / 2, b.top - pr.top + b.height / 2]);
      });
      svg.setAttribute("viewBox", "0 0 " + path.offsetWidth + " " + path.offsetHeight);
      var d = smoothPath(pts);
      var base = svg.querySelector(".p-base"), prog = svg.querySelector(".p-prog");
      base.setAttribute("d", d); prog.setAttribute("d", d);
      var doneCount = 0;
      rows.forEach(function (r) { if (r.querySelector(".node.is-done")) doneCount++; });
      var frac = pts.length > 1 ? doneCount / (pts.length - 1) : 1;
      frac = Math.max(0, Math.min(1, frac));
      try {
        var total = prog.getTotalLength();
        prog.style.strokeDasharray = String(total);
        prog.style.strokeDashoffset = String(total * (1 - frac));
      } catch (e) {}
    });
  }

  function scrollToCurrent() {
    var n = document.querySelector(".node.is-current");
    if (n) {
      setTimeout(function () {
        n.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
      }, 350);
    }
  }

  function renderAll() {
    renderHero(); renderProgress(); renderTracks();
    requestAnimationFrame(function () { drawPaths(); scrollToCurrent(); });
  }

  /* ================= Lesson modal ================= */
  var modalIdx = -1, quizState = [], challengeOk = false, modalOpen = false;

  function quizHTML(lesson) {
    return lesson.quiz.map(function (q, qi) {
      var opts = q.options.map(function (o, oi) {
        return '<button class="quiz-opt" data-qi="' + qi + '" data-oi="' + oi + '">' +
          "<strong>" + "ABCD"[oi] + ".</strong> " + esc(o) + "</button>";
      }).join("");
      return '<div class="quiz-q" data-qi="' + qi + '"><h4>Q' + (qi + 1) + ". " + esc(q.q) + "</h4>" +
        opts + '<div class="quiz-why" id="why-' + qi + '"></div></div>';
    }).join("");
  }

  function challengeHTML(ch) {
    var inner = '<h4>🎯 Mini challenge</h4><p class="ch-prompt">' + esc(ch.prompt) + "</p>";
    if (ch.code) inner += '<div class="code-window"><div class="cw-bar"><span class="cw-dot" style="background:#f87171"></span><span class="cw-dot" style="background:#fbbf24"></span><span class="cw-dot" style="background:#34d399"></span></div><pre><code>' + highlightPython(ch.code) + "</code></pre></div>";
    if (ch.type === "predict") {
      inner += ch.options.map(function (o, i) {
        return '<button class="quiz-opt ch-opt" data-oi="' + i + '"><strong>' + "ABCD"[i] + ".</strong> " + esc(o) + "</button>";
      }).join("");
    } else {
      inner += '<div class="blank-row"><input type="text" id="ch-blank" placeholder="Type your answer…" autocomplete="off" spellcheck="false" aria-label="Your answer">' +
        '<button class="btn btn-sm" id="ch-check">Check</button></div>';
    }
    inner += '<div class="ch-feedback" id="ch-feedback"></div>';
    if (ch.hint) inner += '<details class="ch-hint"><summary>Need a hint?</summary><p>' + esc(ch.hint) + "</p></details>";
    return inner;
  }

  function refreshComplete() {
    var btn = document.getElementById("lm-complete");
    if (!btn) return;
    var allQuiz = quizState.length && quizState.every(function (q) { return q.correct; });
    btn.disabled = !(allQuiz && challengeOk);
    btn.innerHTML = btn.disabled ? "🔒 Finish the quiz &amp; challenge to complete" : "🎉 Complete lesson · +XP";
  }

  function openLesson(gi) {
    if (gi < 0 || gi >= LESSONS.length || !isUnlocked(gi)) return;
    modalIdx = gi;
    var lesson = LESSONS[gi];
    quizState = lesson.quiz.map(function () { return { correct: false, firstTry: true }; });
    challengeOk = isDone(lesson.id); // re-opening a done lesson: challenge pre-satisfied
    var track = TRACKS.filter(function (t) { return t.id === lesson.track; })[0];
    var num = gi + 1;

    var body = document.getElementById("lm-body");
    body.innerHTML =
      '<div class="lm-kicker">' + track.icon + " " + esc(track.name) + " · Lesson " + num + " of " + LESSONS.length + "</div>" +
      '<h2 id="lm-title">' + esc(lesson.title) + "</h2>" +
      '<p class="lm-explain">' + esc(lesson.explain) + "</p>" +
      '<ul class="list-check lm-points">' + lesson.takeaways.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
      '<div class="code-window"><div class="cw-bar"><span class="cw-dot" style="background:#f87171"></span><span class="cw-dot" style="background:#fbbf24"></span><span class="cw-dot" style="background:#34d399"></span><span class="cw-title">example.py</span></div>' +
      "<pre><code>" + highlightPython(lesson.code) + "</code></pre></div>" +
      '<div class="lesson-actions">' +
      '<button class="btn btn-sm btn-ghost" id="lm-copy">⧉ Copy code</button>' +
      '<button class="btn btn-sm" id="lm-try">▶ Try in compiler</button></div>' +
      '<h3 class="lm-sec">🧠 Quick quiz</h3><p class="hint" style="margin-top:0">Answer all correctly to proceed. Wrong answers just cost you bonus XP — keep trying!</p>' +
      '<div id="lm-quiz">' + quizHTML(lesson) + "</div>" +
      '<h3 class="lm-sec">🎯 Mini challenge</h3><div class="challenge" id="lm-challenge">' + challengeHTML(lesson.challenge) + "</div>" +
      '<div class="lm-complete"><button class="btn" id="lm-complete" disabled>🔒 Finish the quiz &amp; challenge to complete</button>' +
      '<div class="lm-nav">' +
      '<button class="icon-btn" id="lm-prev" aria-label="Previous lesson"' + (gi === 0 ? " disabled" : "") + ">←</button>" +
      '<button class="icon-btn" id="lm-next" aria-label="Next lesson"' + (!isUnlocked(gi + 1) || gi + 1 >= LESSONS.length ? " disabled" : "") + ">→</button>" +
      "</div></div>";

    document.getElementById("lm-copy").addEventListener("click", function (e) { copyCode(e.currentTarget, lesson.code); });
    document.getElementById("lm-try").addEventListener("click", function () { tryInCompiler(lesson.code); });
    bindQuiz(lesson);
    bindChallenge(lesson);
    document.getElementById("lm-prev").addEventListener("click", function () { if (gi > 0) openLesson(gi - 1); });
    document.getElementById("lm-next").addEventListener("click", function () { if (isUnlocked(gi + 1) && gi + 1 < LESSONS.length) openLesson(gi + 1); });
    document.getElementById("lm-complete").addEventListener("click", completeLesson);

    var bd = document.getElementById("lm-backdrop");
    bd.hidden = false;
    requestAnimationFrame(function () { bd.classList.add("open"); });
    document.body.style.overflow = "hidden";
    modalOpen = true;
    document.getElementById("lm-panel").scrollTop = 0;
    document.getElementById("lm-close").focus();
    refreshComplete();
  }

  function closeLesson() {
    var bd = document.getElementById("lm-backdrop");
    bd.classList.remove("open");
    document.body.style.overflow = "";
    modalOpen = false;
    setTimeout(function () { bd.hidden = true; }, 280);
  }

  function bindQuiz(lesson) {
    document.querySelectorAll("#lm-quiz .quiz-opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var qi = +btn.dataset.qi, oi = +btn.dataset.oi, q = lesson.quiz[qi], st = quizState[qi];
        if (st.correct) return;
        var box = btn.closest(".quiz-q");
        if (oi === q.answer) {
          st.correct = true;
          btn.classList.add("correct");
          box.querySelectorAll(".quiz-opt").forEach(function (b) { b.disabled = true; });
          showWhy(qi, "✅ Correct! " + q.why);
        } else {
          st.firstTry = false;
          btn.classList.add("wrong"); btn.disabled = true;
          showWhy(qi, "❌ Not quite — try again. " + q.why);
        }
        refreshComplete();
      });
    });
  }
  function showWhy(qi, msg) {
    var w = document.getElementById("why-" + qi);
    if (w) { w.textContent = msg; w.classList.add("show"); }
  }

  function norm(s) { return String(s).trim().toLowerCase(); }
  function bindChallenge(lesson) {
    var ch = lesson.challenge, box = document.getElementById("lm-challenge");
    var fb = document.getElementById("ch-feedback");
    function succeed(msg) {
      challengeOk = true;
      box.classList.add("done");
      fb.innerHTML = '<span class="ch-ok">✅ ' + esc(msg || "Correct — challenge smashed!") + "</span>";
      box.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      var inp = document.getElementById("ch-blank");
      if (inp) inp.disabled = true;
      refreshComplete();
    }
    if (ch.type === "predict") {
      box.querySelectorAll(".ch-opt").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (challengeOk) return;
          if (+btn.dataset.oi === ch.answer) { btn.classList.add("correct"); succeed(); }
          else { btn.classList.add("wrong"); btn.disabled = true; fb.innerHTML = '<span class="ch-bad">❌ Nope — think again!</span>'; }
        });
      });
    } else {
      var answers = Array.isArray(ch.answer) ? ch.answer : [ch.answer];
      var check = function () {
        if (challengeOk) return;
        var v = norm(document.getElementById("ch-blank").value);
        if (answers.some(function (a) { return norm(a) === v; })) succeed();
        else fb.innerHTML = '<span class="ch-bad">❌ Not quite — check the hint if you\'re stuck.</span>';
      };
      document.getElementById("ch-check").addEventListener("click", check);
      document.getElementById("ch-blank").addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
    }
  }

  function completeLesson() {
    var lesson = LESSONS[modalIdx];
    if (!lesson || isDone(lesson.id)) { closeLesson(); return; }
    var firstTries = quizState.filter(function (q) { return q.correct && q.firstTry; }).length;
    var gain = 20 + firstTries * 5 + 10;
    var before = levelFor(getXP()).name;
    var xp = addXP(gain);
    var after = levelFor(xp).name;
    var p = getProgress(); p[lesson.id] = true; saveProgress(p);
    var st = getState(); delete st[lesson.id]; saveState(st);
    bumpStreak();
    confetti();
    xpPop(gain);
    renderAll();
    if (before !== after) {
      window.Skillzify.toast("🎉 LEVEL UP! You are now " + after + " (+" + gain + " XP)", "success");
    } else {
      window.Skillzify.toast("Lesson complete! +" + gain + " XP 🎉", "success");
    }
    setTimeout(closeLesson, 1100);
  }

  /* ================= Confetti & XP pop ================= */
  function confetti() {
    if (reducedMotion()) return;
    var layer = document.getElementById("confetti-layer");
    layer.innerHTML = "";
    var colors = ["#6c7bff", "#9d6bff", "#22d3ee", "#34d399", "#fbbf24", "#f87171"];
    for (var i = 0; i < 60; i++) {
      var s = document.createElement("span");
      s.className = "confetti-piece";
      s.style.left = (Math.random() * 100) + "vw";
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (Math.random() * 0.35) + "s";
      var sz = 6 + Math.random() * 8;
      s.style.width = sz + "px"; s.style.height = sz * (Math.random() > 0.5 ? 1 : 0.5) + "px";
      layer.appendChild(s);
    }
    setTimeout(function () { layer.innerHTML = ""; }, 2400);
  }
  function xpPop(n) {
    var card = document.getElementById("xp-card");
    if (!card || reducedMotion()) return;
    var s = document.createElement("span");
    s.className = "xp-pop"; s.textContent = "+" + n + " XP";
    card.appendChild(s);
    setTimeout(function () { s.remove(); }, 1600);
  }

  /* ================= Keyboard ================= */
  document.addEventListener("keydown", function (e) {
    if (!modalOpen) return;
    if (e.key === "Escape") closeLesson();
    else if (e.key === "ArrowRight" && modalIdx + 1 < LESSONS.length && isUnlocked(modalIdx + 1)) openLesson(modalIdx + 1);
    else if (e.key === "ArrowLeft" && modalIdx > 0) openLesson(modalIdx - 1);
  });

  /* ================= Init ================= */
  var resizeT = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { renderTracks(); requestAnimationFrame(drawPaths); }, 250);
  });

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("tracks")) return;
    renderAll();
    document.getElementById("lm-close").addEventListener("click", closeLesson);
    document.getElementById("lm-backdrop").addEventListener("click", function (e) {
      if (e.target.id === "lm-backdrop") closeLesson();
    });
  });

  window.SkillzifyLearn = {
    LESSONS: LESSONS, TRACKS: TRACKS,
    getProgress: getProgress, trackPct: trackPct,
    totalLessons: LESSONS.length,
    nextLesson: nextLesson, highlight: highlightPython,
    getXP: getXP, levelFor: levelFor
  };
})();
