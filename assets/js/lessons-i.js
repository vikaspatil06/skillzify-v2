var LESSONS_NEW_INTERMEDIATE = [
  {
    id: "i13", section: "power-lab", track: "intermediate", title: "*args & **kwargs",
    explain: "*args collects extra positional arguments into a tuple, and **kwargs collects extra keyword arguments into a dict. Together they make flexible functions that accept any number of arguments.",
    takeaways: [
      "*args gathers extra positional args into a tuple.",
      "**kwargs gathers extra keyword args into a dict.",
      "Use *args/**kwargs to forward arguments to other functions."
    ],
    code: 'def total(*nums):\n    return sum(nums)\n\ndef show(**info):\n    for k, v in info.items():\n        print(k, "=", v)\n\nprint(total(1, 2, 3))\nshow(name="Ava", age=20)',
    quiz: [
      { q: "What type does *args collect arguments into?",
        options: ["A tuple", "A list", "A dict", "A set"],
        answer: 0, why: "*args always packs extra positional arguments into a tuple." },
      { q: "In def f(a, *args, **kwargs):, where do extra keyword arguments go?",
        options: ["Into a", "Into args", "Into kwargs", "They cause an error"],
        answer: 2, why: "**kwargs collects any extra keyword arguments into a dictionary." },
      { q: "What does f(*[1, 2]) do when calling f(a, b)?",
        options: ["Passes the list as one argument", "Unpacks the list into a and b", "Raises TypeError", "Passes nothing"],
        answer: 1, why: "The * in a call unpacks an iterable into separate positional arguments." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def greet(*names):\n    return "Hi " + " & ".join(names)\n\nprint(greet("Al", "Bo"))',
      options: ["Hi Al & Bo", "Hi ('Al', 'Bo')", "Hi Al, Bo", "Error"], answer: 0,
      hint: "join() glues the tuple items with the separator string." }
  },
  {
    id: "i14", section: "tool-shed", track: "intermediate", title: "Advanced String Formatting",
    explain: "Beyond basic f-strings, Python's format mini-language lets you control width, alignment, padding, and decimal places. It turns raw numbers into clean, readable output.",
    takeaways: [
      "f'{x:>10}' right-aligns; f'{x:<10}' left-aligns; f'{x:^10}' centers.",
      "f'{pi:.2f}' rounds a float to 2 decimal places.",
      "f'{n:,}' adds thousands separators; f'{n:05d}' zero-pads."
    ],
    code: 'pi = 3.14159\nn = 1234567\nword = "hi"\n\nprint(f"{pi:.2f}")\nprint(f"{n:,}")\nprint(f"{word:>10}|")\nprint(f"{42:05d}")',
    quiz: [
      { q: 'What does f"{3.14159:.2f}" produce?',
        options: ["3.14", "3.141", "3.15", "3.1"],
        answer: 0, why: ".2f rounds to two decimal places, so 3.14159 becomes 3.14." },
      { q: 'What does f"{7:04d}" print?',
        options: ["0007", "7000", "7   ", "Error"],
        answer: 0, why: "04d means pad with zeros to width 4." },
      { q: 'What does f"{1000000:,}" print?',
        options: ["1,000,000", "1000000", "1 000 000", "1.000.000"],
        answer: 0, why: "The , format spec adds thousands separators." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'score = 9.5\nprint(f"Score: {score:>6.1f}")',
      options: ["Score:    9.5", "Score: 9.5", "Score: 9.50", "Error"], answer: 0,
      hint: "Width 6 with one decimal — count the characters." }
  },
  {
    id: "i15", section: "tool-shed", track: "intermediate", title: "enumerate, zip & Unpacking in Loops",
    explain: "enumerate() gives you index + item as you loop, zip() pairs up two lists, and unpacking splits each pair into named variables. Together they replace most manual index juggling.",
    takeaways: [
      "for i, x in enumerate(items) gives index and value together.",
      "zip(a, b) pairs items from two lists, stopping at the shorter one.",
      "Unpacking like for name, score in pairs: keeps loops readable."
    ],
    code: 'names = ["Al", "Bo", "Cy"]\nscores = [88, 92, 79]\n\nfor i, name in enumerate(names, start=1):\n    print(i, name)\n\nfor name, score in zip(names, scores):\n    print(name, "scored", score)',
    quiz: [
      { q: "What does enumerate(['a','b']) yield?",
        options: ["(0,'a'), (1,'b')", "('a',0), ('b',1)", "(1,'a'), (2,'b')", "['a','b']"],
        answer: 0, why: "enumerate pairs each item with its index, starting at 0 by default." },
      { q: "zip([1,2,3], ['a','b']) produces how many pairs?",
        options: ["2", "3", "Error", "1"],
        answer: 0, why: "zip stops at the shorter iterable, so you get 2 pairs." },
      { q: "What does a, b = (10, 20) do?",
        options: ["Assigns 10 to a and 20 to b", "Assigns the tuple to both", "Raises ValueError", "Assigns 10 to both"],
        answer: 0, why: "Tuple unpacking splits the values into the named variables." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'pairs = [("x", 1), ("y", 2)]\nfor letter, num in pairs:\n    print(letter * num)',
      options: ["x\nyy", "xx\ny", "xy", "Error"], answer: 0,
      hint: "Unpack each pair, then string * number repeats the string." }
  },
  {
    id: "i16", section: "tool-shed", track: "intermediate", title: "Dict & Set Comprehensions",
    explain: "Just like list comprehensions, you can build dicts and sets in one line with {k: v for ...} and {x for ...}. They are the fastest way to transform mappings and collections.",
    takeaways: [
      "{k: v for k, v in pairs} builds a dict in one line.",
      "{x for x in items} builds a set, dropping duplicates automatically.",
      "Add if to filter: {k: v for k, v in d.items() if v > 0}."
    ],
    code: 'prices = {"apple": 3, "pear": 0, "kiwi": 5}\n\nstock = {k: v for k, v in prices.items() if v > 0}\nletters = {c for c in "banana"}\n\nprint(stock)\nprint(sorted(letters))',
    quiz: [
      { q: "What does {x: x**2 for x in range(3)} create?",
        options: ["{0: 0, 1: 1, 2: 4}", "[0, 1, 4]", "{0, 1, 4}", "Error"],
        answer: 0, why: "The k: v form builds a dict mapping each x to its square." },
      { q: "What does {c for c in 'aab'} evaluate to?",
        options: ["{'a', 'b'}", "['a', 'a', 'b']", "{'a', 'a', 'b'}", "'aab'"],
        answer: 0, why: "Set comprehensions drop duplicates, leaving one 'a' and one 'b'." },
      { q: "Which filters a dict comprehension to positive values?",
        options: ["{k: v for k, v in d.items() if v > 0}", "{k: v if v > 0 for k, v in d.items()}", "Both work", "Neither works"],
        answer: 0, why: "The if filter goes at the end of the comprehension, after the for clause." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [1, 2, 2, 3]\nprint({n * 10 for n in nums})',
      options: ["{10, 20, 30}", "[10, 20, 20, 30]", "{10, 20, 20, 30}", "Error"], answer: 0,
      hint: "Sets keep only one copy of each value." }
  },
  {
    id: "i17", section: "algorithm-arena", track: "intermediate", title: "Sorting with key Functions",
    explain: "sorted() and list.sort() accept a key function that computes the value to sort by. Combined with lambda or str.lower, you can sort by length, last name, or anything you define.",
    takeaways: [
      "key=len sorts strings by length instead of alphabetically.",
      "key=str.lower sorts case-insensitively.",
      "reverse=True flips the order; sort() is stable so ties keep original order."
    ],
    code: 'words = ["pear", "fig", "banana", "kiwi"]\n\nprint(sorted(words))\nprint(sorted(words, key=len))\nprint(sorted(words, key=str.lower, reverse=True))',
    quiz: [
      { q: "What does sorted(['bb', 'a', 'ccc'], key=len) return?",
        options: ["['a', 'bb', 'ccc']", "['ccc', 'bb', 'a']", "['a', 'ccc', 'bb']", "Error"],
        answer: 0, why: "key=len sorts by string length: 1, 2, 3." },
      { q: "How do you sort numbers from largest to smallest?",
        options: ["sorted(nums, reverse=True)", "sorted(nums, order='desc')", "nums.sort(desc=True)", "sorted(nums)[::-2]"],
        answer: 0, why: "reverse=True flips the sort direction." },
      { q: "What does key do in sorted()?",
        options: ["Computes the value each item is compared by", "Filters out unwanted items", "Reverses the list", "Limits how many items are sorted"],
        answer: 0, why: "Each item is transformed by key, and sorting compares those results." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'data = [("b", 2), ("a", 3), ("c", 1)]\nprint(sorted(data, key=lambda t: t[1]))',
      options: ["[('c', 1), ('b', 2), ('a', 3)]", "[('a', 3), ('b', 2), ('c', 1)]", "Error", "[('b', 2), ('c', 1), ('a', 3)]"], answer: 0,
      hint: "The lambda picks the second element of each tuple as the sort key." }
  },
  {
    id: "i18", section: "tool-shed", track: "intermediate", title: "Copy vs Deep Copy: The Mutation Trap",
    explain: "Assigning a list copies the reference, not the data — and even list.copy() only copies the outer layer. Nested lists still share memory unless you use copy.deepcopy().",
    takeaways: [
      "b = a makes both names point to the same list.",
      "a.copy() / list(a) copy only the outer list; nested lists stay shared.",
      "copy.deepcopy(a) clones everything, including nested objects."
    ],
    code: 'import copy\n\na = [[1, 2], [3, 4]]\nb = a.copy()\nc = copy.deepcopy(a)\n\nb[0].append(99)\nprint(a[0])\nprint(c[0])',
    quiz: [
      { q: "After b = a (both lists), b.append(5) does what to a?",
        options: ["Also adds 5 to a", "Nothing — a is unchanged", "Deletes a", "Raises an error"],
        answer: 0, why: "b = a copies the reference, so both names share one list." },
      { q: "a = [[1]]; b = a.copy(); b[0].append(2). What is a now?",
        options: ["[[1, 2]]", "[[1]]", "[[2]]", "Error"],
        answer: 0, why: "copy() is shallow: the inner list is still shared, so the change shows up in a." },
      { q: "Which fully clones nested structures?",
        options: ["copy.deepcopy()", "list.copy()", "list()", "Slicing [:]"],
        answer: 0, why: "Only deepcopy recursively clones every nested object." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import copy\n\na = [1, [2]]\nb = copy.deepcopy(a)\nb[1].append(3)\nprint(a)\nprint(b)',
      options: ["[1, [2]]\n[1, [2, 3]]", "[1, [2, 3]]\n[1, [2, 3]]", "[1, [2]]\n[1, [2]]", "Error"], answer: 0,
      hint: "deepcopy gives b its own independent inner list." }
  },
  {
    id: "i19", section: "power-lab", track: "intermediate", title: "Exception Hierarchy & Custom Exceptions",
    explain: "All exceptions inherit from BaseException, and your own error types just subclass Exception. Raising a custom exception makes your code's failures self-documenting.",
    takeaways: [
      "Every built-in error (ValueError, TypeError...) inherits from Exception.",
      "class MyError(Exception): pass creates your own exception type.",
      "Catch specific exceptions; bare except: hides bugs."
    ],
    code: 'class TooYoungError(Exception):\n    pass\ndef check_age(age):\n    if age < 13:\n        raise TooYoungError("Must be 13 or older")\ntry:\n    check_age(10)\nexcept TooYoungError as e:\n    print("Blocked:", e)',
    quiz: [
      { q: "What should a custom exception inherit from?",
        options: ["Exception", "object", "Error", "Base"],
        answer: 0, why: "Subclassing Exception plugs your error into Python's normal exception handling." },
      { q: "Why avoid a bare except: ?",
        options: ["It also catches real bugs and things like KeyboardInterrupt", "It is slower", "It only catches ValueError", "It is a syntax error"],
        answer: 0, why: "A bare except swallows everything, including bugs you actually want to see." },
      { q: "What is the parent of ValueError?",
        options: ["Exception", "ValueError has no parent", "TypeError", "object directly"],
        answer: 0, why: "All normal errors derive from Exception, which derives from BaseException." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Oops(Exception):\n    pass\n\ntry:\n    raise Oops("boom")\nexcept Exception as e:\n    print("caught", e)',
      options: ["caught boom", "boom", "Uncaught Oops", "Error"], answer: 0,
      hint: "A custom exception IS an Exception, so except Exception catches it." }
  },
  {
    id: "i20", section: "power-lab", track: "intermediate", title: "Raising Exceptions & Assertions",
    explain: "raise lets you signal errors deliberately, and assert states assumptions that should never be false. Both turn silent wrongness into loud, debuggable failures.",
    takeaways: [
      "raise ValueError('msg') throws an error with your message.",
      "assert x > 0, 'msg' crashes if the condition is False.",
      "Use raise for bad input; assert for impossible internal states."
    ],
    code: 'def divide(a, b):\n    assert isinstance(b, (int, float)), "b must be a number"\n    if b == 0:\n        raise ValueError("Cannot divide by zero")\n    return a / b\n\nprint(divide(10, 2))',
    quiz: [
      { q: "What happens when assert 2 + 2 == 5 runs?",
        options: ["AssertionError is raised", "Nothing — asserts are ignored", "ValueError is raised", "It prints False"],
        answer: 0, why: "A failed assert raises AssertionError immediately." },
      { q: "When should you use raise instead of assert?",
        options: ["Validating user input", "Checking internal logic", "Never — they are identical", "Only in tests"],
        answer: 0, why: "raise is for expected runtime errors like bad input; asserts can be disabled with -O." },
      { q: "What does raise ValueError('bad') do?",
        options: ["Throws a ValueError carrying 'bad'", "Prints 'bad' and continues", "Returns 'bad'", "Creates a warning"],
        answer: 0, why: "raise stops execution and throws the exception with your message." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def check(n):\n    assert n >= 0, "negative!"\n    return n * 2\n\nprint(check(5))',
      options: ["10", "AssertionError", "5", "Error"], answer: 0,
      hint: "5 >= 0 is True, so the assert passes quietly." }
  },
  {
    id: "i21", section: "power-lab", track: "intermediate", title: "try/except/else/finally: The Full Picture",
    explain: "else runs only when no exception occurred, and finally runs no matter what — perfect for cleanup. Using all four blocks makes your error handling precise instead of guessy.",
    takeaways: [
      "else: runs only if the try block succeeded — put success code there.",
      "finally: always runs, even on return or uncaught errors.",
      "Keep try blocks small so you know exactly what might fail."
    ],
    code: 'def get_num(s):\n    try:\n        n = int(s)\n    except ValueError:\n        print("not a number")\n    else:\n        print("doubled:", n * 2)\n    finally:\n        print("done")\nget_num("21")',
    quiz: [
      { q: "When does the else block of try/except/else run?",
        options: ["Only if no exception was raised", "Only if an exception was raised", "Always", "Never"],
        answer: 0, why: "else means 'the try succeeded, so do the success path here'." },
      { q: "When does finally run?",
        options: ["Always, even after return or an error", "Only on success", "Only on error", "Only if there is no else"],
        answer: 0, why: "finally is guaranteed cleanup — it runs no matter how the try exits." },
      { q: "Why keep try blocks small?",
        options: ["So you know exactly which line might fail", "It runs faster", "Big try blocks are a syntax error", "Exceptions cannot cross function calls"],
        answer: 0, why: "A tiny try block pinpoints the risky operation instead of hiding bugs elsewhere." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'try:\n    x = 1 / 0\nexcept ZeroDivisionError:\n    x = -1\nelse:\n    x = 99\nfinally:\n    x += 1\nprint(x)',
      options: ["0", "-1", "99", "Error"], answer: 0,
      hint: "The exception skips else; finally still adds 1 to -1." }
  },
  {
    id: "i22", section: "tool-shed", track: "intermediate", title: "Working with CSV Files",
    explain: "The csv module reads and writes spreadsheet-style data without manual string splitting. These examples use io.StringIO so everything runs without touching your disk.",
    takeaways: [
      "csv.reader turns each row into a list of strings.",
      "csv.DictReader maps rows to dicts using the header row.",
      "Always open real files with newline='' to avoid blank rows."
    ],
    code: 'import csv, io\n\ntext = "name,age\\nAl,20\\nBo,22\\n"\nrows = list(csv.reader(io.StringIO(text)))\n\nfor row in rows[1:]:\n    print(row[0], "is", row[1])',
    quiz: [
      { q: "What does csv.reader yield for each row?",
        options: ["A list of strings", "A dict", "A tuple of ints", "One big string"],
        answer: 0, why: "Each row comes back as a list, with every field as a string." },
      { q: "What does csv.DictReader use as dict keys?",
        options: ["The header row", "Column numbers", "The first data row", "You must pass keys manually"],
        answer: 0, why: "DictReader takes the first row as headers and maps every later row to them." },
      { q: "Why open CSV files with newline=''?",
        options: ["To stop extra blank rows on some systems", "It makes reading faster", "It is required for DictReader", "It enables Unicode"],
        answer: 0, why: "The csv module handles newlines itself; letting Python translate them too creates blank rows." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import csv, io\n\ntext = "a,b\\n1,2\\n"\nrows = list(csv.reader(io.StringIO(text)))\nprint(rows[1][0] + rows[1][1])',
      options: ["12", "3", "['1', '2']", "Error"], answer: 0,
      hint: "CSV fields are strings, so + concatenates them." }
  },
  {
    id: "i23", section: "tool-shed", track: "intermediate", title: "JSON: Reading & Writing Data",
    explain: "JSON is the universal data-exchange format, and Python's json module converts it to dicts and lists in one call. It is how APIs, configs, and saved game states travel.",
    takeaways: [
      "json.loads(text) parses a JSON string into Python objects.",
      "json.dumps(obj) turns dicts/lists back into a JSON string.",
      "JSON keys are always strings; tuples become lists."
    ],
    code: 'import json\n\ndata = {"name": "Al", "scores": [88, 92]}\ntext = json.dumps(data)\nback = json.loads(text)\n\nprint(text)\nprint(back["scores"][0])',
    quiz: [
      { q: "json.loads() converts a JSON string into what?",
        options: ["A Python dict/list", "Another string", "A file object", "Bytes"],
        answer: 0, why: "loads parses JSON text into real Python objects like dicts and lists." },
      { q: "Which converts a Python dict to a JSON string?",
        options: ["json.dumps()", "json.loads()", "json.parse()", "str()"],
        answer: 0, why: "dumps (dump-string) serializes; loads (load-string) parses." },
      { q: "What happens to the tuple (1, 2) in json.dumps?",
        options: ["It becomes [1, 2]", "It stays (1, 2)", "It becomes \"1,2\"", "Error"],
        answer: 0, why: "JSON has no tuples, so they serialize as arrays." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import json\n\ns = "{\\"x\\": [1, 2]}"\nd = json.loads(s)\nprint(d["x"][1] * 10)',
      options: ["20", "12", "2", "Error"], answer: 0,
      hint: "Parse first, then index: d['x'] is [1, 2]." }
  },
  {
    id: "i24", section: "tool-shed", track: "intermediate", title: "Files & Folders with pathlib",
    explain: "pathlib treats paths as objects with handy methods instead of fragile string juggling. Path('a') / 'b' joins paths, and .exists(), .mkdir(), .glob() cover everyday file chores.",
    takeaways: [
      "Path('docs') / 'notes.txt' joins paths with /.",
      ".exists(), .is_file(), .mkdir(parents=True) inspect and create.",
      ".glob('*.py') lists matching files in a folder."
    ],
    code: 'from pathlib import Path\n\np = Path("projects") / "demo" / "notes.txt"\n\nprint(p.name)\nprint(p.suffix)\nprint(p.parent)',
    quiz: [
      { q: "What does Path('a') / 'b.txt' produce?",
        options: ["Path('a/b.txt')", "'a' + 'b.txt'", "Error — / is division", "['a', 'b.txt']"],
        answer: 0, why: "Path overloads / to join path parts cleanly." },
      { q: "Which lists all .py files in a folder?",
        options: ["Path('.').glob('*.py')", "Path('.').list('.py')", "glob lives in the os module only", "Path('.').find('*.py')"],
        answer: 0, why: "glob(pattern) yields every path matching the pattern." },
      { q: "What does p.suffix return for Path('a/b.txt')?",
        options: ["'.txt'", "'b.txt'", "'txt'", "'a/b'"],
        answer: 0, why: "suffix is the file extension, including the dot." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from pathlib import Path\n\np = Path("data") / "x.csv"\nprint(p.stem)\nprint(p.parent.name)',
      options: ["x\ndata", "x.csv\ndata", ".csv\nx", "Error"], answer: 0,
      hint: "stem is the name without extension; parent.name is the folder name." }
  },
  {
    id: "i25", section: "object-castle", track: "intermediate", title: "OOP: Inheritance",
    explain: "Inheritance lets a child class reuse and extend a parent class: the child gets all parent methods for free and can override the ones it wants to change. Use super() to call the parent's version.",
    takeaways: [
      "class Dog(Animal): makes Dog inherit everything from Animal.",
      "Override a method by redefining it in the child class.",
      "super().__init__(...) calls the parent's constructor."
    ],
    code: 'class Animal:\n    def __init__(self, name):\n        self.name = name\n    def speak(self):\n        return "..."\nclass Dog(Animal):\n    def speak(self):\n        return "Woof!"\nd = Dog("Rex")\nprint(d.name, "says", d.speak())',
    quiz: [
      { q: "What does class Dog(Animal): mean?",
        options: ["Dog inherits from Animal", "Dog contains an Animal", "Animal inherits from Dog", "It is a syntax error"],
        answer: 0, why: "The parent class goes in parentheses after the child class name." },
      { q: "What does super().__init__(name) do in a child class?",
        options: ["Calls the parent's __init__", "Skips the parent's __init__", "Creates a second object", "Deletes the parent"],
        answer: 0, why: "super() gives access to the parent so you can reuse its setup code." },
      { q: "If Dog does not define speak(), but Animal does, what happens on d.speak()?",
        options: ["Animal's speak() runs", "AttributeError", "Nothing happens", "It returns None silently"],
        answer: 0, why: "Missing methods are looked up on the parent class automatically." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class A:\n    def hi(self):\n        return "A"\n\nclass B(A):\n    def hi(self):\n        return "B+" + super().hi()\n\nprint(B().hi())',
      options: ["B+A", "A", "B", "Error"], answer: 0,
      hint: "super().hi() calls A's version, returning 'A'." }
  },
  {
    id: "i26", section: "object-castle", track: "intermediate", title: "OOP: Encapsulation with @property",
    explain: "@property lets a method masquerade as an attribute, so you can add validation or computed values later without changing how anyone uses your class. Setters guard what values are allowed in.",
    takeaways: [
      "@property makes a method readable like an attribute: obj.area.",
      "@x.setter validates new values before storing them.",
      "It keeps the simple obj.x API while hiding logic underneath."
    ],
    code: 'class Circle:\n    def __init__(self, r):\n        self.r = r\n\n    @property\n    def area(self):\n        return 3.14 * self.r ** 2\n\nc = Circle(10)\nprint(round(c.area))',
    quiz: [
      { q: "How do you read a @property named area on c?",
        options: ["c.area (no parentheses)", "c.area()", "c.get_area()", "Circle.area(c)"],
        answer: 0, why: "A property is accessed like a plain attribute — the method runs behind the scenes." },
      { q: "What is @x.setter used for?",
        options: ["Validating values assigned to x", "Deleting x", "Making x read-only", "Copying x"],
        answer: 0, why: "The setter intercepts assignment so you can reject bad values." },
      { q: "Why use @property instead of a plain attribute?",
        options: ["You can add logic/validation later without changing callers", "It uses less memory", "It is required by Python", "Attributes cannot store numbers"],
        answer: 0, why: "Callers keep writing obj.x while you sneak in computed or guarded behavior." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Temp:\n    def __init__(self, c):\n        self.c = c\n\n    @property\n    def f(self):\n        return self.c * 9 / 5 + 32\n\nprint(Temp(100).f)',
      options: ["212.0", "100", "373.0", "Error"], answer: 0,
      hint: "100°C × 9/5 + 32 = 212°F." }
  },
  {
    id: "i27", section: "object-castle", track: "intermediate", title: "OOP: Dunder Methods (__str__, __len__, __eq__)",
    explain: "Dunder (double-underscore) methods let your objects speak Python's native language: __str__ for printing, __len__ for len(), __eq__ for ==. Implement them and your class feels built-in.",
    takeaways: [
      "__str__ controls what print(obj) shows.",
      "__len__ makes len(obj) work.",
      "__eq__ defines what == means for your objects."
    ],
    code: 'class Playlist:\n    def __init__(self, songs):\n        self.songs = songs\n    def __str__(self):\n        return ", ".join(self.songs)\n    def __len__(self):\n        return len(self.songs)\n\np = Playlist(["a", "b", "c"])\nprint(p, "|", len(p))',
    quiz: [
      { q: "Which dunder method controls print(obj)?",
        options: ["__str__", "__len__", "__init__", "__print__"],
        answer: 0, why: "Python calls __str__ whenever your object needs a readable string form." },
      { q: "What must __len__ return?",
        options: ["A non-negative int", "A string", "A list", "Anything"],
        answer: 0, why: "len() expects __len__ to give back a non-negative integer." },
      { q: "Without __eq__, what does == compare for objects?",
        options: ["Identity (same object in memory)", "All attribute values", "Their __str__ output", "Their types"],
        answer: 0, why: "The default == only checks whether both names point to the very same object." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Box:\n    def __init__(self, v):\n        self.v = v\n    def __eq__(self, other):\n        return self.v == other.v\n\nprint(Box(5) == Box(5))\nprint(Box(5) == Box(6))',
      options: ["True\nFalse", "False\nFalse", "True\nTrue", "Error"], answer: 0,
      hint: "__eq__ compares the .v values, not object identity." }
  },
  {
    id: "i28", section: "object-castle", track: "intermediate", title: "OOP: Class vs Instance, @classmethod & @staticmethod",
    explain: "Instance methods work on one object (self); class methods work on the class itself (cls) and make great alternate constructors; static methods are plain functions that just live in the class namespace.",
    takeaways: [
      "Instance attributes live on self; class attributes are shared by all instances.",
      "@classmethod takes cls — use it for alternate constructors like from_string().",
      "@staticmethod takes neither self nor cls — just namespaced helper logic."
    ],
    code: 'class User:\n    count = 0\n    def __init__(self, name):\n        self.name = name\n        User.count += 1\n    @classmethod\n    def from_csv(cls, s):\n        return cls(s.split(",")[0])\nu = User.from_csv("Al,20")\nprint(u.name, User.count)',
    quiz: [
      { q: "What is the first parameter of a @classmethod?",
        options: ["cls", "self", "Nothing", "args"],
        answer: 0, why: "Class methods receive the class itself as cls, not an instance." },
      { q: "Where is a class attribute like count stored?",
        options: ["On the class, shared by all instances", "Copied into each instance", "In a global variable", "On the first instance only"],
        answer: 0, why: "Class attributes live on the class object, so every instance sees the same one." },
      { q: "When is @staticmethod the right choice?",
        options: ["A helper that needs neither self nor cls", "When you need the instance", "When you need the class", "Never — it is deprecated"],
        answer: 0, why: "Static methods are just logically-grouped functions with no access to instance or class state." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Calc:\n    @staticmethod\n    def add(a, b):\n        return a + b\n\nprint(Calc.add(2, 3))',
      options: ["5", "Error — needs an instance", "(2, 3)", "None"], answer: 0,
      hint: "Static methods can be called straight on the class." }
  },
  {
    id: "i29", section: "power-lab", track: "intermediate", title: "Iterators & the Iterator Protocol",
    explain: "An iterator is an object with __next__() that hands out one item at a time; iter() gets one from any iterable. for loops are just pretty wrappers around this protocol.",
    takeaways: [
      "iter([1, 2]) returns an iterator; next(it) pulls the next item.",
      "When items run out, next() raises StopIteration.",
      "Custom classes become iterable by defining __iter__ and __next__."
    ],
    code: 'it = iter(["a", "b"])\n\nprint(next(it))\nprint(next(it))\n\nfor x in [10, 20]:\n    print(x)',
    quiz: [
      { q: "What does next(it) do when the iterator is exhausted?",
        options: ["Raises StopIteration", "Returns None", "Restarts from the beginning", "Returns 0"],
        answer: 0, why: "StopIteration is the signal that there are no more items — for loops catch it silently." },
      { q: "What does iter([1, 2, 3]) return?",
        options: ["An iterator over the list", "The list itself", "The number 1", "A copy of the list"],
        answer: 0, why: "iter() builds a fresh iterator object that tracks position separately from the list." },
      { q: "Which two methods make a custom iterator?",
        options: ["__iter__ and __next__", "__init__ and __str__", "__get__ and __set__", "__call__ and __len__"],
        answer: 0, why: "__iter__ returns the iterator and __next__ produces each item — that is the protocol." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'it = iter([5, 6])\nfirst = next(it)\nrest = list(it)\nprint(first)\nprint(rest)',
      options: ["5\n[6]", "[5, 6]\n5", "5\n[5, 6]", "Error"], answer: 0,
      hint: "The first next() consumes 5, so list() only sees what is left." }
  },
  {
    id: "i30", section: "power-lab", track: "intermediate", title: "Generator Expressions & itertools",
    explain: "Generator expressions (x*2 for x in data) compute values lazily, one at a time — perfect for huge sequences. itertools adds pro tools like count(), cycle(), and chain() for combining iterables.",
    takeaways: [
      "(x*x for x in range(10**9)) uses almost no memory — values are made on demand.",
      "itertools.count(5) is an infinite counter; pair with islice to take a few.",
      "itertools.chain(a, b) loops over a then b as one stream."
    ],
    code: 'import itertools\n\ngen = (x * x for x in range(5))\nprint(list(gen))\n\ncombo = itertools.chain("ab", [1, 2])\nprint(list(combo))',
    quiz: [
      { q: "How is (x for x in data) different from [x for x in data]?",
        options: ["It is lazy — values are produced one at a time", "It is faster for small lists", "There is no difference", "It returns a tuple"],
        answer: 0, why: "Parentheses make a generator: nothing is computed until you iterate." },
      { q: "What does itertools.chain('ab', [1]) yield?",
        options: ["'a', 'b', 1", "('ab', [1])", "'ab1'", "Error"],
        answer: 0, why: "chain flattens its arguments into one continuous stream of items." },
      { q: "Why use a generator for 10**9 items?",
        options: ["It never stores them all in memory", "It runs 100x faster", "Lists cannot hold that many", "Generators sort automatically"],
        answer: 0, why: "A generator holds only its current state, so memory stays tiny no matter the size." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import itertools\n\nc = itertools.count(10)\nprint([next(c) for _ in range(3)])',
      options: ["[10, 11, 12]", "[0, 1, 2]", "Infinite loop", "Error"], answer: 0,
      hint: "count(10) starts at 10 and steps by 1." }
  },
  {
    id: "i31", section: "algorithm-arena", track: "intermediate", title: "Recursion Patterns & Limits",
    explain: "Recursion solves a problem by solving smaller copies of itself, with a base case that stops the descent. Python caps the call stack (~1000 frames), so deep recursion needs a loop instead.",
    takeaways: [
      "Every recursive function needs a base case, or it recurses forever.",
      "Trace small inputs by hand: f(3) → f(2) → f(1) → base.",
      "Python's default recursion limit is 1000 — deep recursion raises RecursionError."
    ],
    code: 'def countdown(n):\n    if n <= 0:\n        return "done"\n    print(n)\n    return countdown(n - 1)\n\nprint(countdown(3))',
    quiz: [
      { q: "What happens without a base case?",
        options: ["RecursionError after ~1000 calls", "It runs forever harmlessly", "It returns None", "SyntaxError"],
        answer: 0, why: "Python's call stack has a limit; endless recursion hits RecursionError." },
      { q: "What does countdown(3) print first?",
        options: ["3", "1", "done", "0"],
        answer: 0, why: "It prints n before recursing, so 3 comes out first." },
      { q: "How deep can Python recurse by default?",
        options: ["About 1000 frames", "Unlimited", "About 100 frames", "About 10 million"],
        answer: 0, why: "sys.getrecursionlimit() defaults to 1000 to protect the C stack." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def f(n):\n    if n == 0:\n        return 0\n    return n + f(n - 1)\n\nprint(f(4))',
      options: ["10", "4", "24", "0"], answer: 0,
      hint: "4 + 3 + 2 + 1 + 0 — it sums down to the base case." }
  },
  {
    id: "i32", section: "power-lab", track: "intermediate", title: "Closures & Higher-Order Functions",
    explain: "A closure is a function that remembers variables from the scope where it was created. Functions that take or return other functions — like decorators do — are called higher-order functions.",
    takeaways: [
      "An inner function keeps access to its enclosing function's variables.",
      "return inner (no parens) hands back the function itself.",
      "Higher-order functions take functions as args or return them."
    ],
    code: 'def make_adder(n):\n    def adder(x):\n        return x + n\n    return adder\n\nadd5 = make_adder(5)\nprint(add5(10))\nprint(add5(20))',
    quiz: [
      { q: "What does make_adder(5) return?",
        options: ["A function that adds 5 to its argument", "15", "The number 5", "None"],
        answer: 0, why: "It returns the inner adder function, which still remembers n=5." },
      { q: "What makes adder a closure?",
        options: ["It remembers n from make_adder's scope", "It is defined with lambda", "It takes two arguments", "It is recursive"],
        answer: 0, why: "A closure captures variables from its enclosing scope even after that scope exits." },
      { q: "What is a higher-order function?",
        options: ["One that takes or returns functions", "One with many parameters", "One defined inside a class", "One that calls itself"],
        answer: 0, why: "Treating functions as values — passing or returning them — is the definition." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def power(exp):\n    def calc(base):\n        return base ** exp\n    return calc\n\nsquare = power(2)\nprint(square(6))',
      options: ["36", "12", "64", "Error"], answer: 0,
      hint: "square remembers exp=2, so it computes 6**2." }
  },
  {
    id: "i33", section: "algorithm-arena", track: "intermediate", title: "Big-O Intuition & Timing Code",
    explain: "Big-O describes how runtime grows as input grows: O(1) stays flat, O(n) grows linearly, O(n²) explodes. time.perf_counter() lets you measure the difference yourself.",
    takeaways: [
      "O(1): constant — dict lookup. O(n): loop once. O(n²): loop inside a loop.",
      "Doubling n doubles O(n) time but quadruples O(n²) time.",
      "Use time.perf_counter() around code to measure real seconds."
    ],
    code: 'import time\n\nstart = time.perf_counter()\ntotal = sum(range(10**6))\nelapsed = time.perf_counter() - start\n\nprint(total)\nprint(round(elapsed, 3), "seconds")',
    quiz: [
      { q: "A double loop over n items is which complexity?",
        options: ["O(n²)", "O(n)", "O(1)", "O(2n)"],
        answer: 0, why: "n iterations × n inner iterations = n² total steps." },
      { q: "If O(n²) code takes 1s for n=1000, roughly how long for n=2000?",
        options: ["~4 seconds", "~2 seconds", "~1 second", "~8 seconds"],
        answer: 0, why: "Doubling n quadruples n² work: 2² = 4." },
      { q: "Which is O(1)?",
        options: ["d[key] dict lookup", "Finding max in a list", "Sorting a list", "Summing a list"],
        answer: 0, why: "Hash lookup takes the same time regardless of dict size." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import time\n\nt0 = time.perf_counter()\ns = 0\nfor i in range(1000):\n    s += i\nt1 = time.perf_counter()\nprint(s)\nprint((t1 - t0) >= 0)',
      options: ["499500\nTrue", "499500 / False", "0 / True", "Error"], answer: 0,
      hint: "Sum of 0..999 is 499500; elapsed time is always >= 0." }
  },
  {
    id: "i34", section: "algorithm-arena", track: "intermediate", title: "Regular Expressions Basics",
    explain: "Regular expressions are mini-patterns for finding text: \\d matches digits, + means 'one or more', and re.findall() pulls out every match. One line of regex replaces paragraphs of string-splitting code.",
    takeaways: [
      "re.findall(r'\\d+', s) extracts all number chunks from s.",
      "\\d = digit, \\w = word char, . = any char, + = one-or-more.",
      "Use raw strings r'...' so backslashes stay intact."
    ],
    code: 'import re\n\ns = "Call 555-1234 or 555-9999"\nnums = re.findall(r"\\d+", s)\n\nprint(nums)\nprint(re.sub(r"\\d", "#", "abc123"))',
    quiz: [
      { q: "What does re.findall(r'\\d+', 'a12b3') return?",
        options: ["['12', '3']", "['1', '2', '3']", "'12b3'", "[]"],
        answer: 0, why: "+ grabs one-or-more digits together, so '12' is one match." },
      { q: "Why use raw strings r'...' for regex?",
        options: ["So \\d stays a backslash-d, not an escape", "They run faster", "They are required by re", "They enable Unicode"],
        answer: 0, why: "Without r'', Python would turn \\d into an escape before regex sees it." },
      { q: "What does re.sub(r'\\d', '#', 'a1b2') produce?",
        options: ["'a#b#'", "'##'", "'a1b2'", "'a#b2'"],
        answer: 0, why: "sub replaces every single digit with #, leaving letters alone." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import re\n\ntext = "hi there!"\nwords = re.findall(r"\\w+", text)\nprint(words)',
      options: ["['hi', 'there']", "['hi there!']", "['h', 'i']", "Error"], answer: 0,
      hint: "\\w+ matches runs of word characters — punctuation splits them." }
  },
  {
    id: "i35", section: "tool-shed", track: "intermediate", title: "Capstone: File Organizer Script",
    explain: "Time to combine everything: this script scans a folder and sorts files into subfolders by extension. It uses pathlib, dicts, loops, and functions — the full intermediate toolkit in one real program.",
    takeaways: [
      "pathlib's .suffix and .iterdir() make file scanning painless.",
      "A dict mapping extensions → folder names drives the whole sort.",
      "mkdir(exist_ok=True) safely creates folders that may already exist."
    ],
    code: 'from pathlib import Path\n\ndef organize(folder, mapping):\n    for f in Path(folder).iterdir():\n        if f.is_file() and f.suffix in mapping:\n            dest = Path(folder) / mapping[f.suffix]\n            dest.mkdir(exist_ok=True)\n            print(f, "->", dest.name)\n\norganize("downloads", {".jpg": "images", ".pdf": "docs"})',
    quiz: [
      { q: "What does Path(folder).iterdir() yield?",
        options: ["Each file/folder inside", "Only .txt files", "The folder's parent", "File contents"],
        answer: 0, why: "iterdir() iterates over every entry directly inside the folder." },
      { q: "Why mkdir(exist_ok=True)?",
        options: ["It will not crash if the folder already exists", "It deletes existing folders", "It is faster", "It creates files too"],
        answer: 0, why: "exist_ok=True makes repeat runs safe instead of raising FileExistsError." },
      { q: "How does the script decide where a file goes?",
        options: ["Looks up its .suffix in the mapping dict", "Asks the user each time", "Sorts by file size", "Uses the file's creation date"],
        answer: 0, why: "The mapping dict pairs each extension with its destination folder name." }
    ],
    challenge: { type: "blank", prompt: "Fill the blank so photos (.jpg) go to the 'images' folder.",
      code: 'mapping = {____: "images"}\nprint(mapping[".jpg"])  # prints images',
      answer: ['".jpg"'],
      hint: "The key must match f.suffix for a photo file." }
  },
{
    id: "i36", section: "algorithm-arena", track: "intermediate", title: "Big-O in Practice: Measuring What Matters",
    explain: "Big-O is a way to describe how an algorithm's work grows as its input grows. Instead of timing code on one machine, you count the steps — that tells you whether doubling the input doubles the work, or makes it explode.",
    takeaways: [
      "`O(1)` means the work stays flat no matter how big the input is.",
      "`O(n)` means doubling the input roughly doubles the work.",
      "`O(n^2)` means doubling the input roughly quadruples the work — nested loops are the usual suspect."
    ],
    code: 'def steps_linear(nums, target):\n    steps = 0\n    for x in nums:\n        steps += 1\n        if x == target:\n            return steps\n    return steps\n\nnums = list(range(100))\nprint(steps_linear(nums, 99))\nprint(steps_linear(nums, 0))\nprint(len(nums) * len(nums))',
    quiz: [
      { q: "A function loops once over n items. What is its Big-O?",
        options: ["O(n)", "O(1)", "O(log n)", "O(n^2)"],
        answer: 0, why: "One pass over n items does n steps, so it is O(n)." },
      { q: "You double n and the runtime roughly quadruples. Which complexity is it?",
        options: ["O(1)", "O(log n)", "O(n^2)", "O(n)"],
        answer: 2, why: "Doubling n multiplies n^2 work by 2^2 = 4." },
      { q: "Why do programmers count steps instead of just timing code?",
        options: ["Step counts depend on the machine, timings do not", "Timings change with the machine and load, step counts do not", "Counting steps is faster to run", "Timing is the only honest measure"],
        answer: 1, why: "The same code can time differently on different machines, but its step count grows the same way." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'count = 0\nfor i in range(3):\n    for j in range(4):\n        count += 1\nprint(count)',
      options: ["7", "12", "9", "6"], answer: 1,
      hint: "The outer loop runs 3 times and the inner loop runs 4 times for each of those." }
  },
  {
    id: "i37", section: "algorithm-arena", track: "intermediate", title: "Arrays vs Lists: How Python Lists Work",
    explain: "A Python list is backed by a dynamic array: a block of memory that grows when you append. That is why indexing is instant, appending is usually cheap, and inserting at the front is slow.",
    takeaways: [
      "`nums[i]` reads any position in O(1) time.",
      "`append()` is O(1) on average — the list grows its backing array in chunks.",
      "`insert(0, x)` is O(n) because every item must shift one place right."
    ],
    code: 'nums = [10, 20, 30]\nnums.append(40)\nnums.insert(1, 15)\nprint(nums)\nprint(nums[2])\nprint(len(nums))',
    quiz: [
      { q: "What is the cost of nums[100] in a list of a million items?",
        options: ["O(log n)", "O(n^2)", "O(n)", "O(1)"],
        answer: 3, why: "Indexing jumps straight to the position, so it takes the same time regardless of size." },
      { q: "Why is insert(0, x) slow on a long list?",
        options: ["Every existing item shifts one place", "It sorts the list first", "It allocates a new list each time", "It copies the whole list"],
        answer: 0, why: "Each item after the front must move right to make room." },
      { q: "What does append() usually cost?",
        options: ["O(n)", "O(n^2)", "O(1) on average", "O(log n)"],
        answer: 2, why: "Python grows the backing array in chunks, so most appends just write into a free slot." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'a = [10, 20, 30]\na.insert(1, 15)\nprint(a)\nprint(a[2])',
      options: ["[10, 20, 15, 30] / 15", "[15, 10, 20, 30] / 20", "[10, 15, 20, 30] / 15", "[10, 15, 20, 30]\n20"], answer: 3,
      hint: "insert(1, 15) slides 20 and 30 one place to the right." }
  },
  {
    id: "i38", section: "algorithm-arena", track: "intermediate", title: "Two Pointers Technique",
    explain: "Two pointers means keeping a left index and a right index and moving them toward each other. It turns many O(n^2) pair problems on sorted data into a single O(n) pass.",
    takeaways: [
      "Start one pointer at each end of a sorted list.",
      "Move the pointer whose side is too small or too big — never both at once.",
      "The loop stops when the pointers meet or cross."
    ],
    code: 'def has_pair(nums, target):\n    left, right = 0, len(nums) - 1\n    while left < right:\n        s = nums[left] + nums[right]\n        if s == target:\n            return True\n        if s < target:\n            left += 1\n        else:\n            right -= 1\n    return False\n\nprint(has_pair([1, 2, 4, 7, 9], 11))\nprint(has_pair([1, 2, 4, 7, 9], 20))',
    quiz: [
      { q: "Two pointers works best on what kind of data?",
        options: ["Unsorted lists", "Sorted lists", "Dictionaries", "Sets"],
        answer: 1, why: "Sorted order tells you which pointer to move after each comparison." },
      { q: "In a pair-sum search, the sum is too small. What do you do?",
        options: ["Move both pointers", "Restart from the start", "Move the right pointer left", "Move the left pointer right"],
        answer: 3, why: "Raising the left pointer increases the sum, since the list is sorted." },
      { q: "What is the time complexity of the two-pointer pair search?",
        options: ["O(n)", "O(n log n)", "O(1)", "O(n^2)"],
        answer: 0, why: "Each step moves one pointer, so every item is visited at most once." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [1, 2, 3, 4]\nleft, right = 0, 3\nwhile left < right:\n    nums[left], nums[right] = nums[right], nums[left]\n    left += 1\n    right -= 1\nprint(nums)',
      options: ["[4, 3, 2, 1]", "[2, 1, 4, 3]", "[4, 3, 2, 1, 0]", "[1, 2, 3, 4]"], answer: 0,
      hint: "The pointers swap the ends, then step inward until they meet." }
  },
  {
    id: "i39", section: "algorithm-arena", track: "intermediate", title: "Sliding Window Technique",
    explain: "A sliding window keeps a running total over a fixed-size slice of a list, then slides it one step at a time. Instead of re-adding k items for every window, you subtract the item leaving and add the one entering.",
    takeaways: [
      "A window of size k covers k neighbouring items.",
      "Slide by adding nums[i] and subtracting nums[i - k].",
      "Sliding turns an O(n * k) job into O(n)."
    ],
    code: 'nums = [2, 1, 5, 1, 3, 2]\nk = 3\nwindow = sum(nums[:k])\nbest = window\nfor i in range(k, len(nums)):\n    window += nums[i] - nums[i - k]\n    best = max(best, window)\nprint(best)',
    quiz: [
      { q: "What is the cost of finding every window sum of size k by re-adding each window?",
        options: ["O(log n)", "O(n)", "O(n * k)", "O(k)"],
        answer: 2, why: "There are about n windows and each one adds k items." },
      { q: "When the window slides one step right, what changes?",
        options: ["Nothing changes", "One item leaves and one enters", "The whole window is rebuilt", "k grows by one"],
        answer: 1, why: "Only the leftmost item drops out and a new rightmost item comes in." },
      { q: "Which problem fits a sliding window?",
        options: ["Sorting the list", "Counting all pairs", "Reversing the list", "Finding the largest sum of any 3 neighbours"],
        answer: 3, why: "It asks about a fixed-size run of neighbours, which is exactly what a window covers." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [1, 2, 3, 4, 5]\ns = sum(nums[:2])\nprint(s)\ns += nums[2] - nums[0]\nprint(s)',
      options: ["5 / 5", "2 / 4", "3\n5", "3 / 3"], answer: 2,
      hint: "First window is 1 + 2; sliding drops 1 and adds 3." }
  },
  {
    id: "i40", section: "algorithm-arena", track: "intermediate", title: "Prefix Sums",
    explain: "A prefix sum is a running total: prefix[i] is the sum of the first i items. Once you have it, the sum of any slice is one subtraction, no matter how long the slice is.",
    takeaways: [
      "Build prefix once in O(n): prefix[i + 1] = prefix[i] + nums[i].",
      "Sum of nums[a:b] is prefix[b] - prefix[a].",
      "Start prefix with 0 so slices starting at index 0 work too."
    ],
    code: 'nums = [2, 4, 1, 3]\nprefix = [0]\nfor n in nums:\n    prefix.append(prefix[-1] + n)\nprint(prefix)\nprint(prefix[3] - prefix[1])',
    quiz: [
      { q: "After building a prefix array, what does prefix[b] - prefix[a] give?",
        options: ["Sum of nums[a:b]", "Sum of the whole list", "The value at index b", "The average of nums[a:b]"],
        answer: 0, why: "The two running totals cancel everything before a, leaving just the slice." },
      { q: "How long does it take to build the prefix array?",
        options: ["O(log n)", "O(1)", "O(n)", "O(n^2)"],
        answer: 2, why: "You walk the list once, adding each item to the running total." },
      { q: "Why does prefix start with 0?",
        options: ["To make the list longer", "So slices starting at 0 work with the same subtraction", "Python requires it", "To store the total at the front"],
        answer: 1, why: "With prefix[0] = 0, nums[0:b] is prefix[b] - 0, the same formula as any other slice." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [5, 1, 2]\nprefix = [0]\nfor n in nums:\n    prefix.append(prefix[-1] + n)\nprint(prefix[2])',
      options: ["5", "6", "8", "3"], answer: 1,
      hint: "prefix[2] is 5 + 1." }
  },
  {
    id: "i41", section: "algorithm-arena", track: "intermediate", title: "Hash Maps in Practice: Frequency Counting",
    explain: "A hash map (a dict) stores each key so it can be found in O(1) time. Counting frequencies is its classic job: walk the data once, and bump the count for each item you meet.",
    takeaways: [
      "`counts.get(word, 0) + 1` bumps a count without a KeyError.",
      "`collections.Counter` does the same job in one line.",
      "Frequency counting is O(n): one pass, one dict update per item."
    ],
    code: 'words = ["apple", "banana", "apple", "kiwi", "banana", "apple"]\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)\nprint(counts["apple"])',
    quiz: [
      { q: "What does counts.get('apple', 0) return if 'apple' is not a key yet?",
        options: ["None", "1", "KeyError", "0"],
        answer: 3, why: "get() returns the default 0 instead of raising an error." },
      { q: "What is the cost of looking up a key in a dict?",
        options: ["O(1) on average", "O(n^2)", "O(n)", "O(log n)"],
        answer: 0, why: "Hashing jumps straight to the right bucket, whatever the dict size." },
      { q: "Which tool counts items in one line?",
        options: ["enumerate()", "zip()", "collections.Counter", "sorted()"],
        answer: 2, why: "Counter(iterable) builds a dict of item counts for you." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from collections import Counter\nprint(Counter("aabbc")["a"])\nprint(Counter("aabbc").most_common(1))',
      options: ["3 / [('b', 2)]", "2 / [('b', 2)]", "1 / [('a', 1)]", "2\n[('a', 2)]"], answer: 3,
      hint: "Count the a's in 'aabbc', then ask for the single most common item." }
  },
  {
    id: "i42", section: "algorithm-arena", track: "intermediate", title: "Anagram & Grouping Problems",
    explain: "Two words are anagrams when they contain exactly the same letters. Sorting the letters gives both words the same key, so a dict can group every anagram family in one pass.",
    takeaways: [
      "sorted(word) is the same for every anagram of that word.",
      "Use the sorted letters as the dict key and the word list as the value.",
      "Grouping anagrams this way costs O(n * k log k), where k is word length."
    ],
    code: 'words = ["eat", "tea", "tan", "ate", "nat", "bat"]\ngroups = {}\nfor w in words:\n    key = "".join(sorted(w))\n    groups.setdefault(key, []).append(w)\nprint(groups["aet"])\nprint(len(groups))',
    quiz: [
      { q: "Why does sorted() make a good anagram key?",
        options: ["It removes duplicate letters", "Anagrams sort to the same string", "It counts the letters", "It reverses the word"],
        answer: 1, why: "Same letters in any order sort into the same sequence." },
      { q: "What does groups.setdefault(key, []) do?",
        options: ["Sorts the group", "Counts the group", "Deletes the key", "Returns the list for the key, creating it if missing"],
        answer: 3, why: "setdefault hands you the existing list, or stores a fresh empty one first." },
      { q: "Are 'listen' and 'silent' anagrams?",
        options: ["Yes", "No", "Only if lowercased", "Only if sorted differently"],
        answer: 0, why: "They use exactly the same letters, just in a different order." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(sorted("listen") == sorted("silent"))\nprint(sorted("hello") == sorted("world"))',
      options: ["True\nFalse", "False / True", "True / True", "False / False"], answer: 0,
      hint: "Compare the sorted letters of each pair." }
  },
  {
    id: "i43", section: "algorithm-arena", track: "intermediate", title: "Stacks: Balanced Parentheses",
    explain: "A stack is a last-in, first-out pile: you push items on top and pop them off the top. Balanced brackets are its classic test — every closing bracket must match the most recent unclosed opener.",
    takeaways: [
      "Push every opener; on a closer, pop and check it matches.",
      "A closer with an empty stack means the string is unbalanced.",
      "At the end the stack must be empty — leftovers are unclosed openers."
    ],
    code: 'def balanced(s):\n    stack = []\n    pairs = {")": "(", "]": "[", "}": "{"}\n    for ch in s:\n        if ch in "([{":\n            stack.append(ch)\n        elif ch in ")]}":\n            if not stack or stack.pop() != pairs[ch]:\n                return False\n    return not stack\n\nprint(balanced("([{}])"))\nprint(balanced("([)]"))\nprint(balanced("(("))',
    quiz: [
      { q: "Which operation removes the top item of a stack?",
        options: ["remove()", "append()", "pop()", "insert(0, x)"],
        answer: 2, why: "pop() takes the last item pushed, which is the top of the stack." },
      { q: "What does a closing bracket do in the balance check?",
        options: ["It is pushed", "It pops the stack and must match the opener", "It is ignored", "It clears the stack"],
        answer: 1, why: "The closer must pair with the most recent opener, which sits on top." },
      { q: "Why is '([)]' unbalanced?",
        options: ["It is too short", "Stacks cannot hold brackets", "It has too many brackets", "The ] closes ( before ) is closed"],
        answer: 3, why: "The ] meets ( on top instead of its matching [, so the pairs cross." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'stack = []\nstack.append("a")\nstack.append("b")\nstack.append("c")\nprint(stack.pop())\nprint(stack)',
      options: ["c / ['a', 'b', 'c']", "b / ['a', 'c']", "c\n['a', 'b']", "a / ['b', 'c']"], answer: 2,
      hint: "pop() returns the last item pushed." }
  },
  {
    id: "i44", section: "algorithm-arena", track: "intermediate", title: "Queues: Print Spooler Simulation",
    explain: "A queue is first-in, first-out: the first job in is the first job out, like a printer spooler. Python's collections.deque gives you that with O(1) appends and pops from either end.",
    takeaways: [
      "`append()` adds to the back; `popleft()` takes from the front.",
      "A queue is FIFO — the opposite of a stack.",
      "Use deque, not a list: list.pop(0) shifts every item and costs O(n)."
    ],
    code: 'from collections import deque\nqueue = deque(["report.pdf", "photo.png", "notes.txt"])\nprint(queue.popleft())\nqueue.append("slides.pdf")\nprint(queue.popleft())\nprint(list(queue))',
    quiz: [
      { q: "Which end does a print spooler serve first?",
        options: ["The oldest waiting job", "A random job", "The shortest job", "The most recent job"],
        answer: 0, why: "Queues are FIFO: the job that has waited longest goes first." },
      { q: "What does popleft() do on a deque?",
        options: ["Clears the deque", "Removes the last item", "Removes the first item", "Removes a random item"],
        answer: 2, why: "popleft takes from the front, the end where the oldest items wait." },
      { q: "Why is deque better than a list for a queue?",
        options: ["It uses less memory", "pop(0) on a list is O(n), popleft() on a deque is O(1)", "Lists cannot hold strings", "Deque sorts the items"],
        answer: 1, why: "Removing the front of a list shifts everything; a deque just moves a pointer." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from collections import deque\nq = deque([1, 2, 3])\nq.append(4)\nprint(q.popleft())\nprint(list(q))',
      options: ["2 / [3, 4]", "1\n[2, 3, 4]", "4 / [1, 2, 3]", "1 / [1, 2, 3]"], answer: 1,
      hint: "append() adds 4 at the back; popleft() takes 1 from the front." }
  },
  {
    id: "i45", section: "algorithm-arena", track: "intermediate", title: "Deques with collections.deque",
    explain: "A deque (double-ended queue) is a list you can grow or shrink from either end in O(1) time. It is the right tool whenever you need a queue, a stack, or a sliding window of recent items.",
    takeaways: [
      "`appendleft()` and `popleft()` work on the left end; `append()` and `pop()` on the right.",
      "`rotate(1)` moves the last item to the front.",
      "`deque(items, maxlen=n)` drops old items automatically when full."
    ],
    code: 'from collections import deque\nd = deque([2, 3])\nd.appendleft(1)\nd.append(4)\nprint(list(d))\nd.rotate(1)\nprint(list(d))\nprint(d.popleft())',
    quiz: [
      { q: "What does deque.rotate(1) do?",
        options: ["Sorts the deque", "Removes the first item", "Reverses the deque", "Moves the last item to the front"],
        answer: 3, why: "Rotating by 1 shifts every item one place right, wrapping the last one to the front." },
      { q: "What happens when you append to a full maxlen deque?",
        options: ["The oldest item on the other end drops off", "It grows anyway", "The new item is ignored", "It raises an error"],
        answer: 0, why: "A bounded deque makes room by discarding the item at the opposite end." },
      { q: "Which operations are O(1) on a deque?",
        options: ["Sorting", "Inserting in the middle", "Appends and pops at both ends", "Indexing the middle"],
        answer: 2, why: "Deques are built for fast ends; the middle is still slow to reach." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from collections import deque\nd = deque([1, 2, 3], maxlen=3)\nd.append(4)\nprint(list(d))',
      options: ["[1, 2, 3, 4]", "[4, 2, 3]", "[1, 2, 3]", "[2, 3, 4]"], answer: 3,
      hint: "maxlen=3 means something must leave when 4 arrives." }
  },
  {
    id: "i46", section: "algorithm-arena", track: "intermediate", title: "Linked Lists: Building Your Own",
    explain: "A linked list is a chain of nodes: each node holds a value and a link to the next node. Unlike a list, it has no indexes — you reach an item by walking the chain from the head.",
    takeaways: [
      "A node stores a value and a next pointer; the last node's next is None.",
      "Walk the list with cur = cur.next until cur is None.",
      "Inserting at the head is O(1): point the new node at the old head."
    ],
    code: 'class Node:\n    def __init__(self, value, nxt=None):\n        self.value = value\n        self.next = nxt\n\nhead = Node("Ava", Node("Bo", Node("Cy")))\ncur = head\nwhile cur:\n    print(cur.value)\n    cur = cur.next',
    quiz: [
      { q: "What marks the end of a linked list?",
        options: ["An empty string", "A node whose next is None", "A node with value 0", "The head node"],
        answer: 1, why: "The last node has nowhere to point, so its next is None." },
      { q: "How do you reach the third node?",
        options: ["Call nodes.get(2)", "Jump straight to it", "nodes[2]", "Walk next twice from the head"],
        answer: 3, why: "Linked lists have no indexes; you follow next pointers from the head." },
      { q: "What is the cost of inserting at the head?",
        options: ["O(1)", "O(log n)", "O(n^2)", "O(n)"],
        answer: 0, why: "You only re-point two links, however long the chain is." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Node:\n    def __init__(self, value, nxt=None):\n        self.value = value\n        self.next = nxt\n\nhead = Node(1, Node(2))\nprint(head.value)\nprint(head.next.value)',
      options: ["1\n2", "2 / 1", "1 / None", "2 / None"], answer: 0,
      hint: "head.next is the second node." }
  },
  {
    id: "i47", section: "algorithm-arena", track: "intermediate", title: "Linked Lists: Reversal & Cycle Detection",
    explain: "Reversing a linked list means flipping every next pointer so the chain runs backwards. Cycle detection uses two pointers — a slow one and a fast one — because the fast one laps the slow one exactly when there is a loop.",
    takeaways: [
      "Reverse with three pointers: prev, cur, and nxt — flip cur.next to prev, then step forward.",
      "Floyd's cycle check: move one pointer one step and another two; if they meet, there is a cycle.",
      "Reversal is O(n) time and O(1) extra space."
    ],
    code: 'class Node:\n    def __init__(self, value, nxt=None):\n        self.value = value\n        self.next = nxt\n\ndef reverse(head):\n    prev = None\n    cur = head\n    while cur:\n        nxt = cur.next\n        cur.next = prev\n        prev = cur\n        cur = nxt\n    return prev\n\nhead = Node(1, Node(2, Node(3)))\nvals = []\ncur = reverse(head)\nwhile cur:\n    vals.append(cur.value)\n    cur = cur.next\nprint(vals)',
    quiz: [
      { q: "In reversal, what does cur.next = prev do?",
        options: ["Creates a cycle", "Deletes the node", "Points the current node back at the one before it", "Moves cur forward"],
        answer: 2, why: "It flips the link so the chain runs backwards, one node at a time." },
      { q: "How does Floyd's algorithm spot a cycle?",
        options: ["It counts the nodes", "A fast pointer laps a slow pointer and they meet", "It checks for duplicate values", "It reverses the list"],
        answer: 1, why: "On a loop the fast pointer gains one node per step, so it must eventually land on the slow one." },
      { q: "What is the extra-space cost of iterative reversal?",
        options: ["O(log n)", "O(n^2)", "O(n)", "O(1)"],
        answer: 3, why: "It reuses the existing nodes and only keeps three pointers." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Node:\n    def __init__(self, v, n=None):\n        self.value = v\n        self.next = n\n\nhead = Node(1, Node(2))\nprev = None\ncur = head\nwhile cur:\n    nxt = cur.next\n    cur.next = prev\n    prev = cur\n    cur = nxt\nprint(prev.value)\nprint(prev.next.value)',
      options: ["2 / None", "1 / None", "2\n1", "1 / 2"], answer: 2,
      hint: "After reversal the old tail is the new head." }
  },
  {
    id: "i48", section: "algorithm-arena", track: "intermediate", title: "Recursion: Base Cases & the Call Stack",
    explain: "Recursion is a function calling itself on a smaller input. Every recursive function needs a base case that answers directly, or the calls pile up on the call stack until Python stops them.",
    takeaways: [
      "The base case stops the recursion; the recursive case shrinks the problem.",
      "Each call waits on the call stack until the calls below it return.",
      "If the input never reaches the base case, Python raises RecursionError."
    ],
    code: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(4))\nprint(factorial(0))',
    quiz: [
      { q: "What is the base case for?",
        options: ["To stop the recursion with a direct answer", "To handle errors", "To print the result", "To make the function faster"],
        answer: 0, why: "Without it the function would keep calling itself forever." },
      { q: "What happens to a call while it waits for its recursive call?",
        options: ["It returns None", "It is discarded", "It stays on the call stack", "It runs in parallel"],
        answer: 2, why: "Each unfinished call keeps its own frame until the call below returns." },
      { q: "What does factorial(0) return here, and why?",
        options: ["0, because 0 times anything is 0", "1, because the base case returns 1 for n <= 1", "RecursionError", "None"],
        answer: 1, why: "The base case n <= 1 returns 1, which is the empty product." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def total(n):\n    if n == 0:\n        return 0\n    return n + total(n - 1)\n\nprint(total(3))',
      options: ["3", "6", "9", "0"], answer: 1,
      hint: "3 + 2 + 1 + 0." }
  },
  {
    id: "i49", section: "algorithm-arena", track: "intermediate", title: "Recursion: Memoization Basics",
    explain: "Memoization is remembering answers you have already computed, usually in a dict, so a recursive function never solves the same subproblem twice. It trades a little memory for a huge amount of time.",
    takeaways: [
      "Check the memo dict before computing; store the answer before returning.",
      "Memoized Fibonacci drops from O(2^n) to O(n).",
      "functools.lru_cache does the same thing as a decorator."
    ],
    code: 'memo = {}\n\ndef fib(n):\n    if n in memo:\n        return memo[n]\n    if n < 2:\n        result = n\n    else:\n        result = fib(n - 1) + fib(n - 2)\n    memo[n] = result\n    return result\n\nprint(fib(10))\nprint(len(memo))',
    quiz: [
      { q: "What does memoization store?",
        options: ["The call stack", "The input list", "The function code", "Answers to subproblems already computed"],
        answer: 3, why: "A stored answer can be reused instead of recomputed." },
      { q: "How fast is memoized Fibonacci?",
        options: ["O(n)", "O(n^2)", "O(1)", "O(2^n)"],
        answer: 0, why: "Each value from 0 to n is computed once, then reused from the memo." },
      { q: "What is the trade-off of memoization?",
        options: ["It only works for loops", "It changes the answer", "It uses extra memory to save time", "It uses extra time to save memory"],
        answer: 2, why: "The memo dict holds one entry per subproblem, buying speed with space." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'memo = {0: 0, 1: 1}\n\ndef fib(n):\n    if n in memo:\n        return memo[n]\n    memo[n] = fib(n - 1) + fib(n - 2)\n    return memo[n]\n\nprint(fib(5))\nprint(memo[5])',
      options: ["8 / 5", "5 / 8", "3 / 3", "5\n5"], answer: 3,
      hint: "fib(5) is 5, and memo[5] stores that same answer." }
  },
  {
    id: "i50", section: "algorithm-arena", track: "intermediate", title: "Binary Search, Step by Step",
    explain: "Binary search finds a value in a sorted list by checking the middle, then throwing away the half that cannot contain it. Each step halves the search space, so even a million items take about 20 steps.",
    takeaways: [
      "Binary search only works on sorted data.",
      "Compare with the middle: too small, search right; too big, search left.",
      "It runs in O(log n) time and O(1) extra space."
    ],
    code: 'def binary_search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n\nnums = [2, 5, 8, 12, 16, 23, 38]\nprint(binary_search(nums, 23))\nprint(binary_search(nums, 7))',
    quiz: [
      { q: "What must be true before you binary search a list?",
        options: ["It must be a tuple", "It must be sorted", "It must contain no duplicates", "It must be short"],
        answer: 1, why: "Halving only works when order tells you which half to discard." },
      { q: "How many steps does binary search take on a million sorted items?",
        options: ["About 1000", "About 500,000", "About a million", "About 20"],
        answer: 3, why: "Halving a million about 20 times leaves one item: 2^20 is about a million." },
      { q: "The middle value is smaller than the target. Where do you search next?",
        options: ["The right half", "The whole list again", "Nowhere — it is not there", "The left half"],
        answer: 0, why: "Sorted order means the target, if present, is above the middle." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [1, 3, 5, 7, 9]\nlo, hi = 0, 4\ntarget = 7\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if nums[mid] == target:\n        print(mid)\n        break\n    if nums[mid] < target:\n        lo = mid + 1\n    else:\n        hi = mid - 1',
      options: ["3", "2", "4", "-1"], answer: 0,
      hint: "First mid is index 2 (value 5); 7 is bigger, so search right." }
  },
  {
    id: "i51", section: "algorithm-arena", track: "intermediate", title: "Sorting: Bubble, Selection, Insertion",
    explain: "Bubble, selection, and insertion sort all compare neighbours and run in O(n^2) time, but they teach the core sorting moves: swap, pick the minimum, and insert into place. Insertion sort shines on data that is nearly sorted.",
    takeaways: [
      "Bubble sort swaps adjacent items that are out of order.",
      "Selection sort picks the smallest remaining item each pass.",
      "Insertion sort slides each item left into its sorted spot."
    ],
    code: 'def bubble(nums):\n    a = nums[:]\n    for i in range(len(a)):\n        for j in range(len(a) - 1 - i):\n            if a[j] > a[j + 1]:\n                a[j], a[j + 1] = a[j + 1], a[j]\n    return a\n\nprint(bubble([5, 2, 4, 1, 3]))',
    quiz: [
      { q: "What does one bubble-sort pass guarantee?",
        options: ["Nothing changes", "The list is sorted", "The largest item has bubbled to the end", "The smallest item is first"],
        answer: 2, why: "Each adjacent swap pushes the biggest value one step right until it reaches the end." },
      { q: "Which sort is fastest on a nearly sorted list?",
        options: ["Selection sort", "Insertion sort", "They are all equally fast", "Bubble sort"],
        answer: 1, why: "Insertion sort only slides each item a short way when it is almost in place." },
      { q: "What do all three sorts share?",
        options: ["They need extra memory", "They only work on numbers", "O(n log n) time", "O(n^2) worst-case time"],
        answer: 3, why: "Each compares pairs in nested loops, so the worst case grows with n squared." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [3, 1, 2]\nfor j in range(len(nums) - 1):\n    if nums[j] > nums[j + 1]:\n        nums[j], nums[j + 1] = nums[j + 1], nums[j]\nprint(nums)',
      options: ["[1, 3, 2]", "[2, 1, 3]", "[1, 2, 3]", "[3, 1, 2]"], answer: 2,
      hint: "Compare 3 and 1, swap; then compare 3 and 2, swap." }
  },
  {
    id: "i52", section: "algorithm-arena", track: "intermediate", title: "Sorting: Merge Sort",
    explain: "Merge sort splits a list in half, sorts each half, then merges the two sorted halves. Splitting is cheap and merging is linear, which is why it runs in O(n log n) time on any input.",
    takeaways: [
      "Divide: split the list in half until pieces have one item.",
      "Conquer: merge two sorted halves by always taking the smaller front item.",
      "Merge sort is stable and always O(n log n), but it needs O(n) extra space."
    ],
    code: 'def merge_sort(nums):\n    if len(nums) <= 1:\n        return nums\n    mid = len(nums) // 2\n    left = merge_sort(nums[:mid])\n    right = merge_sort(nums[mid:])\n    out = []\n    i = j = 0\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            out.append(left[i])\n            i += 1\n        else:\n            out.append(right[j])\n            j += 1\n    return out + left[i:] + right[j:]\n\nprint(merge_sort([5, 2, 4, 1, 3]))\nprint(merge_sort([3, 1]))',
    quiz: [
      { q: "What is merge sort's worst-case time?",
        options: ["O(n log n)", "O(n)", "O(log n)", "O(n^2)"],
        answer: 0, why: "It splits log n levels deep and merges n items at each level." },
      { q: "What does the merge step do?",
        options: ["Swaps neighbours", "Splits the list", "Combines two sorted halves into one sorted list", "Picks a pivot"],
        answer: 2, why: "It walks both halves taking the smaller front item each time." },
      { q: "What is merge sort's main drawback?",
        options: ["It is unstable", "It needs O(n) extra space for merging", "It only works on sorted data", "It is O(n^2) on reversed lists"],
        answer: 1, why: "Merging builds a new list instead of rearranging in place." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def merge(a, b):\n    out = []\n    i = j = 0\n    while i < len(a) and j < len(b):\n        if a[i] < b[j]:\n            out.append(a[i])\n            i += 1\n        else:\n            out.append(b[j])\n            j += 1\n    return out + a[i:] + b[j:]\n\nprint(merge([1, 4, 6], [2, 3, 5]))',
      options: ["[1, 2, 3, 5, 4, 6]", "[1, 2, 3, 4, 5, 6]", "[1, 4, 6, 2, 3, 5]", "[2, 3, 5, 1, 4, 6]"], answer: 1,
      hint: "Always take the smaller of the two front items." }
  },
  {
    id: "i53", section: "algorithm-arena", track: "intermediate", title: "Sorting: Quick Sort",
    explain: "Quick sort picks a pivot, partitions the list into smaller and larger items, then sorts each side. With a good pivot it runs in O(n log n); with a bad one it degrades to O(n^2).",
    takeaways: [
      "Partitioning puts everything smaller than the pivot on its left.",
      "Average case is O(n log n); the worst case is O(n^2) with a bad pivot.",
      "Choosing a random or middle pivot avoids the worst case on sorted data."
    ],
    code: 'def quick_sort(nums):\n    if len(nums) <= 1:\n        return nums\n    pivot = nums[0]\n    less = [x for x in nums[1:] if x <= pivot]\n    greater = [x for x in nums[1:] if x > pivot]\n    return quick_sort(less) + [pivot] + quick_sort(greater)\n\nprint(quick_sort([5, 2, 4, 1, 3]))\nprint(quick_sort([3, 1, 2]))',
    quiz: [
      { q: "What does partitioning do?",
        options: ["Merges two halves", "Picks the median", "Sorts the whole list", "Splits items around the pivot into smaller and larger groups"],
        answer: 3, why: "After partitioning, the pivot sits in its final place with smaller items left and larger right." },
      { q: "When is quick sort at its worst?",
        options: ["When the pivot is always the smallest or largest item", "On short lists", "When there are duplicates", "On random data"],
        answer: 0, why: "One side is then empty and the other holds n - 1 items, so the work becomes n^2." },
      { q: "What is quick sort's average-case time?",
        options: ["O(log n)", "O(n)", "O(n log n)", "O(n^2)"],
        answer: 2, why: "Good pivots halve the problem at each level, like merge sort." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [4, 1, 3, 2]\npivot = nums[0]\nless = [x for x in nums[1:] if x < pivot]\nprint(less)\nprint([pivot])',
      options: ["[4, 1, 3, 2] / [4]", "[1, 2] / [4]", "[1, 3, 2, 4] / [4]", "[1, 3, 2]\n[4]"], answer: 3,
      hint: "less keeps every item after the pivot that is smaller than 4." }
  },
  {
    id: "i54", section: "algorithm-arena", track: "intermediate", title: "Sorting in Python: sorted() & sort() Deep Dive",
    explain: "sorted() returns a brand-new sorted list and leaves the original alone; list.sort() rearranges the list in place and returns None. Both take key and reverse, and both are stable — equal items keep their original order.",
    takeaways: [
      "`sorted(nums)` returns a new list; `nums.sort()` sorts in place and returns None.",
      "`key=len` or `key=str.lower` changes what is compared.",
      "Sorting is stable: ties keep the order they started in."
    ],
    code: 'words = ["banana", "Fig", "apple", "cherry"]\nprint(sorted(words))\nprint(sorted(words, key=str.lower))\nnums = [3, 1, 2]\nnums.sort(reverse=True)\nprint(nums)\nprint(sorted(nums))',
    quiz: [
      { q: "What does nums.sort() return?",
        options: ["The sorted list", "None", "A copy of the list", "The largest item"],
        answer: 1, why: "sort() works in place and returns None — a classic trap." },
      { q: "Which leaves the original list unchanged?",
        options: ["nums.reverse()", "del nums[0]", "nums.sort()", "sorted(nums)"],
        answer: 3, why: "sorted() builds and returns a fresh list." },
      { q: "What does key=str.lower do when sorting words?",
        options: ["Compares lowercased copies so capitals do not sort first", "Sorts by length", "Reverses the order", "Lowercases the words in the list"],
        answer: 0, why: "key transforms each item only for comparison; the original strings stay as they were." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [2, 1, 3]\nresult = nums.sort()\nprint(result)\nprint(nums)',
      options: ["None\n[1, 2, 3]", "[1, 2, 3] / [1, 2, 3]", "None / [2, 1, 3]", "[1, 2, 3] / None"], answer: 0,
      hint: "sort() changes nums but returns nothing." }
  },
  {
    id: "i55", section: "algorithm-arena", track: "intermediate", title: "Trees: Binary Tree Basics",
    explain: "A binary tree is a node with at most two children — left and right. The top node is the root, nodes with no children are leaves, and every value below a node is part of its subtree.",
    takeaways: [
      "Each node holds a value plus left and right child links (either may be None).",
      "The root is the top node; leaves are nodes with no children.",
      "Trees are recursive by nature: a subtree is itself a tree."
    ],
    code: 'class Node:\n    def __init__(self, value, left=None, right=None):\n        self.value = value\n        self.left = left\n        self.right = right\n\nroot = Node("Ava", Node("Bo"), Node("Cy"))\nprint(root.value)\nprint(root.left.value)\nprint(root.right.value)\nprint(root.left.left)',
    quiz: [
      { q: "How many children can a binary tree node have at most?",
        options: ["Unlimited", "1", "2", "3"],
        answer: 2, why: "Binary means at most two: left and right." },
      { q: "What is a leaf node?",
        options: ["The top node", "A node with no children", "A node with two children", "The root's parent"],
        answer: 1, why: "Leaves sit at the ends of branches, with both child links set to None." },
      { q: "In this lesson's tree, what is root.left.left?",
        options: ["Ava", "Bo", "Cy", "None"],
        answer: 3, why: "Bo is a leaf, so both of its child links are None." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Node:\n    def __init__(self, value, left=None, right=None):\n        self.value = value\n        self.left = left\n        self.right = right\n\ndef count(node):\n    if node is None:\n        return 0\n    return 1 + count(node.left) + count(node.right)\n\nroot = Node("Ava", Node("Bo"), Node("Cy"))\nprint(count(root))',
      options: ["1", "2", "3", "4"], answer: 2,
      hint: "Count the root, plus one for each child subtree." }
  },
{
    id: "i56", section: "algorithm-arena", track: "intermediate", title: "Trees: Traversals (Preorder, Inorder, Postorder)",
    explain: "A tree traversal is just an order for visiting every node. Preorder visits the node before its children, inorder visits it between them, and postorder visits it after them — the same tree, three different orders.",
    takeaways: [
      "Preorder: node, left, right — handy for copying a tree.",
      "Inorder: left, node, right — visits a binary search tree in sorted order.",
      "Postorder: left, right, node — handy for deleting a tree, children first.",
      "All three are the same recursion with the visit line moved."
    ],
    code: 'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n\ndef preorder(node, out):\n    if node:\n        out.append(node.value)\n        preorder(node.left, out)\n        preorder(node.right, out)\n\ndef inorder(node, out):\n    if node:\n        inorder(node.left, out)\n        out.append(node.value)\n        inorder(node.right, out)\n\ndef postorder(node, out):\n    if node:\n        postorder(node.left, out)\n        postorder(node.right, out)\n        out.append(node.value)\n\nroot = Node(1)\nroot.left = Node(2)\nroot.right = Node(3)\nroot.left.left = Node(4)\nroot.left.right = Node(5)\n\nfor name, fn in [("Preorder", preorder), ("Inorder", inorder), ("Postorder", postorder)]:\n    result = []\n    fn(root, result)\n    print(name + ":", result)',
    quiz: [
      { q: "Which traversal visits a binary search tree in sorted order?",
        options: ["Preorder", "Postorder", "Level order", "Inorder"],
        answer: 3, why: "Inorder goes left, node, right — and in a BST the left subtree is always smaller." },
      { q: "Which traversal visits the root FIRST?",
        options: ["Inorder", "Postorder", "Preorder", "None of them"],
        answer: 2, why: "Preorder appends the node before recursing into its children." },
      { q: "Which traversal is the safe way to delete a tree?",
        options: ["Preorder", "Inorder", "Postorder", "Breadth-first"],
        answer: 2, why: "Postorder visits children before their parent, so nothing is orphaned." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n\ndef preorder(node, out):\n    if node:\n        out.append(node.value)\n        preorder(node.left, out)\n        preorder(node.right, out)\n\nroot = Node("A")\nroot.left = Node("B")\nroot.right = Node("C")\nresult = []\npreorder(root, result)\nprint(result)',
      options: ["['A', 'B', 'C']", "['B', 'A', 'C']", "['B', 'C', 'A']", "['A', 'C', 'B']"], answer: 0,
      hint: "Preorder visits the node first, then the left subtree, then the right." }
  },
  {
    id: "i57", section: "algorithm-arena", track: "intermediate", title: "Trees: Binary Search Trees",
    explain: "A binary search tree keeps a simple promise: everything in the left subtree is smaller than the node, everything on the right is larger. That one rule makes searching, inserting, and listing values in order all fast.",
    takeaways: [
      "Smaller values go left, larger values go right — every time.",
      "Inorder traversal of a BST prints the values in sorted order.",
      "Searching a balanced BST takes about O(log n) steps.",
      "A BST built from sorted input degrades into a slow linked list."
    ],
    code: 'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n\ndef insert(node, value):\n    if node is None:\n        return Node(value)\n    if value < node.value:\n        node.left = insert(node.left, value)\n    elif value > node.value:\n        node.right = insert(node.right, value)\n    return node\n\ndef inorder(node, out):\n    if node:\n        inorder(node.left, out)\n        out.append(node.value)\n        inorder(node.right, out)\n\ndef search(node, value):\n    if node is None:\n        return False\n    if value == node.value:\n        return True\n    if value < node.value:\n        return search(node.left, value)\n    return search(node.right, value)\n\nroot = None\nfor v in [5, 3, 7, 1, 4]:\n    root = insert(root, v)\nresult = []\ninorder(root, result)\nprint("Inorder:", result)\nprint("Search 4:", search(root, 4))\nprint("Search 9:", search(root, 9))',
    quiz: [
      { q: "Where does a value smaller than the current node go?",
        options: ["Left child", "Right child", "It replaces the node", "It is dropped"],
        answer: 0, why: "The BST rule sends smaller values left and larger values right." },
      { q: "Inorder traversal of a BST prints values in what order?",
        options: ["Insertion order", "Random order", "Reverse sorted order", "Sorted order"],
        answer: 3, why: "Left (smaller), node, right (larger) walks the values smallest to largest." },
      { q: "Searching a balanced BST with n items takes about how long?",
        options: ["O(n) time", "O(log n) time", "O(1) time always", "O(n^2) time"],
        answer: 1, why: "Each step discards half the remaining tree, like binary search." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.left = None\n        self.right = None\n\ndef insert(node, value):\n    if node is None:\n        return Node(value)\n    if value < node.value:\n        node.left = insert(node.left, value)\n    elif value > node.value:\n        node.right = insert(node.right, value)\n    return node\n\ndef inorder(node, out):\n    if node:\n        inorder(node.left, out)\n        out.append(node.value)\n        inorder(node.right, out)\n\nroot = None\nfor v in [10, 5, 15, 3]:\n    root = insert(root, v)\nresult = []\ninorder(root, result)\nprint(result)',
      options: ["[3, 5, 10, 15]", "[10, 5, 15, 3]", "[3, 10, 5, 15]", "[15, 10, 5, 3]"], answer: 0,
      hint: "Inorder of any BST prints sorted values, whatever order they were inserted in." }
  },
  {
    id: "i58", section: "algorithm-arena", track: "intermediate", title: "Heaps: Priority Queues with heapq",
    explain: "A heap is a list that always keeps its smallest item at index 0, so you can grab the most urgent task in O(log n) time. Python's heapq turns any list into a priority queue — perfect for to-do lists, schedulers, and top-K problems.",
    takeaways: [
      "heapq is a min-heap: the smallest item is always at index 0.",
      "heappush() adds an item; heappop() removes and returns the smallest.",
      "Push tuples like (priority, task) to order by priority.",
      "heapq.nlargest(k, items) and nsmallest(k, items) get the top K."
    ],
    code: 'import heapq\n\ntasks = []\nheapq.heappush(tasks, (3, "Write report"))\nheapq.heappush(tasks, (1, "Fix bug"))\nheapq.heappush(tasks, (2, "Review code"))\n\nprint("Next up:", heapq.heappop(tasks))\nprint("Heap now:", tasks)\nprint("Top 2 scores:", heapq.nlargest(2, [88, 95, 70, 100, 82]))',
    quiz: [
      { q: "What kind of heap does heapq implement?",
        options: ["Max-heap", "Min-heap", "Both at once", "Neither — it just sorts lists"],
        answer: 1, why: "heapq keeps the smallest item at the front; there is no built-in max-heap." },
      { q: "What does heappop() return?",
        options: ["The smallest item", "The largest item", "The last item pushed", "A random item"],
        answer: 0, why: "heappop removes and returns the smallest item, which sits at index 0." },
      { q: "How do you get the 3 largest numbers from a list?",
        options: ["sorted(nums)[:3]", "heapq.heappop(nums)", "heapq.nlargest(3, nums)", "heapq.nsmallest(3, nums)"],
        answer: 2, why: "nlargest(k, items) returns the k biggest items without sorting the whole list." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import heapq\n\nh = []\nfor n in [4, 2, 9]:\n    heapq.heappush(h, n)\nprint(h[0])',
      options: ["4", "9", "2", "0"], answer: 2,
      hint: "A heap always keeps its smallest item at index 0." }
  },
  {
    id: "i59", section: "algorithm-arena", track: "intermediate", title: "Graphs: Adjacency Lists & Matrices",
    explain: "A graph is nodes connected by edges — think of cities joined by roads, or friends on a social network. You can store one as an adjacency list (each node maps to its neighbours) or as an adjacency matrix (a grid of 0s and 1s).",
    takeaways: [
      "An adjacency list maps each node to a list of its neighbours.",
      "An adjacency matrix is a grid where matrix[i][j] is 1 when an edge exists.",
      "Lists save space on sparse graphs; matrices answer edge checks in O(1).",
      "Both store the same graph — pick the one your algorithm needs."
    ],
    code: 'graph = {\n    "A": ["B", "C"],\n    "B": ["A", "D"],\n    "C": ["A", "D"],\n    "D": ["B", "C"],\n}\nprint("Neighbours of A:", graph["A"])\nprint("A connected to D?", "D" in graph["A"])\n\nmatrix = [\n    [0, 1, 1, 0],\n    [1, 0, 0, 1],\n    [1, 0, 0, 1],\n    [0, 1, 1, 0],\n]\nprint("Matrix row for A:", matrix[0])\nprint("Edge A-B in matrix:", matrix[0][1] == 1)',
    quiz: [
      { q: "An adjacency list stores for each node...",
        options: ["Its coordinates", "Its weight only", "Its parent only", "Its list of neighbours"],
        answer: 3, why: "The list maps a node to every node directly connected to it." },
      { q: "Checking whether an edge exists is fastest with...",
        options: ["An adjacency list", "An adjacency matrix (O(1) lookup)", "A plain list of edges", "A queue"],
        answer: 1, why: "A matrix answers matrix[i][j] in one step; a list must be scanned." },
      { q: "A graph with 4 nodes has an adjacency matrix of size...",
        options: ["4 x 4", "4 x 2", "2 x 2", "16 x 16"],
        answer: 0, why: "The matrix has one row and one column per node." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'graph = {"A": ["B", "C"], "B": ["A"], "C": ["A"]}\nprint(len(graph["A"]))',
      options: ["1", "3", "2", "0"], answer: 2,
      hint: "Count how many neighbours A has in the list." }
  },
  {
    id: "i60", section: "algorithm-arena", track: "intermediate", title: "Graphs: BFS",
    explain: "Breadth-first search explores a graph layer by layer: first the start node, then all its neighbours, then their neighbours. A queue (first in, first out) makes this happen, and a seen set stops you revisiting nodes.",
    takeaways: [
      "BFS uses a queue (FIFO) — deque.popleft() takes the oldest node first.",
      "BFS visits nodes in order of distance from the start.",
      "On unweighted graphs BFS finds the shortest path.",
      "A seen set stops BFS looping forever on graphs with cycles."
    ],
    code: 'from collections import deque\n\ngraph = {"A": ["B", "C"], "B": ["D", "E"], "C": ["F"], "D": [], "E": ["F"], "F": []}\n\ndef bfs(graph, start):\n    visited = []\n    queue = deque([start])\n    seen = {start}\n    while queue:\n        node = queue.popleft()\n        visited.append(node)\n        for neighbour in graph[node]:\n            if neighbour not in seen:\n                seen.add(neighbour)\n                queue.append(neighbour)\n    return visited\n\nprint(bfs(graph, "A"))',
    quiz: [
      { q: "BFS uses which data structure for its waiting line?",
        options: ["A stack", "A queue (FIFO)", "A heap", "A set"],
        answer: 1, why: "First in, first out is what makes BFS explore layer by layer." },
      { q: "BFS visits nodes in order of...",
        options: ["Distance from the start", "Alphabetical order", "Insertion order", "Random order"],
        answer: 0, why: "All nodes one step away come out before any node two steps away." },
      { q: "Why keep a seen set in BFS?",
        options: ["To sort the nodes", "To avoid visiting the same node twice", "To count edges", "To reverse the graph"],
        answer: 1, why: "Without it, a cycle would send BFS around the same nodes forever." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from collections import deque\n\ngraph = {"X": ["Y", "Z"], "Y": [], "Z": []}\n\ndef bfs(graph, start):\n    visited = []\n    queue = deque([start])\n    seen = {start}\n    while queue:\n        node = queue.popleft()\n        visited.append(node)\n        for neighbour in graph[node]:\n            if neighbour not in seen:\n                seen.add(neighbour)\n                queue.append(neighbour)\n    return visited\n\nprint(bfs(graph, "X"))',
      options: ["['X', 'Y', 'Z']", "['X', 'Z', 'Y']", "['Y', 'Z', 'X']", "['X', 'Y']"], answer: 0,
      hint: "The queue takes Y before Z because Y was added first." }
  },
  {
    id: "i61", section: "algorithm-arena", track: "intermediate", title: "Graphs: DFS",
    explain: "Depth-first search dives down one path as far as it goes before backtracking — like exploring a maze by always taking the next corridor. It runs naturally on recursion, since each call handles one node and the call stack remembers the way back.",
    takeaways: [
      "DFS uses a stack (or recursion) — last in, first out.",
      "DFS follows one path deep before trying the next branch.",
      "DFS is the natural fit for mazes, puzzles, and connected components.",
      "On very deep graphs, recursion can hit Python's call-stack limit."
    ],
    code: 'graph = {"A": ["B", "C"], "B": ["D", "E"], "C": ["F"], "D": [], "E": [], "F": []}\n\ndef dfs(graph, node, visited):\n    visited.append(node)\n    for neighbour in graph[node]:\n        if neighbour not in visited:\n            dfs(graph, neighbour, visited)\n    return visited\n\nprint(dfs(graph, "A", []))',
    quiz: [
      { q: "DFS naturally uses...",
        options: ["A queue", "A stack (or recursion)", "A heap", "A hash map"],
        answer: 1, why: "Each recursive call pushes a node; returning pops it — exactly stack behaviour." },
      { q: "DFS is a good fit for...",
        options: ["Finding the shortest path", "Sorting numbers", "Counting duplicates", "Exploring one path as deep as it goes"],
        answer: 3, why: "DFS dives down a single branch first, which is how you explore a maze." },
      { q: "Recursive DFS risks what on very deep graphs?",
        options: ["Nothing — it is always safe", "RecursionError from the call-stack limit", "A syntax error", "Slower sorting"],
        answer: 1, why: "Python caps the call stack at about 1000 frames, and deep recursion hits it." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'graph = {"A": ["B", "C"], "B": [], "C": []}\n\ndef dfs(graph, node, visited):\n    visited.append(node)\n    for neighbour in graph[node]:\n        if neighbour not in visited:\n            dfs(graph, neighbour, visited)\n    return visited\n\nprint(dfs(graph, "A", []))',
      options: ["['A', 'B', 'C']", "['A', 'C', 'B']", "['B', 'C', 'A']", "['A', 'B']"], answer: 0,
      hint: "DFS visits A, then dives into B first, then backtracks to C." }
  },
  {
    id: "i62", section: "algorithm-arena", track: "intermediate", title: "Graphs: Shortest Path Intuition (Dijkstra)",
    explain: "Dijkstra's algorithm finds the cheapest route through a weighted graph by always expanding the closest unvisited node first. A priority queue picks that node, and each time a cheaper route to a neighbour appears, its distance is updated.",
    takeaways: [
      "Dijkstra only works when all edge weights are non-negative.",
      "Always expand the unvisited node with the smallest known distance.",
      "A heapq priority queue makes picking that node fast.",
      "Relaxing an edge means updating a neighbour when a cheaper route is found."
    ],
    code: 'import heapq\n\ngraph = {"A": {"B": 4, "C": 2}, "B": {"D": 5}, "C": {"B": 1, "D": 8}, "D": {}}\n\ndef dijkstra(graph, start):\n    dist = {node: float("inf") for node in graph}\n    dist[start] = 0\n    heap = [(0, start)]\n    while heap:\n        d, node = heapq.heappop(heap)\n        if d > dist[node]:\n            continue\n        for neighbour, w in graph[node].items():\n            nd = d + w\n            if nd < dist[neighbour]:\n                dist[neighbour] = nd\n                heapq.heappush(heap, (nd, neighbour))\n    return dist\n\nprint(dijkstra(graph, "A"))',
    quiz: [
      { q: "Dijkstra's algorithm requires edge weights to be...",
        options: ["Negative", "Non-negative", "All equal to 1", "Larger than 10"],
        answer: 1, why: "A negative edge could offer a cheaper route after a node is settled, breaking the algorithm." },
      { q: "Dijkstra picks the next node to expand by...",
        options: ["Smallest known distance so far", "Largest known distance", "Alphabetical order", "Most neighbours"],
        answer: 0, why: "The closest unsettled node is guaranteed to have its final shortest distance." },
      { q: "With a heap, Dijkstra runs in roughly...",
        options: ["O(V + E)", "O((V + E) log V)", "O(V^2) always", "O(1)"],
        answer: 1, why: "Each edge may push to the heap once, and each heap operation costs log V." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import heapq\n\ngraph = {"A": {"B": 1, "C": 4}, "B": {"C": 2}, "C": {}}\n\ndef dijkstra(graph, start):\n    dist = {node: float("inf") for node in graph}\n    dist[start] = 0\n    heap = [(0, start)]\n    while heap:\n        d, node = heapq.heappop(heap)\n        if d > dist[node]:\n            continue\n        for neighbour, w in graph[node].items():\n            nd = d + w\n            if nd < dist[neighbour]:\n                dist[neighbour] = nd\n                heapq.heappush(heap, (nd, neighbour))\n    return dist\n\nprint(dijkstra(graph, "A")["C"])',
      options: ["4", "2", "3", "1"], answer: 2,
      hint: "The direct edge costs 4, but going through B is cheaper — add the two legs." }
  },
  {
    id: "i63", section: "algorithm-arena", track: "intermediate", title: "Dynamic Programming: Fibonacci & Climbing Stairs",
    explain: "Dynamic programming is just remembering answers instead of recomputing them. Climbing stairs is the classic first example: the ways to reach step n are the ways to n-1 plus the ways to n-2, because your last step was either 1 or 2 stairs.",
    takeaways: [
      "ways(n) = ways(n-1) + ways(n-2) — the same shape as Fibonacci.",
      "Naive recursive fib recomputes the same values over and over.",
      "An iterative loop with two variables turns it into O(n) time, O(1) space.",
      "DP works when a problem breaks into overlapping subproblems."
    ],
    code: 'def fib(n):\n    if n < 2:\n        return n\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b\n\ndef climb(n):\n    if n <= 2:\n        return n\n    a, b = 1, 2\n    for _ in range(3, n + 1):\n        a, b = b, a + b\n    return b\n\nprint("fib(10) =", fib(10))\nprint("Ways to climb 4 stairs =", climb(4))',
    quiz: [
      { q: "Why is naive recursive fib(n) so slow?",
        options: ["It uses too much disk", "It cannot handle n > 5", "It sorts the numbers", "It recomputes the same values many times"],
        answer: 3, why: "fib(5) alone recomputes fib(3) twice and fib(2) three times — the waste explodes." },
      { q: "In climbing stairs, ways(n) equals...",
        options: ["ways(n-1) * 2", "ways(n-1) + ways(n-2)", "n!", "ways(n-1) - 1"],
        answer: 1, why: "Your last step was 1 stair (from n-1) or 2 stairs (from n-2) — add both counts." },
      { q: "Storing answers to subproblems to reuse them is called...",
        options: ["Sorting", "Memoization", "Recursion", "Backtracking"],
        answer: 1, why: "Memoization caches each subproblem's answer so it is computed once." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def climb(n):\n    if n <= 2:\n        return n\n    a, b = 1, 2\n    for _ in range(3, n + 1):\n        a, b = b, a + b\n    return b\n\nprint(climb(3))',
      options: ["2", "5", "3", "6"], answer: 2,
      hint: "Ways to climb 3 stairs: 1+1+1, 1+2, and 2+1." }
  },
  {
    id: "i64", section: "algorithm-arena", track: "intermediate", title: "Dynamic Programming: Knapsack Intuition",
    explain: "The knapsack problem asks: with a bag that holds limited weight, which items give the most value? For each item you decide take or skip, and a DP table remembers the best value for every capacity so far — so each item is considered exactly once.",
    takeaways: [
      "0/1 knapsack: each item is taken at most once.",
      "dp[c] = the best value achievable with capacity c.",
      "For each item, update dp from high capacity down to low.",
      "Iterating capacity backwards is what stops an item being used twice."
    ],
    code: 'def knapsack(weights, values, capacity):\n    dp = [0] * (capacity + 1)\n    for w, v in zip(weights, values):\n        for c in range(capacity, w - 1, -1):\n            dp[c] = max(dp[c], dp[c - w] + v)\n    return dp[capacity]\n\nweights = [2, 3, 4]\nvalues = [3, 4, 5]\nprint("Best value (capacity 5):", knapsack(weights, values, 5))\nprint("Best value (capacity 4):", knapsack(weights, values, 4))',
    quiz: [
      { q: "In 0/1 knapsack, each item can be taken...",
        options: ["At most once", "As many times as you like", "Only if it is the lightest", "Only with its neighbour"],
        answer: 0, why: "The 0/1 means take it or leave it — unlike the unbounded version, which allows repeats." },
      { q: "The DP table for knapsack has dimensions based on...",
        options: ["Only the capacity", "Number of items and capacity", "The item values", "The item weights"],
        answer: 1, why: "You decide take-or-skip for each item at each capacity, so both axes matter." },
      { q: "Why iterate capacity backwards in the 1-D version?",
        options: ["To sort the items", "So each item is used at most once", "To make it faster", "To save memory only"],
        answer: 1, why: "Going backwards means dp[c - w] still holds last round's value, not this item's." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def knapsack(weights, values, capacity):\n    dp = [0] * (capacity + 1)\n    for w, v in zip(weights, values):\n        for c in range(capacity, w - 1, -1):\n            dp[c] = max(dp[c], dp[c - w] + v)\n    return dp[capacity]\n\nprint(knapsack([1, 2], [10, 15], 2))',
      options: ["25", "10", "15", "20"], answer: 2,
      hint: "Capacity 2 fits the weight-2 item (value 15) or the weight-1 item (value 10) — not both." }
  },
  {
    id: "i65", section: "algorithm-arena", track: "intermediate", title: "Greedy Algorithms: When Greedy Works",
    explain: "A greedy algorithm always takes the best-looking choice right now and never looks back. That works beautifully for coin change with standard coins and for scheduling non-overlapping activities — but only when every local best choice leads to a global best.",
    takeaways: [
      "Greedy picks the locally best choice at each step and never revisits it.",
      "Coin change with [25, 10, 5, 1] is greedy-safe: biggest coin first.",
      "Greedy fails when a local best blocks a better overall answer.",
      "Check the greedy-choice property before trusting a greedy solution."
    ],
    code: 'def change(amount, coins):\n    result = []\n    for coin in coins:\n        while amount >= coin:\n            amount -= coin\n            result.append(coin)\n    return result\n\nprint(change(63, [25, 10, 5, 1]))\nprint("Coins used:", len(change(63, [25, 10, 5, 1])))',
    quiz: [
      { q: "Greedy works when...",
        options: ["Every local best choice leads to a global best", "The input is already sorted", "The problem is small", "You try every option"],
        answer: 0, why: "That is the greedy-choice property — without it, a local best can ruin the answer." },
      { q: "Greedy coin change can fail when...",
        options: ["The amount is even", "Coin values are unusual (e.g. no 1-cent coin)", "Coins are sorted", "There are too many coins"],
        answer: 1, why: "With coins like [4, 3, 1], greedy change for 6 gives 4+1+1 (3 coins) instead of 3+3 (2)." },
      { q: "Which is a classic greedy problem?",
        options: ["N-Queens", "0/1 knapsack", "Merge sort", "Activity selection (pick the most non-overlapping activities)"],
        answer: 3, why: "Picking the activity that ends earliest never hurts, so greedy is optimal here." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def change(amount, coins):\n    result = []\n    for coin in coins:\n        while amount >= coin:\n            amount -= coin\n            result.append(coin)\n    return result\n\nprint(change(30, [25, 10, 5, 1]))',
      options: ["[25, 5]", "[10, 10, 10]", "[5, 5, 5, 5, 5, 5]", "[25]"], answer: 0,
      hint: "Take the biggest coin that fits, then repeat with what is left." }
  },
  {
    id: "i66", section: "algorithm-arena", track: "intermediate", title: "Backtracking: N-Queens Intuition",
    explain: "Backtracking solves a puzzle by trying a choice, and when it hits a dead end, undoing that choice and trying the next one. In N-Queens you place queens row by row, and the moment two queens attack each other you backtrack to the last safe row.",
    takeaways: [
      "Backtracking = try a choice, undo it if it fails, try the next.",
      "Track used columns and diagonals in sets for O(1) safety checks.",
      "Queens attack on the same row, column, or diagonal.",
      "4-queens has exactly 2 solutions."
    ],
    code: 'def solve_n_queens(n):\n    solutions = []\n    def place(row, cols, diag1, diag2, board):\n        if row == n:\n            solutions.append(list(board))\n            return\n        for col in range(n):\n            if col in cols or (row + col) in diag1 or (row - col) in diag2:\n                continue\n            cols.add(col); diag1.add(row + col); diag2.add(row - col)\n            board.append(col)\n            place(row + 1, cols, diag1, diag2, board)\n            board.pop(); cols.remove(col); diag1.remove(row + col); diag2.remove(row - col)\n    place(0, set(), set(), set(), [])\n    return solutions\n\nsols = solve_n_queens(4)\nprint("4-queens solutions:", len(sols))\nprint("First solution (column per row):", sols[0])',
    quiz: [
      { q: "Backtracking means...",
        options: ["Try a choice, undo it if it fails, try the next", "Try every choice at once", "Never undo a choice", "Sort before trying"],
        answer: 0, why: "The undo step is the whole idea — a dead end rewinds to the last decision point." },
      { q: "In N-Queens, two queens attack if they share...",
        options: ["Only a row", "A row, column, or diagonal", "Only a diagonal", "A colour"],
        answer: 1, why: "A queen moves like a rook plus a bishop, so all three lines matter." },
      { q: "How many solutions does 4-queens have?",
        options: ["1", "4", "2", "8"],
        answer: 2, why: "The two solutions are [1, 3, 0, 2] and [2, 0, 3, 1] (column per row)." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def solve_n_queens(n):\n    solutions = []\n    def place(row, cols, diag1, diag2, board):\n        if row == n:\n            solutions.append(list(board))\n            return\n        for col in range(n):\n            if col in cols or (row + col) in diag1 or (row - col) in diag2:\n                continue\n            cols.add(col); diag1.add(row + col); diag2.add(row - col)\n            board.append(col)\n            place(row + 1, cols, diag1, diag2, board)\n            board.pop(); cols.remove(col); diag1.remove(row + col); diag2.remove(row - col)\n    place(0, set(), set(), set(), [])\n    return solutions\n\nprint(len(solve_n_queens(1)))',
      options: ["0", "1", "2", "4"], answer: 1,
      hint: "A 1x1 board has exactly one square — one queen fits there." }
  },
  {
    id: "i67", section: "algorithm-arena", track: "intermediate", title: "Bit Manipulation Basics",
    explain: "Bits are the 0s and 1s underneath every number, and Python lets you work with them directly. AND (&) keeps shared 1s, OR (|) merges them, XOR (^) finds differences, and shifting left or right multiplies or divides by powers of two.",
    takeaways: [
      "& keeps only bits that are 1 in both numbers; | keeps bits 1 in either.",
      "^ is 1 where the bits differ — x ^ x is always 0.",
      "x << 1 doubles x; x >> 1 halves it (floor).",
      "x & 1 checks odd/even; x & (1 << k) tests whether bit k is set."
    ],
    code: 'a, b = 5, 3\nprint("5 & 3 =", a & b)\nprint("5 | 3 =", a | b)\nprint("5 ^ 3 =", a ^ b)\nprint("1 << 3 =", 1 << 3)\nprint("16 >> 2 =", 16 >> 2)\nprint("Is bit 2 set in 5?", bool(5 & (1 << 2)))',
    quiz: [
      { q: "What does << do?",
        options: ["Shifts bits left (multiplies by 2 per shift)", "Shifts bits right", "Flips all bits", "Compares two numbers"],
        answer: 0, why: "Each left shift adds a zero bit on the right, doubling the value." },
      { q: "x & 1 is a quick way to check...",
        options: ["Whether x is prime", "Whether x is positive", "Whether x is zero", "Whether x is odd"],
        answer: 3, why: "The lowest bit is 1 exactly for odd numbers, so x & 1 is 1 when x is odd." },
      { q: "x ^ x always equals...",
        options: ["x", "0", "1", "-1"],
        answer: 1, why: "Every bit matches itself, so XOR finds no differences — all zeros." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print(6 & 3)',
      options: ["3", "6", "2", "0"], answer: 2,
      hint: "Write 6 as 110 and 3 as 011 in binary, then keep only the bits that are 1 in both." }
  },
  {
    id: "i68", section: "algorithm-arena", track: "intermediate", title: "Strings: Palindromes & Reversals",
    explain: "A palindrome reads the same forwards and backwards, and Python's slice s[::-1] reverses a string in one move. For real phrases you first strip out spaces and punctuation and lowercase everything — then the reversed string either matches or it does not.",
    takeaways: [
      "s[::-1] reverses a string in one step.",
      "Clean the text (lowercase, keep only letters/digits) before testing phrases.",
      "A two-pointer check compares s[i] with s[-1-i] using O(1) extra space.",
      "Reversing builds a whole new string — fine for short text, wasteful for huge text."
    ],
    code: 'def is_palindrome(text):\n    clean = "".join(c.lower() for c in text if c.isalnum())\n    return clean == clean[::-1]\n\nprint("racecar reversed:", "racecar"[::-1])\nprint("racecar is a palindrome:", is_palindrome("racecar"))\nprint("hello is a palindrome:", is_palindrome("hello"))\nprint("Panama phrase:", is_palindrome("A man, a plan, a canal: Panama"))',
    quiz: [
      { q: "What does s[::-1] do?",
        options: ["Reverses the string", "Removes the last character", "Sorts the string", "Doubles the string"],
        answer: 0, why: "A step of -1 walks the string backwards, building the reversed copy." },
      { q: "Why clean the text before checking a phrase palindrome?",
        options: ["It makes the string longer", "Spaces and punctuation would break the match", "Python requires it", "Lowercase letters are invalid"],
        answer: 1, why: "The raw phrase has spaces and commas that have no mirror partner in the reversed text." },
      { q: "Which palindrome check uses O(1) extra space?",
        options: ["Build s[::-1] and compare", "Compare s[i] with s[-1-i] moving inward", "Sort the string", "Use a Counter"],
        answer: 1, why: "Two pointers walk toward the middle comparing characters, building nothing new." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print("madam"[::-1])',
      options: ["madam", "mdam", "madamm", "Error"], answer: 0,
      hint: "Reversing a palindrome gives the same word back." }
  },
  {
    id: "i69", section: "algorithm-arena", track: "intermediate", title: "Strings: Pattern Matching Basics",
    explain: "Pattern matching is finding structure inside text: a name with str.find(), an email with a regex, a run of digits with \\d+. Plain string methods handle the simple cases; the re module handles the rest with compact patterns.",
    takeaways: [
      "str.find(sub) returns the first index, or -1 when it is missing.",
      "startswith() and endswith() test the edges of a string.",
      "In regex, \\d matches a digit, \\w a word character, + means one-or-more.",
      "re.findall() returns a list of every match; re.search() returns the first."
    ],
    code: 'import re\n\ntext = "Contact Ava at ava@example.com or Bo on 98765 43210"\nprint("find Ava:", text.find("Ava"))\nprint("starts with Contact:", text.startswith("Contact"))\nprint("count of a:", text.lower().count("a"))\nemails = re.findall(r"[\\w.]+@[\\w.]+", text)\nprint("Emails found:", emails)\nprint("Has a 5-digit number?", bool(re.search(r"\\d{5}", text)))',
    quiz: [
      { q: "What does str.find() return when the substring is missing?",
        options: ["0", "None", "It raises an error", "-1"],
        answer: 3, why: "find() returns -1 for a miss; index() is the one that raises ValueError." },
      { q: "In regex, \\d matches...",
        options: ["Any letter", "Any digit", "Any whitespace", "The end of the string"],
        answer: 1, why: "\\d is shorthand for the digit character class [0-9]." },
      { q: "re.findall() returns...",
        options: ["Only the first match", "A list of all matches", "True or False", "The match positions"],
        answer: 1, why: "findall scans the whole string and collects every non-overlapping match." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'print("hello world".find("world"))',
      options: ["5", "6", "7", "-1"], answer: 1,
      hint: "Count characters from 0: h is 0, the space is 5, so w is one more." }
  },
  {
    id: "i70", section: "algorithm-arena", track: "intermediate", title: "Interview Patterns: Top K Elements",
    explain: "Top-K questions ask for the K biggest, smallest, or most frequent items — and you never need to sort everything to answer them. A heap of size K, or a Counter with most_common(), does the job in O(n log K) time and O(K) memory.",
    takeaways: [
      "heapq.nlargest(k, items) returns the k biggest items without a full sort.",
      "Counter(words).most_common(k) gives the k most frequent items.",
      "A heap of size K keeps memory at O(K) even for huge streams.",
      "Sorting the whole list works but costs O(n log n) — overkill for small K."
    ],
    code: 'import heapq\nfrom collections import Counter\n\nscores = [88, 95, 70, 100, 82, 95, 91]\nprint("Top 3 scores:", heapq.nlargest(3, scores))\nwords = ["apple", "banana", "apple", "kiwi", "banana", "apple"]\nprint("Most common 2:", Counter(words).most_common(2))\nprint("Smallest 2 scores:", heapq.nsmallest(2, scores))',
    quiz: [
      { q: "heapq.nlargest(k, nums) runs in about...",
        options: ["O(n^2)", "O(k) only", "O(n log n) always", "O(n log k)"],
        answer: 3, why: "Each of the n items may enter a heap of size k, and heap operations cost log k." },
      { q: "Counter(words).most_common(1) returns...",
        options: ["Just the count", "A list with the top (item, count) pair", "Just the item", "A dict"],
        answer: 1, why: "most_common returns a list of (item, count) tuples, here with one entry." },
      { q: "For top-K over a huge stream, a heap beats full sorting because...",
        options: ["It sorts faster in every case", "It only keeps K items in memory", "It needs no comparisons", "It avoids reading the data"],
        answer: 1, why: "The heap holds at most K items while the stream flows past — sorting needs it all." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import heapq\n\nprint(heapq.nlargest(2, [3, 1, 4, 1, 5]))',
      options: ["[5, 4]", "[4, 5]", "[5, 3]", "[1, 1]"], answer: 0,
      hint: "nlargest returns the biggest first, in descending order." }
  },
  {
    id: "i71", section: "algorithm-arena", track: "intermediate", title: "Interview Patterns: Fast & Slow Pointers",
    explain: "Two pointers moving at different speeds can do jobs that look impossible without extra memory. The slow pointer takes one step while the fast pointer takes two — so slow lands on the middle of a linked list, and if fast ever laps slow, you have found a cycle.",
    takeaways: [
      "Slow moves 1 step, fast moves 2 steps — both start at the head.",
      "When fast reaches the end, slow sits on the middle node.",
      "If fast catches slow, the list has a cycle (Floyd's algorithm).",
      "Both tricks use O(1) extra space — no list copy needed."
    ],
    code: 'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.next = None\n\ndef middle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow = slow.next\n        fast = fast.next.next\n    return slow.value\n\ndef has_cycle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow = slow.next\n        fast = fast.next.next\n        if slow is fast:\n            return True\n    return False\n\nhead = Node(1)\nhead.next = Node(2)\nhead.next.next = Node(3)\nhead.next.next.next = Node(4)\nhead.next.next.next.next = Node(5)\nprint("Middle of 5 nodes:", middle(head))\nprint("Has cycle?", has_cycle(head))',
    quiz: [
      { q: "In Floyd's cycle check, the fast pointer moves...",
        options: ["One step at a time", "Two steps at a time", "Backwards", "Randomly"],
        answer: 1, why: "Fast gains one step per round on slow, so on a cycle it must eventually lap it." },
      { q: "If fast catches slow, the list...",
        options: ["Has a cycle", "Is sorted", "Has an even length", "Is empty"],
        answer: 0, why: "On a straight list fast reaches the end; only a loop lets it come back around." },
      { q: "Finding the middle with two pointers uses...",
        options: ["O(n) extra space", "O(1) extra space", "A second list", "Sorting first"],
        answer: 1, why: "Two pointers and nothing else — no copy of the list is built." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.next = None\n\ndef middle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow = slow.next\n        fast = fast.next.next\n    return slow.value\n\nhead = Node(1)\nhead.next = Node(2)\nhead.next.next = Node(3)\nhead.next.next.next = Node(4)\nprint(middle(head))',
      options: ["2", "3", "4", "1"], answer: 1,
      hint: "Trace it: slow and fast both start at 1; stop when fast runs out of road." }
  },
  {
    id: "i72", section: "algorithm-arena", track: "intermediate", title: "Interview Patterns: Intervals",
    explain: "Interval problems — merging meeting times, finding free slots, counting overlaps — all start the same way: sort by start time. Once sorted, overlaps sit next to each other, and one sweep merges them by stretching the current interval's end.",
    takeaways: [
      "Sort intervals by start time first — overlaps then sit side by side.",
      "Two intervals overlap when next start <= current end.",
      "Merge by stretching the current end to max(current end, next end).",
      "After sorting, merging is a single O(n) sweep."
    ],
    code: 'def merge(intervals):\n    intervals.sort()\n    merged = [intervals[0]]\n    for start, end in intervals[1:]:\n        if start <= merged[-1][1]:\n            merged[-1][1] = max(merged[-1][1], end)\n        else:\n            merged.append([start, end])\n    return merged\n\nprint(merge([[1, 3], [2, 6], [8, 10], [15, 18]]))\nprint(merge([[1, 4], [4, 5]]))',
    quiz: [
      { q: "Why sort intervals by start time first?",
        options: ["To count them", "To reverse them", "Sorting is optional and useless", "So overlaps appear next to each other"],
        answer: 3, why: "Sorting lines overlapping intervals up in order, so one left-to-right sweep can merge them." },
      { q: "Two intervals overlap when...",
        options: ["They have the same length", "The next start is <= the current end", "They start at the same time only", "One contains the other only"],
        answer: 1, why: "If the next interval starts before the current one ends, their ranges share time." },
      { q: "Merging n intervals after sorting costs...",
        options: ["O(n^2)", "O(n log n)", "O(1)", "O(2^n)"],
        answer: 1, why: "The sort dominates at O(n log n); the merge sweep itself is O(n)." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def merge(intervals):\n    intervals.sort()\n    merged = [intervals[0]]\n    for start, end in intervals[1:]:\n        if start <= merged[-1][1]:\n            merged[-1][1] = max(merged[-1][1], end)\n        else:\n            merged.append([start, end])\n    return merged\n\nprint(merge([[1, 4], [4, 5]]))',
      options: ["[[1, 5]]", "[[1, 4], [4, 5]]", "[[1, 4]]", "[[4, 5]]"], answer: 0,
      hint: "The second interval starts at 4, exactly where the first ends — that still counts as overlap." }
  },
  {
    id: "i73", section: "algorithm-arena", track: "intermediate", title: "Complexity Analysis: Time vs Space",
    explain: "Time complexity is how your runtime grows; space complexity is how your memory grows. Often you trade one for the other — a lookup table spends memory to save time, while recomputing on the fly spends time to save memory. Measure both before you optimise.",
    takeaways: [
      "Time complexity: how runtime grows with input size. Space: how memory grows.",
      "Building a list of n results costs O(n) space; accumulating a total costs O(1).",
      "A lookup table trades memory for speed — the classic space-time tradeoff.",
      "Two loops one after another are O(n) + O(n) = O(n), not O(n^2)."
    ],
    code: 'import time\n\ndef sum_loop(n):\n    total = 0\n    for i in range(n):\n        total += i\n    return total\n\ndef sum_formula(n):\n    return n * (n - 1) // 2\n\nn = 10**6\nt0 = time.perf_counter()\nprint("Loop sum:", sum_loop(n))\nprint("Loop took:", round(time.perf_counter() - t0, 4), "s")\nt0 = time.perf_counter()\nprint("Formula sum:", sum_formula(n))\nprint("Formula took:", round(time.perf_counter() - t0, 4), "s")',
    quiz: [
      { q: "An algorithm that builds a list of n results uses...",
        options: ["O(n) space", "O(1) space", "O(log n) space", "No space"],
        answer: 0, why: "The list itself holds n items, so memory grows linearly with n." },
      { q: "Trading memory for speed (e.g. a lookup table) is called a...",
        options: ["Greedy choice", "Space-time tradeoff", "Recursion", "Sort order"],
        answer: 1, why: "You spend extra memory to avoid recomputing work — time down, space up." },
      { q: "Two loops, one after the other, over n items is...",
        options: ["O(n)", "O(n^2)", "O(log n)", "O(n!)"],
        answer: 0, why: "Sequential loops add: n + n = 2n, and constants drop out of Big-O." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'squares = [x * x for x in range(1000)]\nprint(len(squares))',
      options: ["1000", "999000", "0", "Error"], answer: 0,
      hint: "range(1000) makes 1000 values, and the comprehension keeps one square per value." }
  },
  {
    id: "i74", section: "power-lab", track: "intermediate", title: "Testing Your Algorithms: Writing Good Tests",
    explain: "An algorithm you cannot test is an algorithm you cannot trust. A good test suite checks the normal case, the edge cases (empty input, single item, duplicates), and the case that used to fail — with assert statements that fail loudly the moment something breaks.",
    takeaways: [
      "Test normal cases, edge cases (empty, single item), and duplicates.",
      "assert condition stops the run with AssertionError when it fails.",
      "Write the test from the expected answer, not from what the code does.",
      "One small test per behaviour beats one giant test that checks everything."
    ],
    code: 'def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i\n    return []\n\ndef test_two_sum():\n    assert two_sum([2, 7, 11, 15], 9) == [0, 1]\n    assert two_sum([3, 2, 4], 6) == [1, 2]\n    assert two_sum([1, 2, 3], 7) == []\n    print("All 3 tests passed")\n\ntest_two_sum()',
    quiz: [
      { q: "A good test checks...",
        options: ["Only the happy path", "Only huge inputs", "Only the code style", "Normal cases, edge cases, and empty input"],
        answer: 3, why: "Bugs hide in edges and empty inputs, not in the obvious normal case." },
      { q: "What does assert do when its condition is False?",
        options: ["Returns False", "Raises AssertionError", "Prints a warning", "Exits silently"],
        answer: 1, why: "A failed assert raises AssertionError immediately, so a broken test cannot pass quietly." },
      { q: "Why test the empty-input case?",
        options: ["It is required by Python", "Edge cases are where bugs hide", "It makes tests slower", "It is never needed"],
        answer: 1, why: "Empty input is the most common crash site — loops, indexing, and max() all misbehave there." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def add(a, b):\n    return a + b\n\nassert add(2, 3) == 5\nprint("Test passed")',
      options: ["Test passed", "AssertionError", "5", "Nothing prints"], answer: 0,
      hint: "The assert holds, so the code keeps going to the print." }
  },
  {
    id: "i75", section: "tool-shed", track: "intermediate", title: "The collections Module: Counter, defaultdict, OrderedDict",
    explain: "The collections module is Python's box of ready-made containers. Counter tallies frequencies, defaultdict hands you a fresh value for missing keys instead of a KeyError, and OrderedDict remembers insertion order with extra tricks like move_to_end.",
    takeaways: [
      "Counter(items) tallies frequencies; .most_common(k) gives the top k.",
      "defaultdict(list) creates an empty list for a missing key automatically.",
      "OrderedDict remembers insertion order and adds move_to_end().",
      "Since Python 3.7 plain dicts also keep insertion order — OrderedDict is for the extras."
    ],
    code: 'from collections import Counter, defaultdict, OrderedDict\n\nvotes = ["Ava", "Bo", "Ava", "Cy", "Bo", "Ava"]\nprint("Vote counts:", Counter(votes))\n\ngroups = defaultdict(list)\nfor name in ["Ava", "Al", "Bo", "Bea"]:\n    groups[name[0]].append(name)\nprint("Grouped by initial:", dict(groups))\n\nd = OrderedDict([("b", 2), ("a", 1)])\nd.move_to_end("b")\nprint("OrderedDict keys:", list(d.keys()))',
    quiz: [
      { q: "Counter('banana') counts...",
        options: ["Each letter's frequency", "The length only", "Unique letters only", "Vowels only"],
        answer: 0, why: "Counter tallies how many times each item appears — b:1, a:3, n:2." },
      { q: "defaultdict(list) does what on a missing key?",
        options: ["Raises KeyError", "Creates an empty list for it", "Returns None", "Deletes the dict"],
        answer: 1, why: "The factory (list) is called to build a default value instead of raising." },
      { q: "Since Python 3.7, plain dicts...",
        options: ["Are unordered", "Sort their keys", "Reject string keys", "Remember insertion order"],
        answer: 3, why: "Insertion order became a guaranteed language feature in Python 3.7." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from collections import Counter\n\nprint(Counter([1, 2, 2, 3, 3, 3]).most_common(1))',
      options: ["[(3, 3)]", "[(1, 1)]", "[(2, 2)]", "[3]"], answer: 0,
      hint: "most_common(1) returns a list with one (item, count) pair — the most frequent one." }
  },
{
    id: "i76", section: "tool-shed", track: "intermediate", title: "The itertools Module: Combinations & Permutations",
    explain: "itertools gives you ready-made tools for combining items: combinations() picks groups where order does not matter, and permutations() lists every ordering. They save you from writing nested loops by hand.",
    takeaways: [
      "`itertools.combinations(items, 2)` picks every unordered pair.",
      "`itertools.permutations(items, 2)` lists every ordered pair.",
      "Both return iterators, so wrap them in `list()` to see all results at once."
    ],
    code: 'import itertools\n\nteam = ["Al", "Bo", "Cy"]\n\nprint(list(itertools.combinations(team, 2)))\nprint(list(itertools.permutations(team, 2)))\nprint(len(list(itertools.combinations("ABCD", 3))))',
    quiz: [
      { q: "How many ways are there to choose 2 friends from 4, when order does not matter?",
        options: ["4", "6", "12", "24"],
        answer: 1, why: "C(4, 2) = 6: the 6 unordered pairs." },
      { q: 'What does itertools.permutations(["a", "b", "c"], 2) return?',
        options: ["All 3 pairs, order ignored", "All 6 ordered pairs", "All 3 pairs twice", "An error"],
        answer: 1, why: "Permutations count order, so (a, b) and (b, a) are different results — 3 x 2 = 6." },
      { q: "When should you use combinations() instead of permutations()?",
        options: ["When order matters", "When you need every ordering", "When order does not matter", "When items repeat"],
        answer: 2, why: "Combinations treat (Al, Bo) and (Bo, Al) as the same group." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import itertools\n\nprint(list(itertools.combinations(["a", "b", "c"], 2)))',
      options: ["[('a', 'b'), ('a', 'c'), ('b', 'c')]", "[('a', 'b'), ('b', 'a'), ('a', 'c'), ('c', 'a')]", "['ab', 'ac', 'bc']", "Error"], answer: 0,
      hint: "Combinations list each unordered pair exactly once." }
  },
  {
    id: "i77", section: "tool-shed", track: "intermediate", title: "bisect: Searching Sorted Lists",
    explain: "bisect finds where a value belongs in a sorted list in O(log n) time, using binary search. bisect_left() finds the spot, and insort() inserts there so the list stays sorted.",
    takeaways: [
      "`bisect.bisect_left(sorted_list, x)` returns the index where x belongs.",
      "`bisect.insort(sorted_list, x)` inserts x and keeps the list sorted.",
      "The list MUST already be sorted, or bisect gives a meaningless answer."
    ],
    code: 'import bisect\n\nscores = [70, 80, 90]\n\nprint(bisect.bisect_left(scores, 85))\nbisect.insort(scores, 85)\nprint(scores)\nprint(bisect.bisect_right(scores, 80))',
    quiz: [
      { q: "What does bisect_left([10, 20, 30], 20) return?",
        options: ["0", "2", "1", "3"],
        answer: 2, why: "bisect_left returns the index of the existing 20, which is 1." },
      { q: "What does bisect.insort(scores, 85) do to a sorted list?",
        options: ["Appends 85 at the end", "Inserts 85 in the right spot, keeping the list sorted", "Sorts the list in descending order", "Removes 85"],
        answer: 1, why: "insort finds the sorted position and inserts there." },
      { q: "What must be true before you use bisect on a list?",
        options: ["The list must already be sorted", "The list must contain only integers", "The list must be empty", "The list must be a tuple"],
        answer: 0, why: "Binary search only works on sorted data; on an unsorted list the answer is meaningless." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import bisect\n\ngrades = [60, 70, 80]\nbisect.insort(grades, 75)\nprint(grades)',
      options: ["[60, 70, 80, 75]", "[60, 75, 70, 80]", "[60, 70, 75, 80]", "Error"], answer: 2,
      hint: "insort slots 75 between 70 and 80, not at the end." }
  },
  {
    id: "i78", section: "algorithm-arena", track: "intermediate", title: "functools: Caching Recursive Functions",
    explain: "functools.lru_cache remembers a function's results, so a repeated call returns instantly instead of recomputing. On recursive functions like Fibonacci it turns exponential work into a handful of calls.",
    takeaways: [
      "`@lru_cache(maxsize=None)` caches every result with no size limit.",
      "Cached arguments must be hashable — no lists or dicts as arguments.",
      "`f.cache_info()` shows hits, misses, and how many results are stored."
    ],
    code: 'from functools import lru_cache\n\ncalls = [0]\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    calls[0] += 1\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n\nprint(fib(10))\nprint(calls[0])\nprint(fib.cache_info())',
    quiz: [
      { q: "What does @lru_cache do to a function?",
        options: ["Stores results so repeated calls return instantly", "Deletes the function after one call", "Runs the function in parallel", "Limits the function to one call"],
        answer: 0, why: "The cache stores each result keyed by its arguments, so repeats skip the work." },
      { q: "Why must cached arguments be hashable?",
        options: ["It makes the function faster", "It stops infinite recursion", "Python requires it for every function", "Cache keys are dict keys, so arguments must be hashable"],
        answer: 3, why: "lru_cache stores results in a dict keyed by the arguments, and dict keys must be hashable." },
      { q: "With lru_cache, how many distinct calls does fib(10) actually compute?",
        options: ["55", "11", "10", "100"],
        answer: 1, why: "Each n from 0 to 10 is computed once and then reused — 11 distinct calls." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from functools import lru_cache\n\ncalls = [0]\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    calls[0] += 1\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n\nprint(fib(6), calls[0])',
      options: ["8 13", "8 7", "6 7", "13 8"], answer: 1,
      hint: "Count the distinct values of n from 0 to 6 — each is computed once." }
  },
  {
    id: "i79", section: "power-lab", track: "intermediate", title: "Generators for Large Data",
    explain: "A generator function uses yield to hand out one value at a time, so a million-item sequence costs almost no memory. You can sum it, loop over it, or feed it to another function without ever building a list.",
    takeaways: [
      "`yield` turns a function into a generator that produces values lazily.",
      "A generator holds only its current state, not the whole sequence.",
      "Once a generator is exhausted, it yields nothing more — make a new one."
    ],
    code: 'def squares(n):\n    for i in range(n):\n        yield i * i\n\nprint(sum(squares(1000)))\nprint(list(squares(5)))',
    quiz: [
      { q: "How is a generator different from a list?",
        options: ["A generator stores all values at once", "A generator makes values one at a time, using little memory", "A generator is always faster", "A generator can be indexed like a list"],
        answer: 1, why: "A generator computes each value on demand and never stores the whole sequence." },
      { q: "What happens after you fully consume a generator?",
        options: ["It restarts from the beginning", "It is exhausted and yields nothing more", "It turns into a list", "It raises ValueError"],
        answer: 1, why: "A generator is single-use; once it is done, iterating again gives nothing." },
      { q: "Which uses the least memory for 10 million numbers?",
        options: ["A list comprehension", "A generator expression", "A list built with append in a loop", "They all use the same memory"],
        answer: 1, why: "A generator expression like (x for x in range(10**7)) holds only one value at a time." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'g = (x * x for x in range(4))\nprint(sum(g))\nprint(sum(g))',
      options: ["14\n14", "0\n14", "14\n0", "Error"], answer: 2,
      hint: "The first sum uses up the generator — what is left for the second?" }
  },
  {
    id: "i80", section: "tool-shed", track: "intermediate", title: "Working with Large Files Efficiently",
    explain: "Reading a huge file with .read() loads it all into memory at once, which can crash your program. Looping over the file object reads one line at a time, so memory stays flat no matter how big the file is.",
    takeaways: [
      "Looping `for line in f:` reads one line at a time — memory stays tiny.",
      "`f.read()` loads the whole file into memory; avoid it for large files.",
      "`with open(...)` closes the file for you, even if an error happens."
    ],
    code: 'with open("big.txt", "w") as f:\n    for i in range(1000):\n        f.write(f"line {i}\\n")\n\ncount = 0\nwith open("big.txt") as f:\n    for line in f:\n        count += 1\n\nprint(count)',
    quiz: [
      { q: "Why read a big file line by line instead of with .read()?",
        options: ["It is faster to type", "Only one line sits in memory at a time", "It skips errors automatically", "It sorts the lines"],
        answer: 1, why: "Streaming line by line keeps memory flat, however large the file is." },
      { q: 'What does open("big.txt").read() do?',
        options: ["Loads the whole file into memory at once", "Reads a single line", "Reads only the first 1 KB", "Closes the file"],
        answer: 0, why: "read() with no argument returns the entire file contents as one string." },
      { q: "What is the best way to process a 5 GB log file?",
        options: ["Load it all with read()", "Read it line by line or in chunks", "Copy it into memory twice", "Sort it first"],
        answer: 1, why: "Chunked or line-by-line reading processes the file without ever holding it all in memory." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def read_lines(n):\n    for i in range(n):\n        yield f"line {i}"\n\nprint(len(list(read_lines(3))))',
      options: ["3", "0", "3000", "Error"], answer: 0,
      hint: "The generator yields one line per number from 0 to 2." }
  },

  {
    id: "i81", section: "data-lab", track: "intermediate", title: "CSV in Depth: Real-World Data Cleaning",
    explain: "Real CSV files are messy: extra spaces, missing values, and blank rows. A good cleaning pass strips whitespace, skips bad rows, and converts text to the right types before you trust the data.",
    takeaways: [
      "`csv.DictReader` reads each row as a dict keyed by the header names.",
      "Use `.strip()` on every field — messy files hide spaces around values.",
      "Missing numbers become `None`, not zero, so you never invent data."
    ],
    code: 'import csv\n\nrows = [["name", "age", "city"], [" Ava ", "29", " Pune "], ["Bo", "", "Mumbai"], ["", "41", "Delhi"]]\nwith open("people.csv", "w", newline="") as f:\n    csv.writer(f).writerows(rows)\n\nclean = []\nwith open("people.csv", newline="") as f:\n    for row in csv.DictReader(f):\n        name = row["name"].strip()\n        if not name:\n            continue\n        age = int(row["age"]) if row["age"].strip() else None\n        clean.append((name, age, row["city"].strip()))\n\nprint(clean)\nprint(len(clean))',
    quiz: [
      { q: "What does csv.DictReader give you for each row?",
        options: ["It writes CSV files", "It sorts the rows", "It reads only the first row", "It reads each row as a dict keyed by the header names"],
        answer: 3, why: "DictReader uses the header row as keys, so you can write row['name']." },
      { q: "Why should you strip() fields from a real CSV file?",
        options: ["To convert text to numbers", "To remove surrounding spaces from messy data", "To delete empty rows", "To add quotes around values"],
        answer: 1, why: "Real files often have spaces like ' Ava ' that would break comparisons and lookups." },
      { q: "How should you handle a missing age in a row you keep?",
        options: ["Skip the row always", "Treat it as missing and keep the row if the name is valid", "Raise an error", "Replace it with the name"],
        answer: 1, why: "A missing age is None, not zero — the row is still useful without inventing a value." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import csv, io\n\ndata = "name,score\\nAl,90\\nBo,80\\n"\nrows = list(csv.DictReader(io.StringIO(data)))\nprint(type(rows[1]["score"]).__name__)',
      options: ["int", "str", "dict", "Error"], answer: 1,
      hint: "DictReader never converts types — every value arrives as text." }
  },
  {
    id: "i82", section: "data-lab", track: "intermediate", title: "JSON APIs: Fetching Real Data",
    explain: "Most web APIs hand you JSON text, and json.loads() turns it into Python dicts and lists you can work with. You fetch the text with a library like requests in real code; here you parse a sample of exactly what an API would return.",
    takeaways: [
      "`json.loads(text)` turns a JSON string into Python dicts and lists.",
      "Navigate the result with keys and indexes, just like any nested dict.",
      "Use `.get(\"key\")` when a field might be missing, to avoid KeyError."
    ],
    code: 'import json\n\n# In a real program this string is what the API returns;\n# you would fetch it with requests, then parse it the same way.\nsample = "{\\"city\\": \\"Pune\\", \\"temp_c\\": 28, \\"condition\\": \\"Sunny\\", \\"forecast\\": [{\\"day\\": \\"Mon\\", \\"temp_c\\": 29}, {\\"day\\": \\"Tue\\", \\"temp_c\\": 27}]}"\ndata = json.loads(sample)\n\nprint(data["city"], data["temp_c"])\nprint(data["forecast"][0]["day"], data["forecast"][0]["temp_c"])\nprint(len(data["forecast"]))',
    quiz: [
      { q: "What does json.loads() do?",
        options: ["Turns a JSON string into Python dicts and lists", "Turns Python data into JSON text", "Fetches a URL", "Validates an API key"],
        answer: 0, why: "loads parses JSON text into the matching Python objects." },
      { q: 'What does data["forecast"][0]["day"] get from the weather data?',
        options: ["The last forecast day", "The first forecast day", "Every day at once", "The temperature"],
        answer: 1, why: "[0] takes the first forecast entry, and ['day'] takes its day name." },
      { q: 'Why use .get("key") instead of ["key"] on API data?',
        options: ["It returns None instead of raising KeyError if the key is missing", "It is faster", "It downloads the data", "It sorts the keys"],
        answer: 0, why: "APIs sometimes omit fields, and .get() handles a missing key gracefully." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import json\n\ndata = json.loads("{\\"users\\": [{\\"name\\": \\"Ava\\"}, {\\"name\\": \\"Bo\\"}]}")\nprint(len(data["users"]))\nprint(data["users"][1]["name"])',
      options: ["2\nAva", "2\nBo", "1\nBo", "2\nCy"], answer: 1,
      hint: "Index 1 is the second user — count the list first, then pick the name." }
  },
  {
    id: "i83", section: "power-lab", track: "intermediate", title: "Error Handling in Real Programs",
    explain: "Real programs meet bad input all the time: a mistyped number, a missing file, a zero divisor. Wrapping the risky part in try/except and catching only the specific error keeps the program running and the bug visible.",
    takeaways: [
      "Catch the specific error, like `ValueError` — never hide every error with a bare `except:`.",
      "`else` runs only when the try block succeeds; `finally` always runs.",
      "A helper that returns `None` on bad input turns crashes into data you can check."
    ],
    code: 'def safe_int(text):\n    try:\n        return int(text)\n    except ValueError:\n        return None\n\nprint(safe_int("42"))\nprint(safe_int("oops"))\nprint(safe_int("7"))\n\ntry:\n    print(10 / 0)\nexcept ZeroDivisionError:\n    print("cannot divide by zero")',
    quiz: [
      { q: "Why catch ValueError specifically instead of a bare except?",
        options: ["So unrelated bugs are not silently hidden", "It is shorter to type", "It runs faster", "It catches every error"],
        answer: 0, why: "A bare except swallows real bugs too; catching one type leaves the rest visible." },
      { q: "When does the else block of try/except/else run?",
        options: ["Only when an exception happens", "When no exception happens in the try block", "Always, even on error", "Never"],
        answer: 1, why: "else is the success path — it runs only if the try block finished cleanly." },
      { q: 'What does safe_int("oops") return?',
        options: ["None", "0", "'oops'", "It raises ValueError"],
        answer: 0, why: "int('oops') raises ValueError, which safe_int catches and turns into None." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return 0\n\nprint(divide(10, 2))\nprint(divide(10, 0))',
      options: ["5\n0", "0\n5.0", "5.0\n0", "Error"], answer: 2,
      hint: "10 / 2 is a float division; the second call hits the except branch." }
  },
  {
    id: "i84", section: "power-lab", track: "intermediate", title: "Logging in Practice",
    explain: "print() is fine for quick checks, but real programs use the logging module: every message carries a level — DEBUG, INFO, WARNING, ERROR — and you can send logs to a file or silence the chatty ones with one setting.",
    takeaways: [
      "Levels go DEBUG < INFO < WARNING < ERROR; only messages at or above the set level show.",
      "`logging.basicConfig(level=logging.INFO)` sets the level in one line.",
      "`stream=sys.stdout` sends logs to standard output so they show up wherever prints do.",
      "Logs can carry timestamps and go to a file — print() cannot do either."
    ],
    code: 'import logging, sys\n\nlogging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stdout)\n\nlogging.info("Phonebook loaded")\nlogging.warning("Bo has no phone number")\nlogging.error("Could not save contacts")\nlogging.debug("This stays hidden")',
    quiz: [
      { q: "What is the order of logging levels from quietest to loudest?",
        options: ["DEBUG < INFO < WARNING < ERROR", "ERROR < WARNING < INFO < DEBUG", "INFO < DEBUG < ERROR < WARNING", "All levels are equal"],
        answer: 0, why: "DEBUG is the most detailed, ERROR the most severe." },
      { q: "Why use logging instead of print() in a real program?",
        options: ["print() cannot show text", "Logs carry a level and can go to a file or include timestamps", "Logging is faster to type", "print() is removed in Python 3"],
        answer: 1, why: "Levels let you filter noise, and handlers can write logs to a file for later." },
      { q: "With level=logging.WARNING, which message shows?",
        options: ["DEBUG", "INFO", "WARNING", "All of them"],
        answer: 2, why: "Only WARNING and above show; DEBUG and INFO are below the threshold." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import logging, sys\n\nlogging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s", stream=sys.stdout)\nlogging.info("started")\nlogging.warning("low disk")',
      options: ["INFO: started", "WARNING: low disk", "INFO: started\nWARNING: low disk", "Nothing prints"], answer: 1,
      hint: "INFO sits below the WARNING threshold, so it is filtered out." }
  },
  {
    id: "i85", section: "power-lab", track: "intermediate", title: "Virtual Environments in Practice",
    explain: "A virtual environment is a private copy of Python for one project, so its packages never clash with another project's. You create it once with python -m venv, activate it, and pip installs everything inside it.",
    takeaways: [
      "`python -m venv .venv` creates a private environment in a .venv folder.",
      "Activate it, then `pip install` puts packages inside the environment only.",
      "`pip freeze > requirements.txt` records exact versions so anyone can rebuild it."
    ],
    code: 'import os, sys\n\nprint(sys.executable)\nprint(sys.prefix)\nprint(os.environ.get("VIRTUAL_ENV", "No virtual environment active"))\nprint(sys.version.split()[0])',
    quiz: [
      { q: "What does a virtual environment do for a project?",
        options: ["Isolates a project's packages from other projects", "Speeds up Python", "Deletes system Python", "Compiles your code"],
        answer: 0, why: "Each venv has its own packages, so two projects can use different versions of the same library." },
      { q: "Which command creates a virtual environment named .venv?",
        options: ["pip install venv", "python -m venv .venv", "python --venv", "venv create .venv"],
        answer: 1, why: "python -m venv .venv builds the environment in a .venv folder." },
      { q: "After activating a venv, where does pip install packages?",
        options: ["Into the active environment, not system Python", "Into the source code file", "Into requirements.txt itself", "Nowhere — pip only lists them"],
        answer: 0, why: "Activation points pip at the venv's own site-packages folder." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'commands = ["python -m venv .venv", "source .venv/bin/activate", "pip install requests"]\nprint(len(commands))\nprint(commands[0])',
      options: ["2\npython -m venv .venv", "3\npython -m venv .venv", "3\nsource .venv/bin/activate", "1\npip install requests"], answer: 1,
      hint: "Count the setup steps, then take the first one." }
  },

  {
    id: "i86", section: "tool-shed", track: "intermediate", title: "Writing Reusable Modules",
    explain: "A module is just a .py file with functions you can import anywhere. Put a helper in its own file once, import it in every script that needs it, and you never copy-paste the same code twice.",
    takeaways: [
      "Any `.py` file is a module — `import greet` loads greet.py.",
      "Importing runs the module's top-level code once, then reuses it.",
      "Keep modules focused on one job so they stay easy to reuse and test."
    ],
    code: 'with open("greet.py", "w") as f:\n    f.write("def hello(name):\\n    return \\"Hello, \\" + name\\n")\n\nimport greet\n\nprint(greet.hello("Ava"))\nprint(greet.__file__)',
    quiz: [
      { q: "What is a Python module?",
        options: ["A folder with no code", "A .py file you can import and reuse", "A single function", "Only a pip package"],
        answer: 1, why: "Any .py file is a module that other files can import." },
      { q: "What happens the first time you import a module?",
        options: ["Python runs the module's top-level code once", "Nothing runs at all", "It runs on every function call", "It deletes the module file"],
        answer: 0, why: "Import executes the file once to define its functions, then caches the result." },
      { q: "Why put reusable code in a module instead of copying it?",
        options: ["To make the program slower", "So you write it once and import it wherever you need it", "To hide code from other files", "Modules cannot be shared"],
        answer: 1, why: "One shared copy means one place to fix bugs and add features." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'with open("calc.py", "w") as f:\n    f.write("def double(n):\\n    return n * 2\\n")\n\nimport calc\n\nprint(calc.double(21))',
      options: ["42", "21", "84", "Error"], answer: 0,
      hint: "double() lives in calc.py — importing it makes the function available." }
  },
  {
    id: "i87", section: "power-lab", track: "intermediate", title: "Type Hints in Practice",
    explain: "Type hints are notes on your functions — def add(a: int, b: int) -> int — that say what types you expect. Python ignores them at runtime, but they make code self-documenting and let tools like mypy catch mistakes before you run it.",
    takeaways: [
      "`def add(a: int, b: int) -> int:` hints the argument and return types.",
      "Hints do NOT enforce types at runtime — wrong types still run.",
      "Run `mypy` to check hints statically; read `f.__annotations__` to see them."
    ],
    code: 'def add(a: int, b: int) -> int:\n    return a + b\n\ndef greet(name: str, excited: bool = False) -> str:\n    return "Hi " + name + ("!" if excited else "")\n\nprint(add(2, 3))\nprint(greet("Ava", True))\nprint(add.__annotations__)',
    quiz: [
      { q: "Do type hints stop you passing the wrong type at runtime?",
        options: ["Yes, Python raises TypeError", "No — they are notes; Python still runs the code", "Only for ints", "Only when mypy is installed"],
        answer: 1, why: "Hints are ignored at runtime; only a static checker like mypy enforces them." },
      { q: "In def add(a: int, b: int) -> int:, what does -> int mean?",
        options: ["The function returns an int", "The function takes one int", "It converts the result to int", "It is a comment"],
        answer: 0, why: "The arrow annotates the return type." },
      { q: "Which tool checks type hints without running your code?",
        options: ["pip", "mypy", "venv", "pdb"],
        answer: 1, why: "mypy reads your hints and reports type mistakes statically." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def double(n: int) -> int:\n    return n * 2\n\nprint(double(21))\nprint(double("21"))',
      options: ["42\n2121", "42\n42", "Error", "2121\n42"], answer: 0,
      hint: "Hints are only notes — Python still runs the code, and a string times 2 repeats it." }
  },
  {
    id: "i88", section: "algorithm-arena", track: "intermediate", title: "Capstone: Phonebook with Search",
    explain: "Time to combine the intermediate toolkit: a phonebook is a dict of names to numbers, with a search that matches part of a name regardless of case. Add, look up, and search — a small program you would actually use.",
    takeaways: [
      "A dict gives fast lookups by exact name; `.get()` avoids KeyError.",
      "Search with `query.lower() in name.lower()` for case-insensitive partial matches.",
      "A dict comprehension builds the matching results in one line."
    ],
    code: 'contacts = {"Ava": "111-1111", "Bo": "222-2222", "Al": "333-3333"}\n\ndef search(contacts, query):\n    q = query.lower()\n    return {name: num for name, num in contacts.items() if q in name.lower()}\n\ncontacts["Cy"] = "444-4444"\nprint(search(contacts, "a"))\nprint(search(contacts, "BO"))\nprint(len(contacts))',
    quiz: [
      { q: "Why is a dict a good fit for a phonebook?",
        options: ["Dicts sort names automatically", "Lookups by name are fast", "Dicts can only store numbers", "Lists cannot hold names"],
        answer: 1, why: "Dict lookup by key is O(1), so finding a contact is instant even with thousands of entries." },
      { q: 'What does phonebook.get("Cy") return when Cy is not in the phonebook?',
        options: ["It raises KeyError", "None", "0", "An empty string"],
        answer: 1, why: ".get() returns None for a missing key instead of raising KeyError." },
      { q: "How do you search case-insensitively for part of a name?",
        options: ["Compare query.lower() with name.lower()", "Use upper() only on the query", "Sort the dict first", "Use == on the raw strings"],
        answer: 0, why: "Lowercasing both sides makes 'BO' match 'Bo', and in checks for a substring." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'phonebook = {"Ava": "111", "Bo": "222"}\nprint(phonebook.get("Cy", "not found"))\nprint(phonebook.get("Ava"))',
      options: ["111\nnot found", "111\n222", "not found\n111", "Error"], answer: 2,
      hint: "The first lookup misses and uses the default; the second finds Ava." }
  },
  {
    id: "i89", section: "algorithm-arena", track: "intermediate", title: "Capstone: Sorting Visualizer (Text-Based)",
    explain: "You can watch a sort happen with nothing but printed bars: each number becomes a row of # characters, and after every pass you print the whole list again. Bubble sort is perfect for this — neighbours swap, and the biggest value bubbles to the end.",
    takeaways: [
      "Print `\"#\" * n` to draw a bar whose length is the value.",
      "Bubble sort compares neighbours and swaps them when they are out of order.",
      "Printing the list after each pass shows the sort converging."
    ],
    code: 'def show(nums):\n    for n in nums:\n        print("#" * n)\n    print("---")\n\nnums = [3, 1, 2]\nshow(nums)\nfor i in range(len(nums)):\n    for j in range(len(nums) - 1):\n        if nums[j] > nums[j + 1]:\n            nums[j], nums[j + 1] = nums[j + 1], nums[j]\n    show(nums)',
    quiz: [
      { q: "What does bubble sort compare on each step?",
        options: ["Neighbouring pairs", "First and last only", "Random pairs", "Every pair at once"],
        answer: 0, why: "Bubble sort walks along the list comparing each adjacent pair." },
      { q: "What does one full pass of bubble sort guarantee?",
        options: ["The list is fully sorted", "The largest unsorted value moves to its correct spot", "The smallest value moves to the end", "Nothing changes"],
        answer: 1, why: "The biggest value bubbles all the way to the end of the unsorted part." },
      { q: "In the bar chart, what does the length of a bar show?",
        options: ["The value itself", "Its index in the list", "How many passes remain", "The sorting speed"],
        answer: 0, why: "Each bar is '#' repeated n times, so longer bars mean bigger numbers." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'nums = [2, 1]\nnums[0], nums[1] = nums[1], nums[0]\nprint(nums)\nprint("#" * nums[0], "#" * nums[1])',
      options: ["[2, 1]\n## #", "[1, 2]\n# ##", "[1, 2]\n## #", "Error"], answer: 1,
      hint: "The swap puts 1 first — then the bars follow the new order." }
  },
  {
    id: "i90", section: "algorithm-arena", track: "intermediate", title: "Capstone: Mini Search Engine",
    explain: "A search engine is simpler than it looks: split each document into lowercase words, count how many of your query words each document contains, and rank the best matches first. That is the whole idea behind an inverted index.",
    takeaways: [
      "Tokenize with `.lower().split()` so 'Python' and 'python' match.",
      "Score each document by how many query words it contains.",
      "Sort by score, highest first — that is ranking."
    ],
    code: 'docs = {1: "Python is great for data science", 2: "Learn Python the fun way", 3: "Baking bread at home"}\n\ndef search(query):\n    words = query.lower().split()\n    scored = []\n    for doc_id, text in docs.items():\n        score = sum(1 for w in words if w in text.lower())\n        if score:\n            scored.append((score, doc_id))\n    scored.sort(reverse=True)\n    return [doc_id for score, doc_id in scored]\n\nprint(search("python"))\nprint(search("python data"))\nprint(search("bread"))',
    quiz: [
      { q: "What is an inverted index?",
        options: ["A list of documents in reverse", "A map from each word to the documents containing it", "A sorted list of titles", "A count of all words"],
        answer: 1, why: "Instead of doc -> words, it stores word -> docs, so lookup by word is instant." },
      { q: "Why lowercase text before matching a query?",
        options: ["So 'Python' and 'python' match", "To save memory", "To sort the results", "Lowercase is required by dicts"],
        answer: 0, why: "Lowercasing both sides makes matching case-insensitive." },
      { q: "How does this mini search engine rank its results?",
        options: ["By document length", "By how many query words each document matches", "Alphabetically by title", "Randomly"],
        answer: 1, why: "Documents matching more query words score higher and sort first." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'docs = ["red apple", "green apple", "red car"]\nquery = "red apple"\nprint([d for d in docs if "red" in d and "apple" in d])',
      options: ["['red apple', 'green apple']", "['green apple']", "['red apple']", "[]"], answer: 2,
      hint: "Only one document contains both words — check each one." }
  }
];
