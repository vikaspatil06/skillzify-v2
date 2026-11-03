var LESSONS_NEW_INTERMEDIATE = [
  {
    id: "i13", track: "intermediate", title: "*args & **kwargs",
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
    id: "i14", track: "intermediate", title: "Advanced String Formatting",
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
    id: "i15", track: "intermediate", title: "enumerate, zip & Unpacking in Loops",
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
    id: "i16", track: "intermediate", title: "Dict & Set Comprehensions",
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
    id: "i17", track: "intermediate", title: "Sorting with key Functions",
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
    id: "i18", track: "intermediate", title: "Copy vs Deep Copy: The Mutation Trap",
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
    id: "i19", track: "intermediate", title: "Exception Hierarchy & Custom Exceptions",
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
    id: "i20", track: "intermediate", title: "Raising Exceptions & Assertions",
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
    id: "i21", track: "intermediate", title: "try/except/else/finally: The Full Picture",
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
    id: "i22", track: "intermediate", title: "Working with CSV Files",
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
    id: "i23", track: "intermediate", title: "JSON: Reading & Writing Data",
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
    id: "i24", track: "intermediate", title: "Files & Folders with pathlib",
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
    id: "i25", track: "intermediate", title: "OOP: Inheritance",
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
    id: "i26", track: "intermediate", title: "OOP: Encapsulation with @property",
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
    id: "i27", track: "intermediate", title: "OOP: Dunder Methods (__str__, __len__, __eq__)",
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
    id: "i28", track: "intermediate", title: "OOP: Class vs Instance, @classmethod & @staticmethod",
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
    id: "i29", track: "intermediate", title: "Iterators & the Iterator Protocol",
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
    id: "i30", track: "intermediate", title: "Generator Expressions & itertools",
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
    id: "i31", track: "intermediate", title: "Recursion Patterns & Limits",
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
    id: "i32", track: "intermediate", title: "Closures & Higher-Order Functions",
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
    id: "i33", track: "intermediate", title: "Big-O Intuition & Timing Code",
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
      options: ["499500 / True", "499500 / False", "0 / True", "Error"], answer: 0,
      hint: "Sum of 0..999 is 499500; elapsed time is always >= 0." }
  },
  {
    id: "i34", track: "intermediate", title: "Regular Expressions Basics",
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
    id: "i35", track: "intermediate", title: "Capstone: File Organizer Script",
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
  }
];
