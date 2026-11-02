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
    ,
    {
        id: "b6", track: "beginner", title: "Lists & Tuples",
        explain: "Lists let you keep an ordered collection of items you can change — perfect for things like to-do lists or scores. Tuples look similar but are locked after creation, which makes them great for fixed data like coordinates. Knowing when to use each one is a core Python habit.",
        takeaways: [
          "Lists are ordered and changeable — index them from 0, or from -1 for the end.",
          "append() adds to the end; slicing like [1:3] grabs a sub-list.",
          "Tuples are immutable — use them for fixed data you do not want accidentally changed."
        ],
        code: 'fruits = ["apple", "banana", "cherry"]\nfruits.append("mango")\nprint(fruits[0])\nprint(fruits[1:3])\npoint = (3, 4)\nprint(point)',
        quiz: [
          { q: "What does fruits.append(\"mango\") do?",
            options: ["Adds mango to the end of the list", "Replaces the first item with mango", "Sorts the list", "Removes mango from the list"],
            answer: 0, why: "append() always adds the new item at the end of the list." },
          { q: "What happens if you try point[0] = 5 on a tuple?",
            options: ["It works fine", "TypeError — tuples cannot be changed", "It creates a new tuple", "It deletes the tuple"],
            answer: 1, why: "Tuples are immutable, so item assignment raises a TypeError." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'nums = [10, 20, 30]\nprint(nums[-1])',
          options: ["10", "30", "Error", "-1"],
          answer: 1, hint: "Negative indexes count from the end of the list." }
      },
      {
        id: "b7", track: "beginner", title: "Dictionaries & Sets",
        explain: "Dictionaries store data as key-value pairs, so you can look things up by name instead of by position — like a real dictionary. Sets are unordered collections that automatically drop duplicates, which makes them perfect for membership tests. Together they power everything from counting words to removing repeats.",
        takeaways: [
          "Dictionaries map keys to values; look up with d[key] or the safer d.get(key, default).",
          "Assigning to a new key adds it; assigning to an existing key updates it.",
          "Sets store unique items only — duplicates vanish automatically."
        ],
        code: 'student = {"name": "Asha", "age": 20}\nprint(student["name"])\nprint(student.get("grade", "N/A"))\nstudent["age"] = 21\ncolors = {"red", "blue", "red"}\nprint(colors)',
        quiz: [
          { q: "What does student.get(\"grade\", \"N/A\") return when \"grade\" is missing?",
            options: ["An error", "N/A", "None", "An empty string"],
            answer: 1, why: ".get() returns the default you supply instead of raising a KeyError." },
          { q: "Why does {\"red\", \"blue\", \"red\"} end up with only two items?",
            options: ["Sets automatically remove duplicates", "Python deletes random items", "The last item overwrites the first", "It actually keeps all three"],
            answer: 0, why: "A set can only hold unique values, so the repeated \"red\" is dropped." }
        ],
        challenge: { type: "blank", prompt: "Fill the blank so the program prints 21:",
          code: 'student = {"name": "Asha", "age": 20}\nstudent[____] = 21\nprint(student["age"])  # should print 21',
          answer: ['"age"'], hint: "Dictionary keys go inside the square brackets." }
      },
      {
        id: "b8", track: "beginner", title: "Conditionals & Logic",
        explain: "Programs get smart when they can make decisions, and conditionals are how you teach them. if/elif/else lets your code take different paths based on what is true right now. Combined with and, or, and not, you can express surprisingly subtle logic in just a few lines.",
        takeaways: [
          "if/elif/else runs the first branch whose condition is true.",
          "and needs both sides true; or needs just one; not flips a condition.",
          "Comparisons can chain: 1 < x < 10 checks both ends at once."
        ],
        code: 'score = 85\nif score >= 90:\n    print("A grade")\nelif score >= 75:\n    print("B grade")\nelse:\n    print("Keep practicing")',
        quiz: [
          { q: "What prints when score is 85?",
            options: ["A grade", "B grade", "Keep practicing", "Nothing"],
            answer: 1, why: "85 is not >= 90, but it is >= 75, so the elif branch runs." },
          { q: "In \"if x > 5 and x < 10:\", when does the block run?",
            options: ["When x is greater than 5", "When x is less than 10", "Only when both conditions are true", "When either condition is true"],
            answer: 2, why: "and requires the left and right conditions to both be true." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'temp = 30\nif temp > 25:\n    print("Hot")\nelse:\n    print("Cool")',
          options: ["Hot", "Cool", "HotCool", "Error"],
          answer: 0, hint: "30 is greater than 25, so the first branch runs." }
      },
      {
        id: "b9", track: "beginner", title: "Loops: for & while",
        explain: "Loops let you repeat work without repeating code — the moment a program needs to do something a hundred times, you need them. for loops walk through collections and ranges, while while loops keep going until a condition changes. break and continue give you fine control over when to stop or skip.",
        takeaways: [
          "for i in range(n) loops n times with i going 0 to n-1.",
          "while repeats until its condition becomes false — make sure it eventually does.",
          "break exits the loop now; continue skips to the next round."
        ],
        code: 'for i in range(3):\n    print(i)\ncount = 3\nwhile count > 0:\n    print(count)\n    count = count - 1\nprint("Go!")',
        quiz: [
          { q: "What does range(3) produce?",
            options: ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "3, 2, 1"],
            answer: 1, why: "range(3) starts at 0 and stops before 3." },
          { q: "What does break do inside a loop?",
            options: ["Skips to the next iteration", "Stops the loop immediately", "Restarts the loop", "Pauses for one second"],
            answer: 1, why: "break exits the loop right away; continue is the one that skips ahead." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'total = 0\nfor n in [1, 2, 3]:\n    total = total + n\nprint(total)',
          options: ["3", "5", "6", "123"],
          answer: 2, hint: "Add them up step by step: 0+1, then +2, then +3." }
      },
      {
        id: "b10", track: "beginner", title: "Functions",
        explain: "Functions let you package logic into reusable, named blocks — write once, call anywhere. Parameters make them flexible, return values make them useful, and default arguments make them friendly. Good functions are the difference between a script and a program.",
        takeaways: [
          "def names a function; parameters are its inputs, return sends a result back.",
          "Arguments with defaults (name=\"friend\") are optional when calling.",
          "A function without return gives back None."
        ],
        code: 'def greet(name="friend"):\n    return "Hello, " + name\n\nprint(greet("Asha"))\nprint(greet())',
        quiz: [
          { q: "What does return do in a function?",
            options: ["Prints a value", "Sends a value back to the caller", "Ends the program", "Repeats the function"],
            answer: 1, why: "return hands a value back to whoever called the function." },
          { q: "What prints for greet() with no arguments?",
            options: ["Hello, ", "Hello, friend", "Error — missing argument", "None"],
            answer: 1, why: "The default \"friend\" is used when no argument is given." }
        ],
        challenge: { type: "blank", prompt: "Fill the blank so the program prints 12:",
          code: 'def double(x):\n    ____ x * 2\nprint(double(6))  # should print 12',
          answer: ["return"], hint: "The function must send the result back to the caller." }
      },
      {
        id: "i7", track: "intermediate", title: "List Comprehensions",
        explain: "List comprehensions compress a loop-and-collect pattern into a single readable line — once it clicks, you will use them everywhere. The syntax reads almost like English: transform each item, for each item, optionally only if some condition holds. They are not just shorter; they are usually faster than the equivalent loop.",
        takeaways: [
          "[expr for item in items] transforms every item into a new list.",
          "Add \"if cond\" at the end to keep only matching items.",
          "Comprehensions beat manual append-loops for clarity and speed."
        ],
        code: 'nums = [1, 2, 3, 4, 5]\nsquares = [n * n for n in nums]\nprint(squares)\nevens = [n for n in nums if n % 2 == 0]\nprint(evens)',
        quiz: [
          { q: "What does [n * n for n in nums] build?",
            options: ["A list of each number squared", "A single number", "A dictionary", "A tuple"],
            answer: 0, why: "The expression n * n is evaluated for every n, collecting the results." },
          { q: "In [n for n in nums if n % 2 == 0], what does the if do?",
            options: ["Stops the loop early", "Keeps only even numbers", "Sorts the numbers", "Doubles each number"],
            answer: 1, why: "The trailing if filters: only items passing the test are included." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'words = ["hi", "hello", "hey"]\nlong = [w for w in words if len(w) > 2]\nprint(long)',
          options: ["['hi', 'hello', 'hey']", "['hello']", "['hello', 'hey']", "Error"],
          answer: 2, hint: "Check the length of each word — which are longer than 2 letters?" }
      },
      {
        id: "i8", track: "intermediate", title: "Error Handling",
        explain: "Real programs hit real problems: missing files, bad input, network hiccups. try/except lets your code handle failure gracefully instead of crashing. else runs when nothing went wrong, and finally always runs — perfect for cleanup.",
        takeaways: [
          "Put risky code in try and the recovery plan in except.",
          "Match specific exceptions (ValueError) before broad ones.",
          "finally always runs — use it for cleanup like closing files."
        ],
        code: 'try:\n    age = int("twenty")\nexcept ValueError:\n    print("That is not a number")\n    age = 0\nfinally:\n    print("Done, age =", age)',
        quiz: [
          { q: "When does the except block run?",
            options: ["Always", "Only when an error occurs in try", "Before the try block", "Only when there is no error"],
            answer: 1, why: "except runs only if the try block raises a matching exception." },
          { q: "What does finally guarantee?",
            options: ["The error is fixed", "Its code runs whether or not an error happened", "The program restarts", "Errors are hidden"],
            answer: 1, why: "finally executes no matter how the try block exits." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'try:\n    x = 10 / 0\nexcept ZeroDivisionError:\n    x = -1\nprint(x)',
          options: ["-1", "0", "Error", "10"],
          answer: 0, hint: "Dividing by zero raises ZeroDivisionError, which is caught." }
      },
      {
        id: "i9", track: "intermediate", title: "File Handling",
        explain: "Programs become far more useful when they can save and load data, and files are the simplest way. The with statement opens a file and guarantees it gets closed, even if something goes wrong. Learn the read/write modes once and you will reuse this pattern for logs, configs, and datasets.",
        takeaways: [
          "with open(path) as f: auto-closes the file, even on errors.",
          "'w' overwrites, 'a' appends, 'r' (the default) reads.",
          "f.read() grabs everything; f.readline() grabs one line."
        ],
        code: 'with open("notes.txt", "w") as f:\n    f.write("Python is fun\\n")\n\nwith open("notes.txt") as f:\n    text = f.read()\nprint(text)',
        quiz: [
          { q: "Why use \"with open(...) as f:\"?",
            options: ["It runs faster", "The file is closed automatically", "It encrypts the file", "It works without a filename"],
            answer: 1, why: "with guarantees the file closes when the block exits, even on errors." },
          { q: "What does open(\"notes.txt\", \"w\") do if the file exists?",
            options: ["Appends to it", "Overwrites it from scratch", "Raises an error", "Reads it"],
            answer: 1, why: "Write mode truncates the file; use \"a\" to append instead." }
        ],
        challenge: { type: "blank", prompt: "Fill the blank to read the whole file as a string:",
          code: 'with open("notes.txt") as f:\n    text = f.____()\nprint(text)',
          answer: ["read"], hint: "The method that reads everything at once." }
      },
      {
        id: "i10", track: "intermediate", title: "OOP Basics",
        explain: "Classes let you bundle data and the functions that work on it into one tidy package — a Dog knows its name and how to bark. __init__ sets up each new object, and self is how methods refer to the specific instance they are working on. OOP is how large Python programs stay organized.",
        takeaways: [
          "class defines the blueprint; calling it creates an instance.",
          "__init__ runs at creation time and sets up the object's data.",
          "self is the instance — always the first parameter of a method."
        ],
        code: 'class Dog:\n    def __init__(self, name):\n        self.name = name\n    def bark(self):\n        return self.name + " says woof"\nrex = Dog("Rex")\nprint(rex.bark())',
        quiz: [
          { q: "What is self in a method?",
            options: ["A keyword for imports", "The instance the method was called on", "The class itself", "A global variable"],
            answer: 1, why: "self refers to the particular object the method is operating on." },
          { q: "When does __init__ run?",
            options: ["When the program starts", "When you create an instance", "When you delete the object", "Never automatically"],
            answer: 1, why: "__init__ is the constructor — it runs each time you instantiate the class." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'class Cat:\n    def __init__(self, name):\n        self.name = name\nkitty = Cat("Milo")\nprint(kitty.name)',
          options: ["Milo", "name", "Cat", "Error"],
          answer: 0, hint: "__init__ stores the argument on the new instance." }
      },
      {
        id: "i11", track: "intermediate", title: "Modules & Imports",
        explain: "You do not have to write everything yourself — Python ships with a huge standard library. import brings in a whole module, while from...import grabs just what you need. math, random, and datetime cover an enormous amount of everyday work.",
        takeaways: [
          "import math loads the module; math.sqrt(16) uses it.",
          "from random import choice grabs just one function.",
          "Standard library first: check math, random, datetime before writing your own."
        ],
        code: 'import math\nimport random\n\nprint(math.sqrt(16))\nprint(math.pi)\nlucky = random.choice(["Asha", "Ravi", "Mina"])\nprint("Winner:", lucky)',
        quiz: [
          { q: "What does \"import math\" give you?",
            options: ["A faster Python", "Access to math functions like sqrt", "A new data type", "Internet access"],
            answer: 1, why: "Importing a module makes all its functions and constants available." },
          { q: "How do you import only choice from random?",
            options: ["import choice from random", "from random import choice", "random.import(choice)", "include random.choice"],
            answer: 1, why: "from X import Y pulls a single name out of a module." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'import math\nprint(math.floor(3.9))',
          options: ["4", "3", "3.9", "Error"],
          answer: 1, hint: "floor() rounds down to the nearest whole number." }
      },
      {
        id: "i12", track: "intermediate", title: "Lambda, map, filter",
        explain: "Sometimes a full def is overkill — lambda creates a tiny throwaway function right where you need it. map applies a function to every item, filter keeps only the items that pass a test, and sorted with a key function sorts by anything you can compute. Together they are a compact toolkit for transforming data.",
        takeaways: [
          "lambda n: n * 2 is a tiny function with no name.",
          "map(f, items) transforms; filter(f, items) keeps matches.",
          "sorted(items, key=...) sorts by whatever the key function returns."
        ],
        code: 'nums = [1, 2, 3, 4]\ndoubled = list(map(lambda n: n * 2, nums))\nprint(doubled)\nevens = list(filter(lambda n: n % 2 == 0, nums))\nprint(evens)',
        quiz: [
          { q: "What is a lambda?",
            options: ["A small anonymous function", "A type of loop", "A Python module", "An error type"],
            answer: 0, why: "lambda defines a small function inline without a name." },
          { q: "What does map do?",
            options: ["Draws a diagram", "Applies a function to every item", "Removes duplicates", "Sorts the list"],
            answer: 1, why: "map runs the given function on each item and yields the results." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'nums = [5, 2, 8]\nprint(sorted(nums, key=lambda n: -n))',
          options: ["[2, 5, 8]", "[8, 5, 2]", "[5, 2, 8]", "Error"],
          answer: 1, hint: "Sorting by -n puts the biggest number first." }
      },
      {
        id: "a6", track: "advanced", title: "Decorators",
        explain: "A decorator is a function that wraps another function to add behavior — logging, timing, access checks — without touching its code. The @ syntax is just shorthand for passing your function through the decorator. Once you see the pattern, you will spot decorators everywhere in real Python projects.",
        takeaways: [
          "@decorator above def is shorthand for func = decorator(func).",
          "The wrapper function runs extra code before/after the original.",
          "Decorators keep cross-cutting concerns (timing, logging) out of business logic."
        ],
        code: 'def shout(func):\n    def wrapper():\n        return func().upper()\n    return wrapper\n@shout\ndef greet():\n    return "hello"\nprint(greet())',
        quiz: [
          { q: "What does @shout above \"def greet\" do?",
            options: ["Deletes the function", "Passes greet through the shout decorator", "Runs greet twice", "Converts greet to a class"],
            answer: 1, why: "@shout is shorthand for greet = shout(greet)." },
          { q: "What must a decorator return?",
            options: ["A string", "A new (usually wrapped) function", "Nothing", "A number"],
            answer: 1, why: "The decorator returns the replacement function that gets called instead." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'def star(func):\n    def wrapper():\n        return "*" + func() + "*"\n    return wrapper\n\n@star\ndef word():\n    return "hi"\nprint(word())',
          options: ["hi", "*hi*", "**hi**", "Error"],
          answer: 1, hint: "The wrapper adds one star on each side of the result." }
      },
      {
        id: "a7", track: "advanced", title: "Generators & Iterators",
        explain: "Generators produce values one at a time, pausing at each yield and resuming on demand. That laziness means you can work with huge or even infinite sequences without building them all in memory. for loops and next() both know how to pull values from a generator.",
        takeaways: [
          "yield pauses a function and emits one value; next() resumes it.",
          "Generators are lazy — values are produced only when asked for.",
          "A generator is single-use: once exhausted, it stays exhausted."
        ],
        code: 'def countdown(n):\n    while n > 0:\n        yield n\n        n = n - 1\n\nfor x in countdown(3):\n    print(x)',
        quiz: [
          { q: "How is yield different from return?",
            options: ["It is faster", "It pauses the function and resumes later, producing a sequence", "It ends the program", "It deletes variables"],
            answer: 1, why: "yield suspends the function state; the next call continues after it." },
          { q: "Why are generators memory-friendly?",
            options: ["They compress data", "They produce one item at a time instead of building a whole list", "They run on the GPU", "They skip error checking"],
            answer: 1, why: "Laziness means only one value exists in memory at a time." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'def gen():\n    yield 1\n    yield 2\ng = gen()\nprint(next(g))\nprint(next(g))',
          options: ["1 then 1", "1 then 2", "2 then 2", "Error"],
          answer: 1, hint: "Each next() call resumes where the generator paused." }
      },
      {
        id: "a8", track: "advanced", title: "Recursion",
        explain: "Recursion is when a function solves a problem by calling itself on a smaller version of it. Every recursive function needs a base case — the simple situation where it stops calling itself. It is elegant for problems like factorial or tree traversal, but always respect Python's recursion limit.",
        takeaways: [
          "A recursive function calls itself with a smaller input.",
          "The base case stops the recursion — without it, you recurse forever.",
          "Each call waits for the deeper one, so deep recursion uses lots of stack."
        ],
        code: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(4))',
        quiz: [
          { q: "What is a base case?",
            options: ["The first line of code", "The condition that stops the recursion", "A syntax error", "The fastest computer"],
            answer: 1, why: "The base case is the terminating condition every recursion needs." },
          { q: "What happens without a base case?",
            options: ["The function runs once", "Infinite recursion until Python stops it", "It returns 0", "Nothing happens"],
            answer: 1, why: "The calls never stop until Python hits the recursion limit and raises." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'def countdown(n):\n    if n <= 0:\n        return\n    print(n)\n    countdown(n - 1)\ncountdown(2)',
          options: ["2 then 1", "1 then 2", "2 then 1 then 0", "Error"],
          answer: 0, hint: "Each call prints, then recurses with n - 1 — until 0 stops it silently." }
      },
      {
        id: "a9", track: "advanced", title: "Sorting & Searching",
        explain: "Sorting puts data in order so searching becomes dramatically cheaper. Binary search repeatedly halves a sorted list, finding any item in about log2(n) steps — roughly 20 steps for a million items. Python's own sort is world-class, so learn the intuition and reach for the built-ins.",
        takeaways: [
          "Sorting once makes every later search cheap.",
          "Binary search halves the search space each step: O(log n).",
          "Use list.sort()/sorted() and the bisect module instead of hand-rolling."
        ],
        code: 'import bisect\nnums = [1, 2, 5, 8]\ni = bisect.bisect_left(nums, 5)\nprint("index:", i)\nprint("sorted:", sorted([5, 2, 8, 1]))',
        quiz: [
          { q: "Why must data be sorted for binary search?",
            options: ["It looks nicer", "Each comparison can eliminate half the remaining items", "Python requires it for all searches", "Unsorted data causes errors"],
            answer: 1, why: "Only sorted order lets one comparison discard half the candidates." },
          { q: "Roughly how many steps does binary search need for 1,000,000 sorted items?",
            options: ["1,000,000", "About 20", "About 500,000", "Exactly 7"],
            answer: 1, why: "log2(1,000,000) is about 20 — that is the power of halving." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'nums = [3, 1, 2]\nnums.sort()\nprint(nums[0])',
          options: ["3", "1", "2", "Error"],
          answer: 1, hint: "sort() arranges the list from smallest to largest." }
      },
      {
        id: "a10", track: "advanced", title: "Dictionaries in Depth",
        explain: "Dictionaries reward deeper study: .get() with a default makes counting patterns trivial, .items() lets you loop over keys and values together, and dict comprehensions build mappings in one line. These three idioms show up constantly in real-world Python.",
        takeaways: [
          "counts[k] = counts.get(k, 0) + 1 is the classic counting idiom.",
          ".items() loops over (key, value) pairs together.",
          "{k: v for ...} builds dicts as compactly as list comprehensions build lists."
        ],
        code: 'votes = ["a", "b", "a", "c", "a", "b"]\ncounts = {}\nfor v in votes:\n    counts[v] = counts.get(v, 0) + 1\nprint(counts)\nsquares = {n: n * n for n in range(4)}\nprint(squares)',
        quiz: [
          { q: "What does counts.get(v, 0) do here?",
            options: ["Deletes the key", "Returns the current count, or 0 if the key is new", "Sorts the dictionary", "Counts all keys"],
            answer: 1, why: "The default 0 handles first-time keys without a KeyError." },
          { q: "What does {n: n * n for n in range(4)} create?",
            options: ["A list of squares", "A dict mapping 0-3 to their squares", "A set", "A tuple"],
            answer: 1, why: "The k: v form in a comprehension builds a dictionary." }
        ],
        challenge: { type: "predict", prompt: "What will this print?",
          code: 'd = {"a": 1}\nd["a"] = d.get("a", 0) + 10\nprint(d["a"])',
          options: ["1", "10", "11", "Error"],
          answer: 2, hint: "get returns 1, then 10 is added." }
      }
  ];

  /* Quiz bank expansion: merge extra questions (quiz-extra.js) when present.
     Each lesson goes from 2 to 5 questions; openLesson() picks 3 at random. */
  try {
    var __qx = window.SkillzifyQuizExtra || {};
    LESSONS.forEach(function (l) {
      if (__qx[l.id] && __qx[l.id].length) l.quiz = l.quiz.concat(__qx[l.id]);
    });
  } catch (e) {}

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
    // Accept both legacy toDateString() and synced yyyy-MM-dd formats.
    function isoDay(d) { var m = d.getMonth() + 1, dy = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (dy < 10 ? "0" + dy : dy); }
    function normDay(v) {
      if (!v) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      var t = new Date(v);
      return isNaN(t.getTime()) ? null : isoDay(t);
    }
    var todayIso = isoDay(new Date());
    var yestIso = isoDay(new Date(Date.now() - 864e5));
    var lastIso = normDay(s.last);
    if (lastIso === todayIso) return s;
    s.count = (lastIso === yestIso) ? s.count + 1 : 1;
    s.last = todayIso;
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
  var modalIdx = -1, quizState = [], challengeOk = false, modalOpen = false, curQuiz = [];

  /* ---------- Randomized quizzes: fresh pick + shuffled options every open ---------- */
  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function buildQuiz(lesson) {
    var bank = lesson.quiz || [];
    var picked = shuffled(bank).slice(0, Math.min(3, bank.length));
    return picked.map(function (q) {
      var order = shuffled(q.options.map(function (_, i) { return i; }));
      return {
        q: q.q,
        options: order.map(function (i) { return q.options[i]; }),
        answer: order.indexOf(q.answer),
        why: q.why
      };
    });
  }

  function quizHTML() {
    return curQuiz.map(function (q, qi) {
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
    curQuiz = buildQuiz(lesson); // fresh random pick + shuffled options, every open
    quizState = curQuiz.map(function () { return { correct: false, firstTry: true }; });
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
      '<button class="btn btn-sm" id="lm-try">▶ Try in compiler</button>' +
      '<button class="btn btn-sm btn-ghost" id="lm-star" aria-label="Star lesson">⭐</button>' +
      '<button class="btn btn-sm btn-ghost" id="lm-pin" aria-label="Pin lesson">📌</button></div>' +
      '<h3 class="lm-sec">🧠 Quick quiz</h3><p class="hint" style="margin-top:0">Answer all correctly to proceed. Questions are picked fresh every time — no two attempts are the same. Wrong answers just cost you bonus XP — keep trying!</p>' +
      '<div id="lm-quiz">' + quizHTML() + "</div>" +
      '<h3 class="lm-sec">🎯 Mini challenge</h3><div class="challenge" id="lm-challenge">' + challengeHTML(lesson.challenge) + "</div>" +
      '<div class="lm-complete"><button class="btn" id="lm-complete" disabled>🔒 Finish the quiz &amp; challenge to complete</button>' +
      '<div class="lm-nav">' +
      '<button class="icon-btn" id="lm-prev" aria-label="Previous lesson"' + (gi === 0 ? " disabled" : "") + ">←</button>" +
      '<button class="icon-btn" id="lm-next" aria-label="Next lesson"' + (!isUnlocked(gi + 1) || gi + 1 >= LESSONS.length ? " disabled" : "") + ">→</button>" +
      "</div></div>";

    document.getElementById("lm-copy").addEventListener("click", function (e) { copyCode(e.currentTarget, lesson.code); });
    document.getElementById("lm-try").addEventListener("click", function () { tryInCompiler(lesson.code); });
    (function () {
      var A = window.SkillzifyActivity; if (!A) return;
      var starBtn = document.getElementById("lm-star"), pinBtn = document.getElementById("lm-pin");
      function paint() {
        starBtn.textContent = A.isStarred("lesson", lesson.id) ? "🌟 Starred" : "⭐ Star";
        pinBtn.textContent = A.isPinned("lesson", lesson.id) ? "📌 Pinned" : "📌 Pin";
      }
      paint();
      starBtn.addEventListener("click", function () {
        var on = A.toggleStar("lesson", lesson.id, lesson.title);
        A.log("star", (on ? "Starred lesson: " : "Unstarred lesson: ") + lesson.title);
        paint(); window.Skillzify.toast(on ? "Starred ⭐" : "Unstarred", "success");
      });
      pinBtn.addEventListener("click", function () {
        var on = A.togglePin("lesson", lesson.id, lesson.title);
        paint(); window.Skillzify.toast(on ? "Pinned 📌" : "Unpinned", "success");
      });
    })();
    bindQuiz();
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

  function bindQuiz() {
    document.querySelectorAll("#lm-quiz .quiz-opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var qi = +btn.dataset.qi, oi = +btn.dataset.oi, q = curQuiz[qi], st = quizState[qi];
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
    if (window.SkillzifySync) window.SkillzifySync.markDirty();
    if (window.SkillzifyActivity) window.SkillzifyActivity.log("lesson", "Completed lesson: " + lesson.title);
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
