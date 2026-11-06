var LESSONS_NEW_ADVANCED = [
  {
    id: "a11", section: "power-lab", track: "advanced", title: "Decorators with Arguments & functools.wraps",
    explain: "A decorator factory is a function that takes arguments and returns the real decorator. Inside it, @functools.wraps(fn) copies the wrapped function's name, docstring, and metadata onto the wrapper so debugging and docs keep working.",
    takeaways: ["A decorator with arguments is really a factory: outer call takes args, inner function is the decorator.", "Always apply @functools.wraps(fn) to your wrapper to preserve __name__ and __doc__.", "The wrapper usually takes (*args, **kwargs) so it works with any signature."],
    code: 'import functools\n\ndef repeat(n):\n    def decorator(fn):\n        @functools.wraps(fn)\n        def wrapper(*a, **k):\n            return [fn(*a, **k) for _ in range(n)]\n        return wrapper\n    return decorator\n\n@repeat(2)\ndef greet(name):\n    return "hi " + name\n\nprint(greet("Ava"), greet.__name__)',
    quiz: [
      { q: "What does @functools.wraps(fn) do inside a decorator?",
        options: ["Copies __name__, __doc__ and other metadata from fn onto the wrapper", "Makes the wrapper run faster", "Prevents the decorator from being applied twice", "Turns fn into a generator"],
        answer: 0, why: "wraps updates the wrapper's metadata to look like the original function." },
      { q: "In the example, what does repeat(2) return?",
        options: ["A decorator: a function that takes fn and returns the wrapper", "The number 2", "The wrapped function's return value", "A list of two functions"],
        answer: 0, why: "repeat(2) returns decorator, which is then applied to greet as @repeat(2)." },
      { q: "Without functools.wraps, what would greet.__name__ be after decoration?",
        options: ["'wrapper'", "'greet'", "'repeat'", "It would raise AttributeError"],
        answer: 0, why: "Without wraps, the name of the replacement function (wrapper) leaks through." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def tag(name):\n    def deco(fn):\n        fn.label = name\n        return fn\n    return deco\n\n@tag("math")\ndef add(a, b):\n    return a + b\n\nprint(add.label, add(2, 3))',
      options: ["math 5", "add 5", "math 6", "Error"], answer: 0,
      hint: "tag('math') runs first and returns deco; deco then receives add." }
  },
  {
    id: "a12", section: "power-lab", track: "advanced", title: "Concurrency I: Threading Basics",
    explain: "Threads let one program juggle several tasks that spend most of their time waiting, like downloads or file reads. You start them with threading.Thread, wait with join(), and protect shared data with a Lock.",
    takeaways: ["Threads shine for I/O-bound work, not CPU-bound number crunching (see the GIL lesson).", "Always join() every thread you start so the main program waits for them.", "Guard shared mutable state with threading.Lock to avoid race conditions."],
    code: 'import threading\n\nresults = []\nlock = threading.Lock()\n\ndef work(n):\n    with lock:\n        results.append(n * n)\n\nthreads = [threading.Thread(target=work, args=(i,)) for i in range(5)]\nfor t in threads:\n    t.start()\nfor t in threads:\n    t.join()\nprint(sorted(results))',
    quiz: [
      { q: "Why do we call t.join() on each thread?",
        options: ["To wait until the thread finishes before the program continues", "To terminate the thread immediately", "To give the thread a higher priority", "To duplicate the thread"],
        answer: 0, why: "join() blocks the calling thread until that thread completes." },
      { q: "What is threading.Lock() used for?",
        options: ["Stopping two threads from mutating shared data at the same time", "Locking the computer screen", "Encrypting data in transit", "Pausing the main thread forever"],
        answer: 0, why: "Only one thread can hold the lock, so the critical section runs atomically." },
      { q: "Threads in CPython are a poor fit for which workload?",
        options: ["CPU-heavy computation, because of the GIL", "Downloading many files", "Reading many files from disk", "Handling many network connections"],
        answer: 0, why: "The GIL stops threads from running Python bytecode in parallel on multiple cores." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import threading\n\nnums = []\n\ndef add(x):\n    nums.append(x)\n\nts = [threading.Thread(target=add, args=(i,)) for i in range(3)]\nfor t in ts:\n    t.start()\nfor t in ts:\n    t.join()\nprint(sorted(nums))',
      options: ["[0, 1, 2]", "[0, 1, 2, 3]", "[]", "Error"], answer: 0,
      hint: "join() guarantees every thread finished appending before the print runs." }
  },
  {
    id: "a13", section: "power-lab", track: "advanced", title: "Concurrency II: asyncio Basics",
    explain: "asyncio runs many tasks on a single thread with an event loop. Coroutines declared with async def pause at await, letting other tasks run while they wait — no threads, no GIL fights.",
    takeaways: ["Write coroutines with async def and pause them with await.", "asyncio.gather() runs coroutines concurrently and returns results in order.", "asyncio.run(main()) starts the event loop from normal synchronous code."],
    code: 'import asyncio\n\nasync def fetch(name):\n    await asyncio.sleep(0)\n    return "data:" + name\n\nasync def main():\n    out = await asyncio.gather(fetch("a"), fetch("b"), fetch("c"))\n    print(out)\n\nasyncio.run(main())',
    quiz: [
      { q: "What does await do inside a coroutine?",
        options: ["Pauses this coroutine so the event loop can run others until the awaited thing completes", "Freezes the entire program", "Starts a new operating-system thread", "Cancels the coroutine"],
        answer: 0, why: "await yields control back to the event loop instead of blocking." },
      { q: "asyncio.gather(a(), b(), c()) returns results in which order?",
        options: ["The order the coroutines were passed in", "The order they finish", "Random order", "Reverse order"],
        answer: 0, why: "gather preserves argument order regardless of completion order." },
      { q: "Which call runs an async main() from regular code?",
        options: ["asyncio.run(main())", "main.start()", "await main() at module top level", "asyncio.thread(main())"],
        answer: 0, why: "asyncio.run() creates the event loop, runs the coroutine, and closes the loop." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import asyncio\n\nasync def double(x):\n    await asyncio.sleep(0)\n    return x * 2\n\nasync def main():\n    print(await asyncio.gather(double(1), double(2), double(3)))\n\nasyncio.run(main())',
      options: ["[2, 4, 6]", "[6, 4, 2]", "(2, 4, 6)", "Error"], answer: 0,
      hint: "gather keeps the order of its arguments in the result list." }
  },
  {
    id: "a14", section: "power-lab", track: "advanced", title: "The GIL & Multiprocessing",
    explain: "The Global Interpreter Lock lets only one thread execute Python bytecode at a time, so threads can't speed up CPU-bound code. The multiprocessing module sidesteps the GIL with separate processes, each with its own interpreter and memory.",
    takeaways: ["The GIL means one thread runs Python bytecode at a time per process.", "multiprocessing gives true parallelism for CPU-bound work via separate processes.", "Processes don't share memory: data is pickled back and forth, so keep payloads small."],
    code: 'import multiprocessing\n\ndef square(n):\n    return n * n\n\nif __name__ == "__main__":\n    with multiprocessing.Pool(2) as pool:\n        print(pool.map(square, [1, 2, 3, 4]))',
    quiz: [
      { q: "What does the GIL actually prevent?",
        options: ["Two threads executing Python bytecode truly in parallel", "Two separate processes running at once", "Importing C extensions", "Using more than one CPU core for separate programs"],
        answer: 0, why: "The GIL is per-process; separate processes each have their own." },
      { q: "Why guard multiprocessing code with if __name__ == \"__main__\"?",
        options: ["So child processes re-importing the module don't spawn more children", "It makes the code run faster", "It is required for every Python script", "It disables the GIL"],
        answer: 0, why: "On some platforms children re-import the module, which would re-execute the spawn code." },
      { q: "How do processes exchange data compared to threads?",
        options: ["They don't share memory; data is serialized (pickled) between them", "They share all memory freely", "Through threading.Lock", "They cannot exchange data at all"],
        answer: 0, why: "Each process has isolated memory, so arguments and results are pickled." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import multiprocessing\n\ndef cube(n):\n    return n ** 3\n\nif __name__ == "__main__":\n    with multiprocessing.Pool(2) as pool:\n        print(pool.map(cube, [1, 2, 3]))',
      options: ["[1, 8, 27]", "[1, 2, 3]", "[3, 2, 1]", "Error"], answer: 0,
      hint: "Pool.map applies the function to each item and preserves input order." }
  },
  {
    id: "a15", section: "object-castle", track: "advanced", title: "Writing Your Own Context Managers",
    explain: "Any class with __enter__ and __exit__ works with the with statement. __enter__ sets things up, and __exit__ always runs afterward — even when the block raises — making it perfect for cleanup.",
    takeaways: ["__enter__ sets up and usually returns the resource bound by 'as'.", "__exit__ always runs: put cleanup there, not after the with block.", "Return True from __exit__ to suppress an exception; return False (or None) to let it propagate."],
    code: 'import time\n\nclass Timer:\n    def __enter__(self):\n        self.t0 = time.perf_counter()\n        return self\n    def __exit__(self, exc_type, exc, tb):\n        self.elapsed = time.perf_counter() - self.t0\n        return False\n\nwith Timer() as t:\n    total = sum(range(1000))\nprint(t.elapsed >= 0)',
    quiz: [
      { q: "When is __exit__ called?",
        options: ["Always: whether the block ends normally or raises", "Only when an exception occurs", "Only when no exception occurs", "Never, it is just documentation"],
        answer: 0, why: "Guaranteed cleanup is the whole point of context managers." },
      { q: "How can a context manager suppress an exception from the with block?",
        options: ["__exit__ returns True", "__enter__ returns None", "Raise a different exception inside", "Delete the exception object"],
        answer: 0, why: "A truthy return from __exit__ tells Python the exception was handled." },
      { q: "What does __enter__ typically return?",
        options: ["The resource that 'with ... as name' binds to", "Always None", "The exception, if one occurred", "A boolean flag"],
        answer: 0, why: "The as-target receives whatever __enter__ returns." }
    ],
    challenge: { type: "blank", prompt: "Fill in the blank so this prints: open",
      code: 'class Door:\n    def __enter__(self):\n        return "open"\n    def __exit__(self, *exc):\n        return False\n\nwith Door() as d:\n    x = ____\nprint(x)',
      answer: ["d"],
      hint: "The as-target receives whatever __enter__ returned." }
  },
  {
    id: "a16", section: "power-lab", track: "advanced", title: "Generators: send(), Coroutines & Pipelines",
    explain: "Calling .send(value) on a generator feeds a value in as the result of the currently-paused yield expression. That turns generators into coroutines you can chain into lazy data-processing pipelines.",
    takeaways: ["yield both produces a value outward and receives the next send() value inward.", "Prime a coroutine with next(gen) before the first send().", "Chain small generators so each stage lazily transforms the stream."],
    code: 'def averager():\n    total = 0.0\n    count = 0\n    while True:\n        x = yield total / count if count else 0.0\n        total += x\n        count += 1\n\navg = averager()\nnext(avg)\navg.send(10)\navg.send(20)\nprint(avg.send(30))',
    quiz: [
      { q: "In 'x = yield 10', what does gen.send(99) do?",
        options: ["Resumes the generator with x bound to 99", "Yields 99 out to the caller", "Restarts the generator from the top", "Immediately raises StopIteration"],
        answer: 0, why: "send() resumes at the paused yield and the expression evaluates to the sent value." },
      { q: "Why call next(gen) before the first send()?",
        options: ["The generator must run to its first yield before it can receive a value", "It clears the generator's memory", "send() only works after close()", "It is optional style with no effect"],
        answer: 0, why: "A just-created generator hasn't started; only None can be sent before the first yield." },
      { q: "What do generator-based pipelines buy you?",
        options: ["Lazy, memory-efficient stage-by-stage data processing", "Faster CPU arithmetic", "Automatic multithreading", "Free disk persistence"],
        answer: 0, why: "Each stage yields items on demand instead of building giant intermediate lists." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def doubler():\n    total = 0\n    while True:\n        x = yield total\n        total += x * 2\n\ng = doubler()\nnext(g)\nprint(g.send(5))\nprint(g.send(3))',
      options: ["10\n16", "5\n8", "0\n10", "Error"], answer: 0,
      hint: "Trace it: after send(5), total is 0 + 5*2 = 10, which is then yielded." }
  },
  {
    id: "a17", section: "object-castle", track: "advanced", title: "Descriptors & the Descriptor Protocol",
    explain: "A descriptor is any object defining __get__, __set__, or __delete__. Python calls these hooks automatically on attribute access — it's the machinery behind @property, @staticmethod, and most ORMs.",
    takeaways: ["Descriptors intercept attribute access via __get__ / __set__ / __delete__.", "__set_name__ tells the descriptor which attribute name it was assigned to.", "@property is just a convenient built-in descriptor."],
    code: 'class Positive:\n    def __set_name__(self, owner, name):\n        self.name = name\n    def __get__(self, obj, objtype=None):\n        return obj.__dict__[self.name]\n    def __set__(self, obj, value):\n        if value < 0:\n            raise ValueError("must be positive")\n        obj.__dict__[self.name] = value\n\nclass Item:\n    price = Positive()\n    def __init__(self, price):\n        self.price = price\n\nprint(Item(7).price)',
    quiz: [
      { q: "Which methods make a class a descriptor?",
        options: ["__get__, __set__, or __delete__", "__init__ and __repr__", "__enter__ and __exit__", "__iter__ and __next__"],
        answer: 0, why: "Defining any of these hooks opts the class into the descriptor protocol." },
      { q: "In 'class Item: price = Positive()', when is Positive.__set__ called?",
        options: ["When you assign item.price = ...", "When the class body is defined", "When you read item.price", "Never: descriptors only work via @property"],
        answer: 0, why: "__set__ fires on attribute assignment; __get__ fires on reads." },
      { q: "What is @property built on?",
        options: ["The descriptor protocol", "Metaclasses", "Multiple inheritance", "The GIL"],
        answer: 0, why: "property is a class implementing __get__/__set__/__delete__." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Shout:\n    def __get__(self, obj, objtype=None):\n        return obj._name.upper()\n    def __set__(self, obj, value):\n        obj._name = value\n\nclass User:\n    name = Shout()\n\nu = User()\nu.name = "ava"\nprint(u.name)',
      options: ["AVA", "ava", "None", "Error"], answer: 0,
      hint: "Assignment triggers __set__; reading triggers __get__, which uppercases." }
  },
  {
    id: "a18", section: "object-castle", track: "advanced", title: "How Classes Work: type() & Metaclasses Intro",
    explain: "Classes are objects, and type(name, bases, dict) is the call that creates them — class X: ... is syntax sugar for it. A metaclass is the class of a class: Python calls it to build every class, letting you customize class creation itself.",
    takeaways: ["type('X', (Base,), {...}) creates a class dynamically at runtime.", "The metaclass of a normal class is type.", "Metaclass hooks run at class-definition time, not when you instantiate."],
    code: 'def init(self, v):\n    self.v = v\n\nPoint = type("Point", (), {"__init__": init})\np = Point(5)\nprint(type(p).__name__, p.v)',
    quiz: [
      { q: "What does type('A', (B,), {'x': 1}) return?",
        options: ["A new class named A inheriting B with class attribute x = 1", "An instance of B", "The string 'A'", "A tuple"],
        answer: 0, why: "The three-argument form of type() is the class factory." },
      { q: "What is the metaclass of a normal class?",
        options: ["type", "object", "The class itself", "None"],
        answer: 0, why: "type is the default metaclass; classes are instances of type." },
      { q: "When does a metaclass's __new__ run?",
        options: ["When the class statement executes (class-creation time)", "Each time you instantiate the class", "When you call a method", "Only when the metaclass module is imported"],
        answer: 0, why: "Metaclasses customize class creation, which happens once at definition." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def init(self, v):\n    self.v = v\n\nK = type("K", (), {"__init__": init, "double": lambda self: self.v * 2})\nprint(K(21).double())',
      options: ["42", "21", "84", "Error"], answer: 0,
      hint: "The dict passed to type() becomes the class namespace: methods and all." }
  },
  {
    id: "a19", section: "power-lab", track: "advanced", title: "functools Toolkit: lru_cache, partial, reduce",
    explain: "functools packs three high-leverage helpers: lru_cache memoizes expensive pure functions, partial freezes some arguments of a function, and reduce folds an iterable into a single value.",
    takeaways: ["@lru_cache(maxsize=None) memoizes pure functions: same args, instant answer.", "partial(fn, a) returns a new callable with argument a pre-filled.", "reduce(fn, iterable, start) folds left; pair it with the operator module for clean code."],
    code: 'from functools import lru_cache, reduce\nimport operator\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(fib(10))\nprint(reduce(operator.mul, [1, 2, 3, 4], 1))',
    quiz: [
      { q: "What does @lru_cache do?",
        options: ["Caches return values so repeated calls with the same arguments are instant", "Deletes old function definitions", "Runs the function on multiple cores", "Converts recursion into iteration"],
        answer: 0, why: "It memoizes: a cache keyed by arguments stores past results." },
      { q: "What does partial(int, base=2) return?",
        options: ["A callable like int but with base pre-set to 2", "The integer 2", "A syntax error", "A new class"],
        answer: 0, why: "partial freezes arguments, returning a new callable awaiting the rest." },
      { q: "reduce(operator.add, [1, 2, 3], 10) equals?",
        options: ["16", "6", "10", "12310"],
        answer: 0, why: "Start at 10, then 10+1+2+3 = 16." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from functools import lru_cache\n\ncalls = []\n\n@lru_cache(maxsize=None)\ndef f(x):\n    calls.append(x)\n    return x * 10\n\nf(2)\nf(2)\nf(3)\nprint(len(calls), f(2))',
      options: ["2 20", "3 20", "2 2", "3 30"], answer: 0,
      hint: "The second f(2) hits the cache, so the body runs only twice total." }
  },
  {
    id: "a20", section: "object-castle", track: "advanced", title: "Dataclasses: Less Boilerplate OOP",
    explain: "The @dataclass decorator generates __init__, __repr__, and __eq__ from simple annotated field declarations. For mutable defaults like lists, use field(default_factory=list) — a plain [] default is rejected.",
    takeaways: ["@dataclass writes __init__, __repr__, and __eq__ for you.", "Annotate each field; mutable defaults need field(default_factory=...).", "Dataclass instances compare by value with ==, not by identity."],
    code: 'from dataclasses import dataclass, field\n\n@dataclass\nclass Student:\n    name: str\n    grades: list = field(default_factory=list)\n    def average(self):\n        g = self.grades\n        return sum(g) / len(g) if g else 0\n\ns = Student("Ava", [80, 100])\nprint(s.name, s.average())',
    quiz: [
      { q: "Why field(default_factory=list) instead of grades: list = []?",
        options: ["A plain [] would be shared across all instances", "It runs faster", "Lists are banned as defaults entirely", "It makes the list immutable"],
        answer: 0, why: "default_factory calls list() fresh for each instance; a literal default is one shared object." },
      { q: "Which methods does @dataclass generate by default?",
        options: ["__init__, __repr__, and __eq__", "Only __init__", "Only __str__ and __hash__", "None: it is just documentation"],
        answer: 0, why: "Those three are the core boilerplate it writes for you." },
      { q: "Student('Ava', [80]) == Student('Ava', [80]) evaluates to?",
        options: ["True: dataclasses compare by value", "False: they are different objects", "It raises TypeError", "None"],
        answer: 0, why: "The generated __eq__ compares field tuples, not identity." }
    ],
    challenge: { type: "blank", prompt: "Fill in the blank so this prints: Point(x=3, y=0)",
      code: 'from dataclasses import dataclass\n\n@dataclass\nclass Point:\n    x: int\n    y: int = ____\n\nprint(Point(3))',
      answer: ["0"],
      hint: "y needs a default value so it can be omitted." }
  },
  {
    id: "a21", section: "power-lab", track: "advanced", title: "Type Hints & Static Checking",
    explain: "Type hints like def f(x: int) -> int document intent and let tools like mypy catch bugs before runtime. Python itself ignores them completely — they're metadata for humans and checkers, not enforcement.",
    takeaways: ["Hints are documentation plus tooling; Python never enforces them at runtime.", "Use list[int], dict[str, int], and X | None for modern container and optional hints.", "Run mypy or pyright in CI to catch type errors before they ship."],
    code: 'def add(a: int, b: int) -> int:\n    return a + b\n\nprint(add(2, 3))\nprint(add.__annotations__)',
    quiz: [
      { q: "Does Python enforce type hints at runtime?",
        options: ["No: they are ignored at runtime; tools like mypy check them statically", "Yes: wrong types raise TypeError", "Only for int hints", "Only inside classes"],
        answer: 0, why: "Hints live in __annotations__; nothing checks them unless you run a checker." },
      { q: "What does add.__annotations__ hold?",
        options: ["The parameter and return annotations as a dict", "The function's source code", "The types of local variables", "Nothing: the attribute does not exist"],
        answer: 0, why: "Annotations are stored in a plain dict on the function object." },
      { q: "How do you hint 'a list of ints' on modern Python (3.9+)?",
        options: ["list[int]", "List<int>", "int[]", "Array[int]"],
        answer: 0, why: "Builtin generics like list[int] work since Python 3.9." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def add(a: int, b: int) -> int:\n    return a + b\n\nprint(add("x", "y"))',
      options: ["xy", "Error", "None", "0"],
      answer: 0,
      hint: "Hints are not enforced: 'x' + 'y' is perfectly valid string concatenation." }
  },
  {
    id: "a22", section: "power-lab", track: "advanced", title: "Logging Done Right",
    explain: "The logging module replaces print-debugging with leveled, configurable output. Get a logger per module with getLogger(__name__), log at the right level, and configure handlers and formatting once at startup.",
    takeaways: ["Use logging.getLogger(__name__) per module instead of the root logger directly.", "Levels ascend: DEBUG < INFO < WARNING < ERROR < CRITICAL.", "Configure once with basicConfig or dictConfig; library code should never print()."],
    code: 'import logging\n\nlogging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")\nlog = logging.getLogger("app")\nlog.debug("hidden")\nlog.info("started")\nlog.warning("careful")',
    quiz: [
      { q: "With level=logging.INFO, which call produces no output?",
        options: ["log.debug('x')", "log.info('x')", "log.warning('x')", "log.error('x')"],
        answer: 0, why: "DEBUG is below the INFO threshold, so it is filtered out." },
      { q: "Why prefer logging over print() for diagnostics?",
        options: ["Levels, timestamps, and routing to files or handlers without code changes", "It is faster to type", "print() is deprecated", "Logging uses less memory"],
        answer: 0, why: "Logging separates the decision to record from where the record goes." },
      { q: "What does logging.getLogger('app') return on the second call?",
        options: ["The same logger object as the first call", "A brand-new logger", "None", "It raises an error"],
        answer: 0, why: "Loggers are cached by name in a registry; same name, same object." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import logging\nlog = logging.getLogger("demo")\nprint(log.name)\nprint(log.getEffectiveLevel() == logging.WARNING)',
      options: ["demo\nTrue", "demo\nFalse", "root\nTrue", "Error"], answer: 0,
      hint: "A fresh logger inherits the default WARNING level from the root logger." }
  },
  {
    id: "a23", section: "power-lab", track: "advanced", title: "Debugging with pdb",
    explain: "pdb is Python's built-in debugger: calling breakpoint() drops you into an interactive shell at that line. Step with n, continue with c, inspect values with p, and quit with q.",
    takeaways: ["breakpoint() starts a pdb session at that line (Python 3.7+).", "n runs the next line, c continues, p <expr> prints a value, q quits.", "Use pp for pretty-printing and l to see surrounding source."],
    code: 'def divide(a, b):\n    # breakpoint()  <- drop in here: try p a, then n, then c\n    return a / b\n\nprint(divide(10, 2))',
    quiz: [
      { q: "What does breakpoint() do?",
        options: ["Opens an interactive pdb session at that line", "Stops the program permanently", "Deletes the enclosing function", "Runs the test suite"],
        answer: 0, why: "It invokes the built-in debugger right where it is called." },
      { q: "In pdb, what does the 'n' command do?",
        options: ["Executes the current line and moves to the next one", "Creates a new breakpoint", "Prints all local variables", "Exits the debugger"],
        answer: 0, why: "n means next: step over the current line." },
      { q: "How do you inspect a variable's value inside pdb?",
        options: ["p varname", "print is the only way", "show varname", "echo varname"],
        answer: 0, why: "p evaluates and prints the expression in the current frame." }
    ],
    challenge: { type: "predict", prompt: "If you put breakpoint() on the s += x line, pdb would show s as 1, then 3, then 6. What does the program print?",
      code: 'def total(xs):\n    s = 0\n    for x in xs:\n        s += x\n    return s\n\nprint(total([1, 2, 3]))',
      options: ["6", "5", "3", "Error"], answer: 0,
      hint: "The debugger only observes; the loop still sums 1 + 2 + 3." }
  },
  {
    id: "a24", section: "power-lab", track: "advanced", title: "Packaging: Ship Your Own pip Package",
    explain: "Shipping a package means a pyproject.toml describing your project plus your code in a package directory. pip install -e . installs it editable for development, and python -m build plus twine take it to PyPI.",
    takeaways: ["pyproject.toml holds name, version, dependencies, and the build backend.", "Keep importable code in a package directory with an __init__.py.", "pip install -e . for local development; build with python -m build."],
    code: '# myapp/__init__.py\n__version__ = "1.0.0"\n\ndef hello(name):\n    return "Hello, " + name + "!"\n\nprint(__version__)\nprint(hello("pip"))',
    quiz: [
      { q: "What does pyproject.toml describe?",
        options: ["Project metadata: name, version, dependencies, build system", "Only the Python interpreter version", "Your IDE settings", "Git history"],
        answer: 0, why: "It is the standard manifest pip and build tools read." },
      { q: "What does pip install -e . do?",
        options: ["Installs the local package in editable mode so changes take effect immediately", "Erases the installed package", "Installs from the internet only", "Encrypts your source code"],
        answer: 0, why: "Editable installs link to your working directory instead of copying." },
      { q: "Where does importable package code live?",
        options: ["In a directory with an __init__.py (or a namespace-package directory)", "Only inside site-packages", "Inside pyproject.toml itself", "In any .txt file"],
        answer: 0, why: "The package directory is what Python puts on the import path." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: '__version__ = "2.5.0"\nmajor, minor, patch = __version__.split(".")\nprint(major, int(minor) + int(patch))',
      options: ["2 5", "2.5.0 5", "2 7", "Error"], answer: 0,
      hint: "split('.') gives ['2', '5', '0']; add the last two as integers." }
  },
  {
    id: "a25", section: "object-castle", track: "advanced", title: "Design Patterns in Python",
    explain: "Design patterns are reusable solutions to common problems: Singleton (one shared instance), Observer (publish/subscribe), Factory (create objects without naming the class). Python often implements them with dunders, decorators, or first-class functions instead of heavy class hierarchies.",
    takeaways: ["Singleton: override __new__ to return the existing instance.", "Observer: keep a list of subscriber callbacks and notify them on change.", "Prefer simple Pythonic tools (functions, context managers) over heavyweight pattern machinery."],
    code: 'class Logger:\n    _instance = None\n    def __new__(cls):\n        if cls._instance is None:\n            cls._instance = super().__new__(cls)\n            cls._instance.records = []\n        return cls._instance\n    def log(self, msg):\n        self.records.append(msg)\n\na = Logger()\nb = Logger()\na.log("x")\nprint(a is b, len(b.records))',
    quiz: [
      { q: "How does the Singleton ensure a single instance?",
        options: ["__new__ returns the existing instance instead of creating a new one", "__init__ raises an error on second use", "It relies on a global variable alone", "Python does this automatically for all classes"],
        answer: 0, why: "__new__ controls instance creation, so it can return the cached object." },
      { q: "In the Observer pattern, what does the subject keep?",
        options: ["A list of subscriber callbacks to notify on changes", "A database connection", "A thread pool", "A deep copy of every object"],
        answer: 0, why: "Observers subscribe callbacks; the subject calls them when state changes." },
      { q: "What is the most Pythonic 'factory'?",
        options: ["A plain function that returns instances", "A five-class inheritance hierarchy", "Always a metaclass", "eval() on class-name strings"],
        answer: 0, why: "Functions are first-class; a simple function beats pattern ceremony." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class Config:\n    _inst = None\n    def __new__(cls):\n        if cls._inst is None:\n            cls._inst = super().__new__(cls)\n            cls._inst.mode = "dev"\n        return cls._inst\n\nc1 = Config()\nc2 = Config()\nc1.mode = "prod"\nprint(c2.mode)',
      options: ["prod", "dev", "None", "Error"], answer: 0,
      hint: "c1 and c2 are the same object, so the mutation is visible through both." }
  },
  {
    id: "a26", section: "launch-pad", track: "advanced", title: "SQLite Databases with Python",
    explain: "The sqlite3 module is in the standard library and stores a full SQL database in one file — or in RAM with :memory:. Always use ? placeholders for values; never format them into SQL strings yourself.",
    takeaways: ["sqlite3.connect(':memory:') gives you a throwaway database for experiments.", "Use ? placeholders to prevent SQL injection.", "commit() persists writes; close connections with a context manager or try/finally."],
    code: 'import sqlite3\n\ndb = sqlite3.connect(":memory:")\ndb.execute("CREATE TABLE users (name TEXT, age INTEGER)")\ndb.executemany("INSERT INTO users VALUES (?, ?)", [("Ava", 30), ("Bo", 25)])\ndb.commit()\nrows = db.execute("SELECT name FROM users WHERE age > 26 ORDER BY name").fetchall()\nprint(rows)\ndb.close()',
    quiz: [
      { q: "Why use ? placeholders instead of f-strings in SQL?",
        options: ["To prevent SQL injection attacks", "They are faster to type", "f-strings cannot be used with SQL", "Placeholders are required by law"],
        answer: 0, why: "The driver safely escapes bound values; string formatting lets attackers inject SQL." },
      { q: "What does commit() do?",
        options: ["Persists pending writes to the database", "Deletes the table", "Opens a new connection", "Prints the schema"],
        answer: 0, why: "Writes sit in a transaction until committed." },
      { q: "What is sqlite3.connect(':memory:')?",
        options: ["A temporary database kept in RAM", "A connection to a remote server", "A read-only database file", "An error"],
        answer: 0, why: ":memory: is the special name for a private in-RAM database." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import sqlite3\ndb = sqlite3.connect(":memory:")\ndb.execute("CREATE TABLE t (v INTEGER)")\ndb.executemany("INSERT INTO t VALUES (?)", [(1,), (2,), (3,)])\nn = db.execute("SELECT SUM(v) FROM t").fetchone()[0]\nprint(n)',
      options: ["6", "123", "(6,)", "Error"], answer: 0,
      hint: "fetchone() returns one row tuple; [0] takes its first column." }
  },
  {
    id: "a27", section: "launch-pad", track: "advanced", title: "Talking to APIs: requests & JSON",
    explain: "The requests library turns HTTP into one-liners: requests.get(url).json() fetches a URL and parses the JSON body. Always set a timeout, check the status code, and parse defensively since APIs change shape.",
    takeaways: ["requests.get(url, timeout=10).json() is the core API-call pattern.", "Always set a timeout and check response.status_code before trusting the body.", "Parse defensively with .get() and defaults: API responses change."],
    code: 'import json\n\n# this is what requests.get(url).json() would hand you:\nsample = \'{"name": "Skillzify", "users": 1200, "tags": ["python", "learn"]}\'\ndata = json.loads(sample)\nprint(data["name"], data["users"])\nprint(data["tags"][1].upper())',
    quiz: [
      { q: "What does requests.get(url).json() do?",
        options: ["Fetches the URL and parses the response body as JSON", "Downloads a file to disk", "Sends JSON data to the server", "Opens the URL in a browser"],
        answer: 0, why: ".json() decodes the response bytes into Python objects." },
      { q: "Why pass timeout=10 to requests.get?",
        options: ["So a hung server cannot freeze your program forever", "It makes the server respond faster", "It is required for JSON responses", "It enables response caching"],
        answer: 0, why: "Without a timeout, a dead server can block your call indefinitely." },
      { q: "How should you read a possibly-missing key from API JSON?",
        options: ["data.get('key') with a sensible default", "data['key'] and hope for the best", "eval() on the raw text", "Assume the key always exists"],
        answer: 0, why: ".get() avoids KeyError when the API shape drifts." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import json\nraw = \'{"items": [{"id": 1}, {"id": 2}, {"id": 3}]}\'\ndata = json.loads(raw)\nprint(len(data["items"]), data["items"][-1]["id"])',
      options: ["3 3", "3 2", "2 3", "Error"], answer: 0,
      hint: "Three dicts in the list; [-1] is the last one, whose id is 3." }
  },
  {
    id: "a28", section: "power-lab", track: "advanced", title: "Profiling & Optimization",
    explain: "Profile before you optimize: cProfile shows where your program really spends time, and timeit gives trustworthy micro-benchmarks. Most real wins come from better algorithms, not micro-tweaks.",
    takeaways: ["cProfile plus pstats finds the actual hotspots: measure, don't guess.", "timeit.repeat avoids one-off timing noise for fair comparisons.", "Optimize algorithms first; readability beats cleverness everywhere else."],
    code: 'import cProfile, pstats, io\n\ndef slow():\n    return sum(i * i for i in range(10000))\n\npr = cProfile.Profile()\npr.enable()\nslow()\npr.disable()\nout = io.StringIO()\npstats.Stats(pr, stream=out).print_stats(1)\nprint("profiled ok")',
    quiz: [
      { q: "What is cProfile for?",
        options: ["Measuring where your program spends its time", "Checking code style", "Compressing files", "Encrypting data"],
        answer: 0, why: "It records per-function call counts and cumulative time." },
      { q: "Why use timeit instead of time.time() around code once?",
        options: ["It repeats the measurement and reduces timing noise for stable results", "It is shorter to type", "time.time() is deprecated", "It runs the code in parallel"],
        answer: 0, why: "Repetition plus setup control makes micro-benchmarks trustworthy." },
      { q: "What is the first rule of optimization?",
        options: ["Measure first: profile before changing anything", "Rewrite everything in C", "Delete all comments", "Use shorter variable names"],
        answer: 0, why: "Guessing hotspots wastes effort; profilers show the truth." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import timeit\nt1 = timeit.timeit(\'"-".join(str(n) for n in range(100))\', number=100)\nt2 = timeit.timeit(\'"-".join(map(str, range(100)))\', number=100)\nprint(t1 > 0 and t2 > 0)',
      options: ["True", "False", "0", "Error"], answer: 0,
      hint: "Both timings are positive durations, so the comparison is always True." }
  },
  {
    id: "a29", section: "launch-pad", track: "advanced", title: "Capstone: argparse CLI Application",
    explain: "argparse turns a script into a real command-line tool: positional arguments, --flags, help text, and type conversion come free. parse_args() reads sys.argv, but you can pass an explicit list when testing.",
    takeaways: ["add_argument defines positionals ('name') and optionals ('--shout').", "type=int converts input; action='store_true' makes boolean flags.", "--help is generated automatically from your help= strings."],
    code: 'import argparse\n\ndef build_parser():\n    p = argparse.ArgumentParser(description="Greet someone")\n    p.add_argument("name")\n    p.add_argument("--shout", action="store_true")\n    return p\n\nargs = build_parser().parse_args(["Ava", "--shout"])\nmsg = "Hello, " + args.name + "!"\nprint(msg.upper() if args.shout else msg)',
    quiz: [
      { q: "What does add_argument('--shout', action='store_true') create?",
        options: ["A boolean flag that is False unless --shout is passed", "A required string argument", "A subcommand", "An environment variable"],
        answer: 0, why: "store_true flips the default False to True when the flag appears." },
      { q: "How do you test argparse code without real command-line arguments?",
        options: ["parser.parse_args(['Ava', '--shout']) with an explicit list", "You cannot: it only ever reads sys.argv", "By editing sys.path", "With input() prompts"],
        answer: 0, why: "parse_args optionally takes the argument list, which makes it testable." },
      { q: "What does --help do for an argparse program?",
        options: ["Prints auto-generated usage from your declared arguments", "Opens a web browser", "Deletes the parser", "Nothing at all"],
        answer: 0, why: "argparse builds the help screen from your arguments and help= strings." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import argparse\np = argparse.ArgumentParser()\np.add_argument("x", type=int)\np.add_argument("--times", type=int, default=1)\na = p.parse_args(["5", "--times", "3"])\nprint(a.x * a.times)',
      options: ["15", "8", "53", "Error"], answer: 0,
      hint: "x becomes int 5, --times becomes int 3; multiply them." }
  },
  {
    id: "a30", section: "power-lab", track: "advanced", title: "Pythonic Idioms Masterclass",
    explain: "Pythonic code leans on the language: comprehensions, zip, enumerate, any/all, unpacking, and context managers. These idioms are shorter, often faster, and instantly readable to experienced Python developers.",
    takeaways: ["Prefer comprehensions and any()/all() over manual accumulator loops.", "Unpack with a, b = ... and a, *rest = ...; iterate pairs with zip and enumerate.", "Idiomatic code is a feature: it signals intent to every Python reader."],
    code: 'words = ["  Hello ", "WORLD", " python "]\nclean = [w.strip().lower() for w in words]\nprint(clean)\npairs = dict(zip(["a", "b"], [1, 2]))\nprint(pairs)\nprint(any(x > 5 for x in [1, 9, 3]))',
    quiz: [
      { q: "Which is the most Pythonic way to build a doubled list?",
        options: ["[x * 2 for x in xs]", "A for loop with result.append(x * 2)", "map() with a lambda stored in a variable", "A while loop with a manual index"],
        answer: 0, why: "The comprehension states the transformation directly and idiomatically." },
      { q: "What does a, *rest = [1, 2, 3, 4] bind?",
        options: ["a = 1, rest = [2, 3, 4]", "a = [1], rest = [2, 3, 4]", "It raises ValueError", "a = 4, rest = [1, 2, 3]"],
        answer: 0, why: "The starred target collects all remaining items into a list." },
      { q: "Why is any(x > 5 for x in xs) better than a manual loop?",
        options: ["It short-circuits on the first match and reads as pure intent", "It is always measurably faster", "for loops are deprecated", "It only saves indentation"],
        answer: 0, why: "any() stops early and the generator expresses the condition directly." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'data = [("a", 1), ("b", 2), ("c", 3)]\nletters, nums = zip(*data)\nprint(letters)\nprint(sum(nums))',
      options: ["('a', 'b', 'c')\n6", "('a', 1)\n6", "abc\n6", "Error"], answer: 0,
      hint: "zip(*data) unzips: first elements together, second elements together." }
  },
{
    "id": "a31", "section": "object-castle",
    "track": "advanced",
    "title": "OOP: Composition over Inheritance",
    "explain": "Composition means a class owns other objects and delegates work to them, instead of inheriting behaviour it may not need. A Car has an Engine, it is not an Engine, so you can swap the engine without rewriting the car.",
    "takeaways": [
      "Prefer has-a (composition) over is-a (inheritance) when the parts can vary independently.",
      "Pass collaborators in through __init__ so they can be swapped or faked in tests.",
      "Composition avoids fragile base classes and the diamond problems of deep inheritance trees."
    ],
    "code": "class Engine:\n    def start(self):\n        return \"vroom\"\n\nclass Car:\n    def __init__(self, engine):\n        self.engine = engine\n    def start(self):\n        return self.engine.start()\n\nprint(Car(Engine()).start())",
    "quiz": [
      {
        "q": "In composition, how does a Car relate to its Engine?",
        "options": [
          "The Car owns an Engine object and delegates to it",
          "The Engine inherits from Car",
          "They share one class definition",
          "The Car inherits from Engine"
        ],
        "answer": 0,
        "why": "Composition is a has-a relationship: the Car holds an Engine and calls its methods."
      },
      {
        "q": "Why is composition often easier to change than inheritance?",
        "options": [
          "It makes private attributes public",
          "You can swap a part at runtime without touching the class hierarchy",
          "It runs faster than any other pattern",
          "It removes the need for __init__"
        ],
        "answer": 1,
        "why": "A composed part is just an attribute, so a different engine can be passed in with no subclassing."
      },
      {
        "q": "Which design is composition?",
        "options": [
          "Engine = Car",
          "class Car(Engine): ...",
          "class Car: def __init__(self, engine): self.engine = engine",
          "class Engine(Car): ..."
        ],
        "answer": 2,
        "why": "Storing the engine as an attribute is the has-a pattern; inheriting would be is-a."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "class Battery:\n    def power(self):\n        return 100\n\nclass Scooter:\n    def __init__(self, battery):\n        self.battery = battery\n    def charge(self):\n        return self.battery.power() // 2\n\nprint(Scooter(Battery()).charge())",
      "options": [
        "Error",
        "100",
        "50",
        "0"
      ],
      "answer": 2,
      "hint": "The scooter delegates to the battery, then halves the result."
    }
  },
  {
    "id": "a32", "section": "object-castle",
    "track": "advanced",
    "title": "OOP: Abstract Base Classes",
    "explain": "An abstract base class (ABC) declares methods that subclasses must implement, using @abstractmethod. You cannot instantiate the ABC itself, so it acts as a contract that every shape, plugin, or handler has to honour.",
    "takeaways": [
      "Inherit from abc.ABC and mark required methods with @abstractmethod.",
      "Instantiating a class with unimplemented abstract methods raises TypeError.",
      "ABCs document the interface a family of classes must provide."
    ],
    "code": "from abc import ABC, abstractmethod\nimport math\n\nclass Shape(ABC):\n    @abstractmethod\n    def area(self):\n        pass\n\nclass Circle(Shape):\n    def __init__(self, r):\n        self.r = r\n    def area(self):\n        return round(math.pi * self.r ** 2, 2)\n\nprint(Circle(3).area())",
    "quiz": [
      {
        "q": "What happens if you try Shape() when Shape has an abstract method?",
        "options": [
          "It creates a shape with area() returning None",
          "TypeError: you cannot instantiate an abstract class",
          "It returns the first subclass instead",
          "It silently skips the abstract method"
        ],
        "answer": 1,
        "why": "Python refuses to instantiate a class while any abstract method is unimplemented."
      },
      {
        "q": "What does @abstractmethod do?",
        "options": [
          "Hides the method from subclasses",
          "Turns the method into a static method",
          "Marks a method that subclasses must override",
          "Makes the method run faster"
        ],
        "answer": 2,
        "why": "It flags the method as part of the contract; subclasses must provide their own version."
      },
      {
        "q": "Which import gives you ABC and abstractmethod?",
        "options": [
          "from oop import ABC, abstractmethod",
          "import abstract",
          "from typing import ABC",
          "from abc import ABC, abstractmethod"
        ],
        "answer": 3,
        "why": "Both live in the standard library abc module."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "from abc import ABC, abstractmethod\n\nclass Animal(ABC):\n    @abstractmethod\n    def speak(self):\n        pass\n\nclass Dog(Animal):\n    def speak(self):\n        return \"woof\"\n\nprint(Dog().speak())",
      "options": [
        "None",
        "Error",
        "Animal",
        "woof"
      ],
      "answer": 3,
      "hint": "Dog implements the one abstract method, so it can be instantiated."
    }
  },
  {
    "id": "a33", "section": "object-castle",
    "track": "advanced",
    "title": "OOP: Mixins & Multiple Inheritance",
    "explain": "A mixin is a small class that adds one focused ability, like logging or JSON output, and is meant to be combined with other classes through multiple inheritance. Python resolves method calls with the MRO, the method resolution order, which you can inspect with ClassName.__mro__.",
    "takeaways": [
      "Mixins add one capability each; keep them small and independent.",
      "In class User(LoggerMixin, JsonMixin), methods are looked up left to right via the MRO.",
      "Use super() in mixins so the whole chain cooperates instead of one class winning silently."
    ],
    "code": "class LoggerMixin:\n    def log(self, msg):\n        return \"LOG: \" + msg\n\nclass JsonMixin:\n    def to_json(self):\n        return \"{\\\"name\\\": \\\"\" + self.name + \"\\\"}\"\n\nclass User(LoggerMixin, JsonMixin):\n    def __init__(self, name):\n        self.name = name\n\nu = User(\"Ava\")\nprint(u.log(\"hi\"), u.to_json())",
    "quiz": [
      {
        "q": "What is a mixin?",
        "options": [
          "A built-in type for mixing numbers and strings",
          "A decorator that mixes two functions",
          "A small class that adds one focused capability to be combined with others",
          "A class that can never be instantiated"
        ],
        "answer": 2,
        "why": "Mixins are designed to be inherited alongside a main class, contributing one feature each."
      },
      {
        "q": "For class User(LoggerMixin, JsonMixin), where does Python look for a method first?",
        "options": [
          "JsonMixin first, then LoggerMixin",
          "object first",
          "Alphabetical order",
          "User, then LoggerMixin, then JsonMixin, then object"
        ],
        "answer": 3,
        "why": "The MRO follows the order of the base classes as listed, left to right."
      },
      {
        "q": "How do you inspect the method resolution order of a class?",
        "options": [
          "User.__mro__",
          "User.mro_file()",
          "dir(User, sort=True)",
          "User.parents()"
        ],
        "answer": 0,
        "why": "__mro__ is the tuple of classes Python searches, in order."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "class A:\n    def who(self):\n        return \"A\"\n\nclass B:\n    def who(self):\n        return \"B\"\n\nclass C(A, B):\n    pass\n\nprint(C().who())",
      "options": [
        "A",
        "B",
        "AB",
        "Error"
      ],
      "answer": 0,
      "hint": "The MRO searches bases left to right, so A wins."
    }
  },
  {
    "id": "a34", "section": "object-castle",
    "track": "advanced",
    "title": "OOP: __slots__ & Memory",
    "explain": "Normal instances store attributes in a per-instance __dict__, which costs memory. Declaring __slots__ = ('x', 'y') tells Python to store exactly those attributes in a compact fixed layout instead, which matters when you create millions of small objects.",
    "takeaways": [
      "__slots__ replaces the per-instance __dict__ with a fixed, compact layout.",
      "Instances with __slots__ use noticeably less memory in large collections.",
      "Assigning an attribute not listed in __slots__ raises AttributeError."
    ],
    "code": "class Point:\n    __slots__ = (\"x\", \"y\")\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n\np = Point(3, 4)\nprint(p.x, p.y, hasattr(p, \"__dict__\"))",
    "quiz": [
      {
        "q": "What does __slots__ = (\"x\", \"y\") do?",
        "options": [
          "It makes x and y read-only",
          "It deletes the class after use",
          "It converts x and y to class attributes",
          "It fixes the allowed attributes to x and y and drops the instance __dict__"
        ],
        "answer": 3,
        "why": "Slots allocate fixed storage for exactly those names instead of a dict."
      },
      {
        "q": "When is __slots__ most worth using?",
        "options": [
          "When you create huge numbers of small objects",
          "When a class has only one instance",
          "When you need dynamic attributes",
          "When you use @property everywhere"
        ],
        "answer": 0,
        "why": "The memory saving per instance only adds up at scale."
      },
      {
        "q": "What happens with p.z = 1 on a slotted class that only lists x and y?",
        "options": [
          "It returns None",
          "AttributeError",
          "It silently creates z",
          "It overwrites x"
        ],
        "answer": 1,
        "why": "With no __dict__, there is nowhere to store an undeclared attribute."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "class Coin:\n    __slots__ = (\"value\",)\n    def __init__(self, v):\n        self.value = v\n\nc = Coin(5)\nprint(c.value, hasattr(c, \"__dict__\"))",
      "options": [
        "Error",
        "5 False",
        "5 True",
        "5 None"
      ],
      "answer": 1,
      "hint": "Slotted instances have no __dict__, so hasattr returns False."
    }
  },
  {
    "id": "a35", "section": "object-castle",
    "track": "advanced",
    "title": "OOP: Properties in Depth",
    "explain": "A @property getter computes a value on read, while its setter validates or converts on write, so the attribute looks plain from the outside but is guarded inside. You can also add a deleter, and a read-only property is simply one with no setter at all.",
    "takeaways": [
      "@property turns a method into an attribute read; the setter runs on assignment.",
      "Validate in the setter and raise ValueError for bad input.",
      "A property with no setter is read-only: assigning to it raises AttributeError."
    ],
    "code": "class Temperature:\n    def __init__(self, celsius):\n        self._c = celsius\n    @property\n    def fahrenheit(self):\n        return self._c * 9 / 5 + 32\n    @fahrenheit.setter\n    def fahrenheit(self, value):\n        self._c = (value - 32) * 5 / 9\n\nt = Temperature(0)\nprint(t.fahrenheit)\nt.fahrenheit = 212\nprint(t._c)",
    "quiz": [
      {
        "q": "When does a property setter run?",
        "options": [
          "When you assign to the property, as in t.fahrenheit = 212",
          "When you read the property",
          "When the object is created",
          "Never: setters are documentation only"
        ],
        "answer": 0,
        "why": "Assignment triggers the setter; reading triggers the getter."
      },
      {
        "q": "How do you make a read-only property?",
        "options": [
          "Delete __init__",
          "Define the getter with @property and no setter",
          "Name it with a leading underscore",
          "Use @staticmethod instead"
        ],
        "answer": 1,
        "why": "Without a setter, assignment has no handler and raises AttributeError."
      },
      {
        "q": "Why store the real value in self._c instead of self.celsius?",
        "options": [
          "Python forbids the same name",
          "It saves memory",
          "Assigning self.celsius inside the setter would call the setter again forever",
          "Underscore attributes are faster"
        ],
        "answer": 2,
        "why": "The property and the storage must have different names or the setter recurses."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "class Score:\n    def __init__(self):\n        self._v = 0\n    @property\n    def value(self):\n        return self._v\n    @value.setter\n    def value(self, v):\n        if v < 0:\n            raise ValueError(\"no negatives\")\n        self._v = v\n\ns = Score()\ns.value = 7\nprint(s.value)",
      "options": [
        "None",
        "Error",
        "7",
        "0"
      ],
      "answer": 2,
      "hint": "7 passes the setter check, so it is stored and the getter returns it."
    }
  },
  {
    "id": "a36", "section": "object-castle",
    "track": "advanced",
    "title": "Descriptors in Practice",
    "explain": "A descriptor is a reusable attribute manager: define __get__, __set__, and __set_name__ once, then reuse it across many classes to validate values in one place. This is how ORMs and form libraries enforce rules like ranges or types without repeating the check in every setter.",
    "takeaways": [
      "A descriptor class with __get__/__set__ can be reused as a class attribute in many classes.",
      "__set_name__ records the attribute name so one descriptor class can serve several fields.",
      "Data descriptors (with __set__) take priority over the instance __dict__."
    ],
    "code": "class Clamped:\n    def __init__(self, low, high):\n        self.low = low\n        self.high = high\n    def __set_name__(self, owner, name):\n        self.name = name\n    def __get__(self, obj, objtype=None):\n        return obj.__dict__[self.name]\n    def __set__(self, obj, value):\n        obj.__dict__[self.name] = max(self.low, min(self.high, value))\n\nclass Player:\n    health = Clamped(0, 100)\n    def __init__(self, health):\n        self.health = health\n\nprint(Player(150).health, Player(-5).health)",
    "quiz": [
      {
        "q": "What does __set_name__ give a descriptor?",
        "options": [
          "The class docstring",
          "The attribute name it was assigned to, so it can store per-field values",
          "The name of the file it lives in",
          "A random identifier"
        ],
        "answer": 1,
        "why": "Python calls __set_name__ at class creation with the attribute name, letting one descriptor class serve many fields."
      },
      {
        "q": "In the example, why does Player(150).health print 100?",
        "options": [
          "health is capped by the class definition",
          "Python rounds all numbers to 100",
          "__set__ clamps the value into the 0-100 range",
          "The constructor ignores the argument"
        ],
        "answer": 2,
        "why": "The descriptor's __set__ applies max(low, min(high, value)) on every assignment."
      },
      {
        "q": "Where should the descriptor store the value?",
        "options": [
          "As a global variable",
          "On the descriptor class itself",
          "In a file",
          "In the instance __dict__ under its own name"
        ],
        "answer": 3,
        "why": "Storing per-instance in obj.__dict__ keeps each instance's value separate; storing it on the descriptor would share it."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "class Doubled:\n    def __set_name__(self, owner, name):\n        self.name = name\n    def __get__(self, obj, objtype=None):\n        return obj.__dict__[self.name] * 2\n    def __set__(self, obj, value):\n        obj.__dict__[self.name] = value\n\nclass Box:\n    size = Doubled()\n    def __init__(self, size):\n        self.size = size\n\nprint(Box(21).size)",
      "options": [
        "21",
        "84",
        "Error",
        "42"
      ],
      "answer": 3,
      "hint": "The getter doubles whatever was stored."
    }
  },
  {
    "id": "a37", "section": "object-castle",
    "track": "advanced",
    "title": "Metaclasses in Practice",
    "explain": "A metaclass is the class of a class: its __new__ runs when the class statement executes, so it can register, validate, or modify every class it creates. Real uses include plugin registries, ORM models, and enforcing naming rules across a codebase.",
    "takeaways": [
      "A metaclass inherits from type and its __new__ runs at class-definition time.",
      "Use metaclasses to register subclasses automatically, e.g. a plugin registry.",
      "Reach for a metaclass only when a class decorator or __init_subclass__ cannot do the job."
    ],
    "code": "class Registry(type):\n    plugins = {}\n    def __new__(mcs, name, bases, ns):\n        cls = super().__new__(mcs, name, bases, ns)\n        if name != \"Base\":\n            Registry.plugins[name] = cls\n        return cls\n\nclass Base(metaclass=Registry):\n    pass\n\nclass EmailPlugin(Base):\n    pass\n\nclass SmsPlugin(Base):\n    pass\n\nprint(sorted(Registry.plugins))",
    "quiz": [
      {
        "q": "When does a metaclass __new__ run?",
        "options": [
          "When you call a method",
          "Only on import of the metaclass module",
          "When the class statement executes",
          "Each time you create an instance"
        ],
        "answer": 2,
        "why": "Metaclasses customize class creation, which happens once at definition time."
      },
      {
        "q": "In the example, why is Base itself not in the registry?",
        "options": [
          "Base has no methods",
          "The registry only holds instances",
          "Base is abstract",
          "The metaclass skips it by name so only real plugins register"
        ],
        "answer": 3,
        "why": "The name check keeps the base class out and lets every subclass register itself."
      },
      {
        "q": "What should you prefer over a metaclass when it can do the job?",
        "options": [
          "A class decorator or __init_subclass__",
          "A second metaclass",
          "Global variables",
          "eval()"
        ],
        "answer": 0,
        "why": "Metaclasses are the heaviest tool here; simpler hooks are easier to read and debug."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "class Track(type):\n    names = []\n    def __new__(mcs, name, bases, ns):\n        cls = super().__new__(mcs, name, bases, ns)\n        Track.names.append(name)\n        return cls\n\nclass One(metaclass=Track):\n    pass\n\nclass Two(metaclass=Track):\n    pass\n\nprint(Track.names)",
      "options": [
        "['One', 'Two']",
        "[\"Two\", \"One\"]",
        "[]",
        "Error"
      ],
      "answer": 0,
      "hint": "Each class statement runs the metaclass once, in definition order."
    }
  },
  {
    "id": "a38", "section": "power-lab",
    "track": "advanced",
    "title": "Decorators: Building a Timer & Cache",
    "explain": "A timer decorator wraps a function, records the start time, calls it, and reports how long it took. Pair that idea with functools.lru_cache and you get the two most common real-world decorators: measure it, then memoize it.",
    "takeaways": [
      "A timer decorator uses time.perf_counter() before and after the wrapped call.",
      "Always use @functools.wraps(fn) so the wrapper keeps the original name and docstring.",
      "@lru_cache(maxsize=None) memoizes pure functions: repeated calls with the same arguments return instantly."
    ],
    "code": "import time\nimport functools\n\ndef timer(fn):\n    @functools.wraps(fn)\n    def wrapper(*a, **k):\n        t0 = time.perf_counter()\n        result = fn(*a, **k)\n        print(fn.__name__, \"took\", round(time.perf_counter() - t0, 6), \"s\")\n        return result\n    return wrapper\n\n@timer\ndef slow_sum(n):\n    return sum(range(n))\n\n@functools.lru_cache(maxsize=None)\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(slow_sum(100000))\nprint(fib(10))",
    "quiz": [
      {
        "q": "Why use time.perf_counter() in a timer instead of time.time()?",
        "options": [
          "It returns the date",
          "It pauses the function",
          "It only works inside decorators",
          "It is a monotonic high-resolution clock made for measuring durations"
        ],
        "answer": 3,
        "why": "perf_counter is designed for benchmarking: it never jumps backwards when the system clock changes."
      },
      {
        "q": "What does @lru_cache do on the second call fib(10)?",
        "options": [
          "Returns the cached result without re-running the body",
          "Recomputes it from scratch",
          "Raises an error",
          "Returns None"
        ],
        "answer": 0,
        "why": "The cache is keyed by arguments, so a repeat call is a hit, not a recomputation."
      },
      {
        "q": "Why does the timer decorator apply @functools.wraps(fn) to the wrapper?",
        "options": [
          "To hide the wrapper from debuggers",
          "To preserve the original function name and docstring",
          "To make the function faster",
          "To enable caching"
        ],
        "answer": 1,
        "why": "Without wraps, introspection sees the wrapper, not the real function."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "from functools import lru_cache\n\ncalls = []\n\n@lru_cache(maxsize=None)\ndef double(x):\n    calls.append(x)\n    return x * 2\n\ndouble(3)\ndouble(3)\ndouble(4)\nprint(len(calls), double(3))",
      "options": [
        "3 8",
        "2 6",
        "3 6",
        "2 3"
      ],
      "answer": 1,
      "hint": "The second double(3) is a cache hit, so the body runs only for 3 and 4."
    }
  },
  {
    "id": "a39", "section": "power-lab",
    "track": "advanced",
    "title": "Decorators: Retry & Rate Limiting",
    "explain": "A retry decorator re-runs a flaky function a few times before giving up, which is how you survive a brief network hiccup. A rate-limit decorator does the opposite job: it slows calls down so you never exceed an API quota.",
    "takeaways": [
      "Retry only transient errors, and give up after a small number of attempts.",
      "Add a short sleep between attempts so a struggling service can recover.",
      "Rate limiting tracks the time of the last call and sleeps until the next one is allowed."
    ],
    "code": "import functools\nimport time\n\ndef retry(times):\n    def decorator(fn):\n        @functools.wraps(fn)\n        def wrapper(*a, **k):\n            for attempt in range(times):\n                try:\n                    return fn(*a, **k)\n                except ValueError:\n                    if attempt == times - 1:\n                        raise\n                    time.sleep(0.01)\n        return wrapper\n    return decorator\n\ntries = [0]\n\n@retry(3)\ndef fetch():\n    tries[0] += 1\n    if tries[0] < 3:\n        raise ValueError(\"flaky\")\n    return 42\n\nprint(fetch(), tries[0])",
    "quiz": [
      {
        "q": "In the example, why does fetch() succeed on the third call?",
        "options": [
          "The retry decorator re-runs it until it stops raising ValueError",
          "The exception is ignored silently",
          "Python retries automatically",
          "The function is cached"
        ],
        "answer": 0,
        "why": "retry(3) allows three attempts; the first two raise, the third returns 42."
      },
      {
        "q": "What should a retry decorator do after the final failed attempt?",
        "options": [
          "Restart the program",
          "Re-raise the exception so the caller knows it failed",
          "Return None silently",
          "Retry forever"
        ],
        "answer": 1,
        "why": "Swallowing the error would hide a real failure; the caller needs to know."
      },
      {
        "q": "Why put a sleep between retry attempts?",
        "options": [
          "Sleep is required by Python",
          "To reset the cache",
          "To give the failing service a moment to recover",
          "To make the code slower on purpose"
        ],
        "answer": 2,
        "why": "Hammering a struggling service instantly usually just fails again; a pause helps."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "def retry(times):\n    def decorator(fn):\n        def wrapper(*a, **k):\n            for attempt in range(times):\n                try:\n                    return fn(*a, **k)\n                except ValueError:\n                    if attempt == times - 1:\n                        raise\n        return wrapper\n    return decorator\n\ncount = [0]\n\n@retry(2)\ndef flaky():\n    count[0] += 1\n    raise ValueError(\"nope\")\n\ntry:\n    flaky()\nexcept ValueError:\n    print(\"gave up after\", count[0])",
      "options": [
        "gave up after 3",
        "Error",
        "gave up after 2",
        "gave up after 1"
      ],
      "answer": 2,
      "hint": "retry(2) allows two attempts, then the exception escapes."
    }
  },
  {
    "id": "a40", "section": "power-lab",
    "track": "advanced",
    "title": "Context Managers: @contextmanager",
    "explain": "The @contextmanager decorator from contextlib turns a generator function into a context manager: code before yield is the setup, the yielded value is bound by as, and code after yield is the cleanup, which runs even if the block raises.",
    "takeaways": [
      "@contextmanager turns a generator into a with-ready object.",
      "Code before yield sets up; code after yield cleans up, like __exit__.",
      "Wrap the yield in try/finally so cleanup runs even when the block raises."
    ],
    "code": "from contextlib import contextmanager\n\n@contextmanager\ndef timer():\n    print(\"start\")\n    yield \"go\"\n    print(\"stop\")\n\nwith timer() as signal:\n    print(signal)",
    "quiz": [
      {
        "q": "In a @contextmanager generator, what does the yield do?",
        "options": [
          "It deletes the context manager",
          "It hands the value to the as-target and pauses until the block ends",
          "It returns from the function permanently",
          "It starts a new thread"
        ],
        "answer": 1,
        "why": "The generator pauses at yield; when the with block exits it resumes after yield for cleanup."
      },
      {
        "q": "Why wrap the yield in try/finally?",
        "options": [
          "To catch syntax errors",
          "It is required for every generator",
          "So cleanup runs even if the with block raises an exception",
          "To make the code run faster"
        ],
        "answer": 2,
        "why": "An exception in the block is thrown into the generator at the yield; finally guarantees cleanup."
      },
      {
        "q": "What does @contextmanager save you from writing?",
        "options": [
          "An import statement",
          "A decorator",
          "A test file",
          "A full class with __enter__ and __exit__"
        ],
        "answer": 3,
        "why": "The decorator builds the context manager protocol from a single generator function."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "from contextlib import contextmanager\n\n@contextmanager\ndef tag():\n    print(\"in\")\n    yield 5\n    print(\"out\")\n\nwith tag() as value:\n    print(value)",
      "options": [
        "5\nin\nout",
        "in\nout\n5",
        "Error",
        "in\n5\nout"
      ],
      "answer": 3,
      "hint": "Setup prints first, then the block body, then the cleanup after yield."
    }
  },
  {
    "id": "a41", "section": "power-lab",
    "track": "advanced",
    "title": "Asyncio: Tasks & Gathering Results",
    "explain": "asyncio.create_task() schedules a coroutine to run in the background while your code carries on, and await asyncio.gather() collects the results of several tasks at once. The results always come back in the order you passed the tasks, not the order they finished.",
    "takeaways": [
      "asyncio.create_task(coro) schedules a coroutine to run concurrently.",
      "await asyncio.gather(*tasks) waits for all of them and returns results in argument order.",
      "Cancel a task with task.cancel() when you no longer need its result."
    ],
    "code": "import asyncio\n\nasync def work(name):\n    await asyncio.sleep(0)\n    return name + \" done\"\n\nasync def main():\n    tasks = [asyncio.create_task(work(n)) for n in (\"a\", \"b\", \"c\")]\n    print(await asyncio.gather(*tasks))\n\nasyncio.run(main())",
    "quiz": [
      {
        "q": "What does asyncio.create_task() do?",
        "options": [
          "Starts a new operating-system thread",
          "Converts a coroutine into a normal function",
          "Schedules a coroutine to run concurrently on the event loop",
          "Runs the coroutine immediately and blocks"
        ],
        "answer": 2,
        "why": "It wraps the coroutine in a Task and schedules it; the loop runs it when it can."
      },
      {
        "q": "await asyncio.gather(t1, t2) returns results in which order?",
        "options": [
          "The order they finished",
          "Random order",
          "Reverse order",
          "The order the tasks were passed in"
        ],
        "answer": 3,
        "why": "gather preserves argument order in its result list regardless of completion order."
      },
      {
        "q": "What happens if one task passed to gather raises?",
        "options": [
          "gather raises that exception (and by default the other tasks keep running)",
          "It returns None for that task",
          "It silently retries the task",
          "The event loop crashes permanently"
        ],
        "answer": 0,
        "why": "By default gather propagates the first exception; pass return_exceptions=True to collect errors as results instead."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "import asyncio\n\nasync def square(n):\n    await asyncio.sleep(0)\n    return n * n\n\nasync def main():\n    print(await asyncio.gather(square(2), square(3), square(4)))\n\nasyncio.run(main())",
      "options": [
        "[4, 9, 16]",
        "[16, 9, 4]",
        "(4, 9, 16)",
        "Error"
      ],
      "answer": 0,
      "hint": "gather returns a list in the order the coroutines were passed."
    }
  },
  {
    "id": "a42", "section": "power-lab",
    "track": "advanced",
    "title": "Asyncio: Async File & Network IO",
    "explain": "Async code shines when waiting on files or the network, but you still need the right tool for each: use asyncio.to_thread for blocking file reads, and an async HTTP client for real requests. Here the network reply is sample data, exactly what an API would hand you, so nothing touches the real network.",
    "takeaways": [
      "asyncio.to_thread() runs blocking calls like open() without freezing the event loop.",
      "Never call requests.get inside a coroutine: it blocks the whole loop.",
      "Parse the response with json.loads whether it came from a real API or sample data."
    ],
    "code": "import asyncio\nimport json\n\nsample = \"{\\\"name\\\": \\\"Ava\\\", \\\"score\\\": 92}\"\n\nasync def fetch_user():\n    await asyncio.sleep(0)\n    return json.loads(sample)\n\ndef _read(path):\n    with open(path) as f:\n        return f.read()\n\nasync def main():\n    with open(\"notes.txt\", \"w\") as f:\n        f.write(\"hello async\")\n    user = await fetch_user()\n    text = await asyncio.to_thread(_read, \"notes.txt\")\n    print(user[\"name\"], user[\"score\"], text)\n\nasyncio.run(main())",
    "quiz": [
      {
        "q": "Why use asyncio.to_thread() for reading a file inside a coroutine?",
        "options": [
          "Files cannot be opened in async code at all",
          "It makes the file larger",
          "It encrypts the file",
          "open() blocks, and to_thread runs it off the event loop so other tasks keep moving"
        ],
        "answer": 3,
        "why": "A blocking call inside a coroutine would freeze the whole loop; to_thread moves it to a worker thread."
      },
      {
        "q": "Why does this lesson parse sample JSON instead of calling a real API?",
        "options": [
          "So the code runs offline and deterministically, exactly as a real response would look",
          "Real APIs never return JSON",
          "json.loads only works on sample data",
          "Asyncio forbids network access"
        ],
        "answer": 0,
        "why": "The sample string is shaped like a real API response, so the parsing code is identical but needs no network."
      },
      {
        "q": "What would a blocking requests.get() do inside a coroutine?",
        "options": [
          "Speed up the other tasks",
          "Freeze the entire event loop until the response arrives",
          "Run in parallel automatically",
          "Raise a syntax error"
        ],
        "answer": 1,
        "why": "The loop is single-threaded: a blocking call stalls every task, not just the current one."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "import asyncio\nimport json\n\nasync def fake_get():\n    await asyncio.sleep(0)\n    return json.loads(\"{\\\"city\\\": \\\"Pune\\\", \\\"temp\\\": 28}\")\n\nasync def main():\n    data = await fake_get()\n    print(data[\"city\"], data[\"temp\"])\n\nasyncio.run(main())",
      "options": [
        "Error",
        "Pune 28",
        "Pune 0",
        "28 Pune"
      ],
      "answer": 1,
      "hint": "fake_get returns the parsed sample dict; the prints just read its keys."
    }
  },
  {
    "id": "a43", "section": "power-lab",
    "track": "advanced",
    "title": "Threading: Locks & Race Conditions",
    "explain": "A race condition happens when two threads read and write the same value at the same time, so updates get lost. A threading.Lock makes the read-modify-write step atomic: only the thread holding the lock can be inside that block, so no update is ever lost.",
    "takeaways": [
      "A race condition is lost or corrupted updates from unsynchronised shared access.",
      "Wrap the critical section in with lock: so only one thread runs it at a time.",
      "Keep the locked section as small as possible so threads are not waiting on each other."
    ],
    "code": "import threading\n\ncounter = [0]\nlock = threading.Lock()\n\ndef inc():\n    for _ in range(1000):\n        with lock:\n            counter[0] += 1\n\nthreads = [threading.Thread(target=inc) for _ in range(4)]\nfor t in threads:\n    t.start()\nfor t in threads:\n    t.join()\nprint(counter[0])",
    "quiz": [
      {
        "q": "Why does the example print exactly 4000 every time?",
        "options": [
          "The lock makes each increment atomic, so no update is lost",
          "Threads always run in order",
          "Python integers are thread-safe by themselves",
          "join() re-runs any lost increments"
        ],
        "answer": 0,
        "why": "With the lock, the read-add-write of counter[0] cannot be interleaved with another thread."
      },
      {
        "q": "What is a race condition?",
        "options": [
          "A lock that never unlocks",
          "Two threads interleaving access to shared data so the result depends on timing",
          "Two threads racing to finish first",
          "A thread that runs too fast"
        ],
        "answer": 1,
        "why": "The outcome depends on the unpredictable interleaving of the threads."
      },
      {
        "q": "What happens if a thread forgets to release a lock it acquired?",
        "options": [
          "The program runs faster",
          "Python raises an error immediately",
          "Other threads block forever waiting for it (deadlock)",
          "The lock releases itself after one second"
        ],
        "answer": 2,
        "why": "A lock stays held until released, so a missing release stalls every waiter; use with lock: to avoid it."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "import threading\n\ntotal = [0]\nlock = threading.Lock()\n\ndef add(n):\n    with lock:\n        total[0] += n\n\nts = [threading.Thread(target=add, args=(5,)) for _ in range(3)]\nfor t in ts:\n    t.start()\nfor t in ts:\n    t.join()\nprint(total[0])",
      "options": [
        "0",
        "Error",
        "15",
        "5"
      ],
      "answer": 2,
      "hint": "Three threads each add 5 under the lock, and join waits for all of them."
    }
  },
  {
    "id": "a44", "section": "power-lab",
    "track": "advanced",
    "title": "Multiprocessing: Pools & Queues",
    "explain": "A multiprocessing Pool spreads CPU-heavy work across processes, each with its own interpreter, so the GIL cannot slow you down. A Queue is how those separate processes send results back: a worker puts values in, and the main process gets them out.",
    "takeaways": [
      "Pool.map(fn, items) runs fn on each item across worker processes and keeps input order.",
      "Processes do not share memory: results travel back through a Queue (pickled).",
      "Always close or context-manage the pool and join() processes so nothing is left running."
    ],
    "code": "import multiprocessing\n\ndef square(n):\n    return n * n\n\ndef put(q, v):\n    q.put(v * v)\n\nif __name__ == \"__main__\":\n    with multiprocessing.Pool(2) as pool:\n        print(pool.map(square, [1, 2, 3]))\n    q = multiprocessing.Queue()\n    ps = [multiprocessing.Process(target=put, args=(q, i)) for i in (4, 5)]\n    for p in ps:\n        p.start()\n    print(sorted(q.get() for _ in ps))\n    for p in ps:\n        p.join()",
    "quiz": [
      {
        "q": "Why use a Pool instead of threads for squaring a million numbers?",
        "options": [
          "Pools share memory automatically",
          "Processes sidestep the GIL, so CPU work truly runs in parallel",
          "Pools use less memory",
          "Threads cannot call functions"
        ],
        "answer": 1,
        "why": "Each process has its own interpreter and GIL, so CPU-bound work scales across cores."
      },
      {
        "q": "How does a child process send a result back to the parent?",
        "options": [
          "By returning from the target function",
          "Through threading.Lock",
          "Through a Queue (or the Pool return value); processes do not share memory",
          "By writing to a shared global variable"
        ],
        "answer": 2,
        "why": "Memory is isolated per process, so results must be pickled through a Queue or collected by the Pool."
      },
      {
        "q": "Why guard the pool code with if __name__ == __main__?",
        "options": [
          "It makes the pool faster",
          "It is required for every Python file",
          "It disables the GIL",
          "So child processes re-importing the module do not spawn more children"
        ],
        "answer": 3,
        "why": "On spawn-based platforms children re-import the module, which would re-run the pool creation."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "import multiprocessing\n\ndef double(n):\n    return n * 2\n\nif __name__ == \"__main__\":\n    with multiprocessing.Pool(2) as pool:\n        print(pool.map(double, [3, 4]))",
      "options": [
        "[3, 4]",
        "[8, 6]",
        "Error",
        "[6, 8]"
      ],
      "answer": 3,
      "hint": "Pool.map applies the function to each item and preserves input order."
    }
  },
  {
    "id": "a45", "section": "power-lab",
    "track": "advanced",
    "title": "Testing: pytest Fundamentals",
    "explain": "pytest finds functions whose names start with test_ and runs them, reporting any failed assert as a failure. You do not need a test class or special methods: a plain function and a plain assert are a complete test, and you can run the same functions directly to see them pass.",
    "takeaways": [
      "Name test functions test_something so pytest discovers them.",
      "Use plain assert statements: pytest shows exactly which values differed.",
      "Run tests with pytest in the terminal; each function here also runs directly as a demo."
    ],
    "code": "def add(a, b):\n    return a + b\n\ndef test_add():\n    assert add(2, 3) == 5\n\ndef test_add_zero():\n    assert add(0, 0) == 0\n\ndef test_add_negative():\n    assert add(-1, 1) == 0\n\nfor t in (test_add, test_add_zero, test_add_negative):\n    t()\nprint(\"3 passed\")",
    "quiz": [
      {
        "q": "How does pytest discover a test function?",
        "options": [
          "It returns True",
          "It has a docstring",
          "Its name starts with test_",
          "It is defined in a class"
        ],
        "answer": 2,
        "why": "pytest collects functions and files matching the test_ naming pattern."
      },
      {
        "q": "What does pytest do when an assert fails inside a test?",
        "options": [
          "Skips the test silently",
          "Deletes the test",
          "Stops Python from running",
          "Reports that test as FAILED and shows the values that differed"
        ],
        "answer": 3,
        "why": "A failed assert is the signal: pytest catches it and reports the mismatch."
      },
      {
        "q": "Why write several small tests instead of one big test?",
        "options": [
          "A failure points at exactly the broken behaviour instead of a vague block",
          "pytest only runs small tests",
          "Big tests run slower",
          "Small tests need no asserts"
        ],
        "answer": 0,
        "why": "One behaviour per test makes failures precise and the suite easier to read."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "def is_even(n):\n    return n % 2 == 0\n\ndef test_even():\n    assert is_even(4)\n\ndef test_odd():\n    assert not is_even(5)\n\nfor t in (test_even, test_odd):\n    t()\nprint(\"2 passed\")",
      "options": [
        "2 passed",
        "0 passed",
        "Error",
        "None"
      ],
      "answer": 0,
      "hint": "Both asserts hold, so both test functions return without raising."
    }
  },
  {
    "id": "a46", "section": "power-lab",
    "track": "advanced",
    "title": "Testing: Fixtures & Parametrize",
    "explain": "A fixture is a reusable setup helper that builds the fresh data each test needs, so tests never share state. Parametrize runs the same test once per input case, so one test function covers a whole table of examples instead of copy-pasting the same check.",
    "takeaways": [
      "A fixture builds fresh data per test; tests should never share mutable setup.",
      "In pytest, @pytest.fixture marks the setup function and tests receive it by name.",
      "@pytest.mark.parametrize runs one test over a list of (input, expected) cases."
    ],
    "code": "def make_scores():\n    return [80, 90, 100]\n\ndef average(scores):\n    return sum(scores) / len(scores)\n\ndef test_average(scores, expected):\n    assert average(scores) == expected\n\ncases = [([10, 20], 15), ([0, 0], 0), ([5], 5)]\nfor scores, expected in cases:\n    test_average(scores, expected)\nprint(\"3 cases passed\")",
    "quiz": [
      {
        "q": "What problem does a fixture solve?",
        "options": [
          "Tests run faster",
          "Tests need no asserts",
          "It replaces the code under test",
          "Every test gets fresh setup data instead of sharing mutable state"
        ],
        "answer": 3,
        "why": "Shared setup leaks state between tests; a fixture rebuilds it per test."
      },
      {
        "q": "What does @pytest.mark.parametrize do?",
        "options": [
          "Runs the same test once for each case in a list",
          "Runs the test in parallel",
          "Skips the test",
          "Generates random inputs"
        ],
        "answer": 0,
        "why": "Each parameter set becomes its own test run with its own pass or fail."
      },
      {
        "q": "In the example, how many times does test_average run?",
        "options": [
          "15 times",
          "3 times, once per case",
          "Once",
          "0 times: it is only a helper"
        ],
        "answer": 1,
        "why": "The loop feeds the three cases in one by one, mirroring parametrize."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "def double(x):\n    return x * 2\n\ncases = [(1, 2), (2, 4), (3, 6)]\nfor x, expected in cases:\n    assert double(x) == expected\nprint(len(cases), \"cases passed\")",
      "options": [
        "6 cases passed",
        "3 cases passed",
        "1 cases passed",
        "Error"
      ],
      "answer": 1,
      "hint": "All three cases hold, and len(cases) is 3."
    }
  },
  {
    "id": "a47", "section": "power-lab",
    "track": "advanced",
    "title": "Testing: Mocking External Services",
    "explain": "A mock is a fake object that stands in for a real service during a test, returning canned answers you control. You test your own logic, like how you handle a returned user, without ever calling the real API, database, or payment service.",
    "takeaways": [
      "Mock the boundary (API, database, network) and test your own logic against canned answers.",
      "unittest.mock.Mock lets you set return_value and check call_count afterwards.",
      "Pass the dependency in (dependency injection) so tests can swap in a mock."
    ],
    "code": "from unittest.mock import Mock\n\ndef greet(client, user_id):\n    user = client.get_user(user_id)\n    return \"hi \" + user[\"name\"]\n\nfake = Mock()\nfake.get_user.return_value = {\"name\": \"Ava\"}\nprint(greet(fake, 7))\nprint(fake.get_user.call_count)",
    "quiz": [
      {
        "q": "Why mock an external service in a test?",
        "options": [
          "So the test is fast, offline, and deterministic instead of depending on a live service",
          "Mocks make the real service faster",
          "Tests cannot call real code",
          "Mocking is required by Python"
        ],
        "answer": 0,
        "why": "A live service can be slow, flaky, or charge money; a mock returns exactly what you set."
      },
      {
        "q": "What does fake.get_user.return_value = {...} do?",
        "options": [
          "Raises an error",
          "Makes every call to fake.get_user() return that dict",
          "Calls the real API once",
          "Deletes the method"
        ],
        "answer": 1,
        "why": "return_value is the canned answer the mock hands back on every call."
      },
      {
        "q": "How can you check the mock was actually used?",
        "options": [
          "Check the network log",
          "You cannot check it",
          "Inspect fake.get_user.call_count or assert_called_once_with(...)",
          "Print the mock object"
        ],
        "answer": 2,
        "why": "Mocks record every call, so you can assert your code called the service exactly as expected."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "from unittest.mock import Mock\n\ndef score_of(client, user_id):\n    return client.get_user(user_id)[\"score\"]\n\nfake = Mock()\nfake.get_user.return_value = {\"score\": 92}\nprint(score_of(fake, 1))\nprint(fake.get_user.call_count)",
      "options": [
        "None\n1",
        "Error",
        "92\n1",
        "92\n0"
      ],
      "answer": 2,
      "hint": "The mock returns the canned dict, and it was called exactly once."
    }
  },
  {
    "id": "a48", "section": "power-lab",
    "track": "advanced",
    "title": "Testing: Coverage & CI Basics",
    "explain": "Coverage measures which lines of your code your tests actually execute, so you can see the untested corners. Continuous integration runs the whole suite on every push, so a broken change is caught by the server instead of by your users.",
    "takeaways": [
      "Coverage reports the percentage of lines your tests execute; aim high on core logic, not 100% everywhere.",
      "Run pytest --cov=. to generate a coverage report.",
      "In CI, the pipeline installs dependencies, runs pytest, and fails the build on any failing test."
    ],
    "code": "def total(prices):\n    return sum(prices)\n\ndef test_empty():\n    assert total([]) == 0\n\ndef test_some():\n    assert total([10, 20]) == 30\n\ndef test_one():\n    assert total([5]) == 5\n\ntests = [test_empty, test_some, test_one]\npassed = 0\nfor t in tests:\n    t()\n    passed += 1\nprint(passed, \"/\", len(tests), \"tests passed\")",
    "quiz": [
      {
        "q": "What does code coverage measure?",
        "options": [
          "How large the codebase is",
          "Which lines of code your tests actually execute",
          "How fast the tests run",
          "How many tests you wrote"
        ],
        "answer": 1,
        "why": "Coverage instruments the code and reports the executed lines versus the missed ones."
      },
      {
        "q": "What does a CI pipeline do on every push?",
        "options": [
          "Deletes old branches",
          "Writes new tests for you",
          "Installs dependencies and runs the test suite, failing the build on any failure",
          "Deploys straight to production"
        ],
        "answer": 2,
        "why": "CI gives every change the same automated check before a human reviews it."
      },
      {
        "q": "Why is 100% coverage a weak goal on its own?",
        "options": [
          "It is impossible to reach",
          "Coverage tools are inaccurate",
          "It slows the tests down",
          "It measures lines executed, not whether the asserts actually check the right behaviour"
        ],
        "answer": 3,
        "why": "A test can execute a line without asserting anything useful about it."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "def double(x):\n    return x * 2\n\ntests = [lambda: double(2), lambda: double(3)]\npassed = 0\nfor t in tests:\n    assert t() == 4 or t() == 6\n    passed += 1\nprint(passed, \"/\", len(tests), \"tests passed\")",
      "options": [
        "1 / 2 tests passed",
        "0 / 2 tests passed",
        "Error",
        "2 / 2 tests passed"
      ],
      "answer": 3,
      "hint": "double(2) is 4, so the first assert passes at once; double(3) is 6, so the second assert passes via the or's second check (t() == 6)."
    }
  },
  {
    "id": "a49", "section": "data-lab",
    "track": "advanced",
    "title": "Data Science: NumPy Arrays",
    "explain": "A NumPy array is a grid of numbers of one type, stored compactly so whole-array maths runs in fast compiled code. You build one with np.array(), check its shape, and operations like a * 2 apply to every element at once with no Python loop.",
    "takeaways": [
      "np.array([1, 2, 3]) creates a 1-D array; .shape tells you its dimensions.",
      "Array operations are element-wise: a * 2 doubles every element at once.",
      "np.arange(6).reshape(2, 3) builds a 2-row, 3-column grid."
    ],
    "code": "import numpy as np\n\na = np.array([1, 2, 3])\nb = np.arange(6).reshape(2, 3)\nprint(a * 2)\nprint(b.shape)\nprint(np.zeros(3))",
    "quiz": [
      {
        "q": "What does np.arange(6).reshape(2, 3) create?",
        "options": [
          "A 6-row, 2-column array",
          "A single number 6",
          "A 2-row, 3-column array holding 0 to 5",
          "A list of 6 lists"
        ],
        "answer": 2,
        "why": "arange(6) makes 0-5 and reshape(2, 3) lays them out in 2 rows of 3."
      },
      {
        "q": "What does a * 2 do when a is a NumPy array?",
        "options": [
          "Repeats the array twice like a list",
          "Doubles only the first element",
          "Raises TypeError",
          "Doubles every element, returning a new array"
        ],
        "answer": 3,
        "why": "NumPy operators are vectorised: they apply element-wise across the whole array."
      },
      {
        "q": "What does b.shape return for a 2-row, 3-column array?",
        "options": [
          "(2, 3)",
          "(3, 2)",
          "6",
          "[2, 3]"
        ],
        "answer": 0,
        "why": "shape is a tuple of sizes, rows first, then columns."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "import numpy as np\n\na = np.array([[1, 2], [3, 4]])\nprint(a.shape)\nprint(a + 10)",
      "options": [
        "(2, 2)\n[[11 12]\n [13 14]]",
        "(2, 2)\n[[1 2]\n [3 4]]",
        "(4,)\n[[11 12]\n [13 14]]",
        "Error"
      ],
      "answer": 0,
      "hint": "The array is 2 by 2, and adding 10 shifts every element."
    }
  },
  {
    "id": "a50", "section": "data-lab",
    "track": "advanced",
    "title": "Data Science: NumPy Indexing & Broadcasting",
    "explain": "NumPy slicing picks rows and columns with m[:, 1], and boolean masks pick elements that pass a test, like a[a > 2]. Broadcasting stretches a smaller array to match a bigger one, so a column of shape (2, 1) can add to every column of a (2, 3) grid without a loop.",
    "takeaways": [
      "m[:, 1] selects a whole column; m[0, :] selects a whole row.",
      "Boolean masks like a[a > 2] return only the matching elements.",
      "Broadcasting aligns shapes from the right: (2, 1) plus (1, 3) gives (2, 3)."
    ],
    "code": "import numpy as np\n\na = np.array([1, 2, 3, 4])\nm = np.array([[1, 2, 3], [4, 5, 6]])\nprint(m[:, 1])\nprint(a[a > 2])\ncol = np.array([[10], [20]])\nprint(col + np.array([1, 2, 3]))",
    "quiz": [
      {
        "q": "What does m[:, 1] return for a 2-row, 3-column array m?",
        "options": [
          "The whole second row",
          "A single element",
          "The full array",
          "The whole second column as a 1-D array"
        ],
        "answer": 3,
        "why": "The colon means all rows; 1 picks column index 1."
      },
      {
        "q": "What does a[a > 2] return when a is [1, 2, 3, 4]?",
        "options": [
          "array([3, 4])",
          "array([1, 2])",
          "True",
          "array([False, False, True, True])"
        ],
        "answer": 0,
        "why": "The boolean mask selects only the elements where the condition is True."
      },
      {
        "q": "Broadcasting a (2, 1) array with a (1, 3) array gives what shape?",
        "options": [
          "It raises an error",
          "(2, 3)",
          "(2, 1)",
          "(1, 3)"
        ],
        "answer": 1,
        "why": "Dimensions of size 1 stretch to match, so rows and columns combine into (2, 3)."
      }
    ],
    "challenge": {
      "type": "predict",
      "prompt": "What will this print?",
      "code": "import numpy as np\n\na = np.array([5, 10, 15])\nprint(a[1:])\nprint(a + 100)",
      "options": [
        "Error",
        "[10 15]\n[105 110 115]",
        "[5 10]\n[105 110 115]",
        "[10 15]\n[5 10 15]"
      ],
      "answer": 1,
      "hint": "a[1:] drops the first element; adding 100 shifts every remaining one."
    }
  },
{
    id: "a51", section: "data-lab", track: "advanced", title: "Data Science: pandas Series & DataFrames",
    explain: "pandas is the go-to library for tabular data in Python. A Series is one labelled column of data, and a DataFrame is a table made of Series sharing one index — think of it as a spreadsheet you can program.",
    takeaways: ["A `Series` is a one-dimensional labelled array; a `DataFrame` is a two-dimensional table of rows and columns.", "Pick a column with `df['score']` and a single value with `df['score'].mean()` or label-based indexing.", "Check a table's size at a glance with `df.shape`, which returns `(rows, columns)`." ],
    code: 'import pandas as pd\nscores = pd.Series([88, 92, 79], index=["Ava", "Bo", "Al"])\nprint(scores["Bo"])\ndf = pd.DataFrame({"name": ["Ava", "Bo"], "score": [88, 92]})\nprint(df["score"].mean())\nprint(df.shape)',
    quiz: [
      { q: "What is a pandas DataFrame?",
        options: ["A Python list that only holds numbers", "A file saved on disk", "A two-dimensional table of rows and columns with labels", "A kind of Python loop"],
        answer: 2, why: "A DataFrame is a labelled table: rows and columns you can select, filter and summarise." },
      { q: "Which of these creates a Series with the labels a and b?",
        options: ["pd.Series([1, 2], labels=['a', 'b'])", "pd.Series([1, 2], index=['a', 'b'])", "pd.DataFrame([1, 2])", "pd.Series('a', 'b')"],
        answer: 1, why: "The index= argument sets the labels; there is no labels= argument." },
      { q: "What does df.shape return for a table with 2 rows and 3 columns?",
        options: ["(2, 3)", "(3, 2)", "5", "A list of column names"],
        answer: 0, why: "shape is always (rows, columns), so 2 rows and 3 columns gives (2, 3)." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import pandas as pd\ns = pd.Series([10, 20, 30], index=["a", "b", "c"])\nprint(s["b"] + s["c"])',
      options: ["50", "30", "20", "Error"], answer: 0,
      hint: "Labels pick values: s['b'] is 20 and s['c'] is 30." }
  },
  {
    id: "a52", section: "data-lab", track: "advanced", title: "Data Science: Cleaning Data with pandas",
    explain: "Real data is messy: missing values, duplicates, wrong types. pandas gives you a small toolkit for this — isna() to find the gaps, dropna() or fillna() to deal with them, and drop_duplicates() to remove repeats — before you trust any analysis.",
    takeaways: ["Find missing values with `df['col'].isna().sum()`; pandas represents them as `NaN`.", "Use `dropna()` to remove rows with gaps, or `fillna(value)` to replace the gaps.", "Remove repeated rows with `drop_duplicates()` and check the shape before and after."],
    code: 'import pandas as pd\ndf = pd.DataFrame({"name": ["Ava", "Bo", "Al"], "score": [88, None, 79]})\nprint(df["score"].isna().sum())\nclean = df.dropna()\nprint(clean.shape)\nprint(clean["score"].mean())',
    quiz: [
      { q: "What does df.dropna() do?",
        options: ["Removes rows that contain missing values", "Fills missing values with zero", "Deletes the whole DataFrame", "Sorts the rows"],
        answer: 0, why: "dropna drops any row (by default) that contains a NaN." },
      { q: "What does fillna(0) do?",
        options: ["Deletes all rows", "Replaces missing values with 0", "Converts the column to strings", "Counts the missing values"],
        answer: 1, why: "fillna replaces each NaN with the value you pass, here 0." },
      { q: "How do you count the missing values in one column?",
        options: ["df['score'].sum()", "df['score'].isna().sum()", "len(df)", "df['score'].count()"],
        answer: 1, why: "isna() marks gaps True and sum() counts them; count() counts the non-missing values instead." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import pandas as pd\ndf = pd.DataFrame({"x": [1, 1, 2, 2, 3]})\nprint(len(df.drop_duplicates()))',
      options: ["3", "5", "2", "Error"], answer: 0,
      hint: "drop_duplicates keeps one copy of each repeated row: 1, 2 and 3." }
  },
  {
    id: "a53", section: "data-lab", track: "advanced", title: "Data Science: GroupBy & Aggregation",
    explain: "groupby() splits your rows into groups by a column's values, then an aggregation like mean() or sum() collapses each group into one number. It is the pandas answer to 'average score per team?' and most summary questions.",
    takeaways: ["`df.groupby('team')` splits rows into groups sharing the same team value.", "Chain an aggregation after it: `df.groupby('team')['score'].mean()` gives one mean per group.", "Use `.agg(['mean', 'max'])` to compute several aggregations at once."],
    code: 'import pandas as pd\ndf = pd.DataFrame({"team": ["A", "A", "B", "B"], "score": [10, 20, 30, 40]})\nprint(df.groupby("team")["score"].mean().to_dict())\nprint(df.groupby("team")["score"].sum()["B"])',
    quiz: [
      { q: "What does df.groupby('team') do?",
        options: ["Sorts the DataFrame by team", "Splits rows into groups by their team value", "Deletes the team column", "Merges two DataFrames"],
        answer: 1, why: "groupby partitions the rows so each distinct team value gets its own group." },
      { q: "How do you get the mean score per team?",
        options: ["df['score'].mean()", "df.groupby('team').sum()", "df.groupby('team')['score'].mean()", "df.mean('team')"],
        answer: 2, why: "Group by team, pick the score column, then aggregate with mean()." },
      { q: "What does .agg(['mean', 'max']) do after a groupby?",
        options: ["Applies several aggregations at once", "Deletes the column", "Sorts the groups descending", "Fills missing values"],
        answer: 0, why: "agg takes a list of functions and computes each one per group." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import pandas as pd\ndf = pd.DataFrame({"team": ["A", "A", "B"], "score": [5, 15, 10]})\nprint(df.groupby("team")["score"].count()["A"])',
      options: ["2", "1", "20", "Error"], answer: 0,
      hint: "count() counts rows per group, and team A appears twice." }
  },
  {
    id: "a54", section: "data-lab", track: "advanced", title: "Data Science: Merging & Joining Data",
    explain: "Data usually lives in more than one table — students in one, scores in another. merge() joins them on a shared key column like id, the same idea as a SQL JOIN, so each row gains the columns from both tables.",
    takeaways: ["`left.merge(right, on='id')` joins rows that share the same id value.", "A left join keeps every row from the left table and fills unmatched rows with `NaN`.", "An inner join (the default) keeps only rows that match in both tables."],
    code: 'import pandas as pd\nstudents = pd.DataFrame({"id": [1, 2], "name": ["Ava", "Bo"]})\nscores = pd.DataFrame({"id": [1, 2], "score": [88, 92]})\nmerged = students.merge(scores, on="id")\nprint(merged.shape)\nprint(merged["name"].tolist())\nprint(merged.loc[merged["id"] == 2, "score"].iloc[0])',
    quiz: [
      { q: "What does students.merge(scores, on='id') do?",
        options: ["Stacks the two tables vertically", "Joins rows that share the same id value", "Deletes duplicate ids", "Sorts both tables by id"],
        answer: 1, why: "merge matches rows on the shared key column and combines their columns." },
      { q: "What does a left join (how='left') keep?",
        options: ["Only rows present in both tables", "Every row from the right table", "Every row from the left table, filling gaps with NaN", "A random sample of rows"],
        answer: 2, why: "Left means the left table drives the result; unmatched rows get NaN for right-side columns." },
      { q: "Why would a merge produce NaN values?",
        options: ["A left-table row had no matching row in the right table", "The tables have the same columns", "merge always adds NaN", "The id column is sorted"],
        answer: 0, why: "With a left join, an unmatched row has no right-side data, so pandas fills it with NaN." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import pandas as pd\nleft = pd.DataFrame({"id": [1, 2], "name": ["Ava", "Bo"]})\nright = pd.DataFrame({"id": [1], "score": [88]})\nm = left.merge(right, on="id", how="left")\nprint(m["score"].isna().sum())',
      options: ["1", "0", "2", "Error"], answer: 0,
      hint: "Bo (id 2) has no row in the right table, so his score becomes NaN — exactly one gap." }
  },
  {
    id: "a55", section: "data-lab", track: "advanced", title: "Data Science: Visualizing with matplotlib",
    explain: "A chart often explains data faster than a table. matplotlib's pyplot builds figures with plot(), bar() and friends, and savefig() writes the figure to a file. Use the Agg backend when there is no screen, so nothing tries to open a window.",
    takeaways: ["Start with `matplotlib.use('Agg')` before importing pyplot when no window is available.", "`plt.plot(x, y)` draws a line chart; `plt.bar(labels, values)` draws a bar chart.", "Save the figure with `plt.savefig('fig.png')` instead of `plt.show()` in scripts."],
    code: 'import matplotlib\nmatplotlib.use("Agg")\nimport matplotlib.pyplot as plt\nplt.plot([1, 2, 3], [88, 92, 79])\nplt.title("Scores over three quizzes")\nplt.savefig("scores.png")\nprint("saved scores.png")',
    quiz: [
      { q: "Why call matplotlib.use('Agg') before importing pyplot?",
        options: ["It makes plots prettier", "It picks a backend that writes files instead of opening a window", "It is required to import pyplot at all", "It speeds up pandas"],
        answer: 1, why: "Agg renders to files, so code runs on servers and scripts with no display." },
      { q: "What does plt.savefig('fig.png') do?",
        options: ["Opens the plot in a window", "Clears the axes", "Writes the current figure to a file", "Saves the data to CSV"],
        answer: 2, why: "savefig renders the figure into the named image file." },
      { q: "Which chart best compares a few categories, like scores per student?",
        options: ["A line plot", "A scatter plot", "A bar chart", "A histogram of one column"],
        answer: 2, why: "Bars make category-to-category comparison immediate at a glance." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import matplotlib\nmatplotlib.use("Agg")\nimport matplotlib.pyplot as plt\nplt.bar(["Ava", "Bo"], [88, 92])\nplt.savefig("bars.png")\nprint(len(plt.gca().patches))',
      options: ["2", "1", "0", "Error"], answer: 0,
      hint: "plt.bar draws one rectangle (patch) per category, and there are two names." }
  },
  {
    id: "a56", section: "data-lab", track: "advanced", title: "Data Science: Descriptive Statistics",
    explain: "Before modelling anything, describe the data: the mean and median tell you where its centre is, the standard deviation and range tell you how spread out it is, and describe() prints that whole summary in one go.",
    takeaways: ["`mean()` is the average; `median()` is the middle value and resists outliers better.", "`std()` measures spread; `max() - min()` gives the range.", "`df.describe()` returns count, mean, std, min, quartiles and max in one table."],
    code: 'import pandas as pd\ns = pd.Series([10, 20, 30, 40, 50])\nprint(s.mean())\nprint(s.median())\nprint(s.max() - s.min())',
    quiz: [
      { q: "What does the mean tell you?",
        options: ["The middle value", "The most common value", "The average of all values", "The spread of the data"],
        answer: 2, why: "The mean is the sum of all values divided by how many there are." },
      { q: "When is the median more useful than the mean?",
        options: ["When the data has extreme outliers", "When all values are equal", "Never", "Only for text data"],
        answer: 0, why: "One huge outlier drags the mean but barely moves the median." },
      { q: "What does describe() return?",
        options: ["A plot of the data", "The data sorted", "A random sample", "A summary: count, mean, std, min, quartiles and max"],
        answer: 3, why: "describe() is the one-call summary table for a Series or DataFrame." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import pandas as pd\ns = pd.Series([2, 4, 4, 4, 5, 5, 7, 9])\nprint(s.mode().tolist())',
      options: ["[4]", "[5]", "[2]", "Error"], answer: 0,
      hint: "mode() returns the most frequent value, and 4 appears three times." }
  },
  {
    id: "a57", section: "data-lab", track: "advanced", title: "Data Science: Linear Regression Intuition",
    explain: "Linear regression fits the straight line that best explains how y changes with x: y = slope * x + intercept. The slope says how much y moves per unit of x, the intercept is y when x is 0, and the line lets you predict y for new x values.",
    takeaways: ["A linear model is `y = slope * x + intercept` — one slope, one intercept.", "`np.polyfit(x, y, 1)` returns the best-fit slope and intercept for your data.", "Predict with the fitted line: `slope * new_x + intercept`."],
    code: 'import numpy as np\nx = np.array([1, 2, 3, 4])\ny = np.array([2, 4, 6, 8])\nslope, intercept = np.polyfit(x, y, 1)\nprint(round(slope, 2), round(intercept, 2))\nprint(round(slope * 5 + intercept, 2))',
    quiz: [
      { q: "In y = slope * x + intercept, what does the slope mean?",
        options: ["Where the line crosses the y-axis", "How much y changes per unit of x", "The number of data points", "The error of the model"],
        answer: 1, why: "The slope is the rate of change: rise over run." },
      { q: "What is the intercept?",
        options: ["The value of y when x is 0", "The steepest point on the line", "The average of x", "The largest residual"],
        answer: 0, why: "Set x to 0 and y equals the intercept alone." },
      { q: "What is a residual?",
        options: ["The slope of the fitted line", "The number of features", "The gap between a real y value and the line's prediction", "The intercept"],
        answer: 2, why: "A residual is the error for one point: actual y minus predicted y." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import numpy as np\nx = np.array([0, 1, 2])\ny = np.array([1, 3, 5])\nslope, intercept = np.polyfit(x, y, 1)\nprint(round(slope * 3 + intercept, 2))',
      options: ["6.0", "7.0", "8.0", "5.0"], answer: 1,
      hint: "The points lie on y = 2x + 1, so at x = 3 the line gives 7." }
  },
  {
    id: "a58", section: "data-lab", track: "advanced", title: "Data Science: Train/Test Splits",
    explain: "Never judge a model on the data it trained on — it may have just memorised it. train_test_split() holds out a slice of your data as a test set, so the score you measure reflects how the model handles data it has never seen.",
    takeaways: ["`train_test_split(X, y, test_size=0.2)` holds out 20% of the rows for testing.", "`random_state=42` makes the random split reproducible — same split every run.", "Train on the train set, evaluate only on the test set, and never let test rows leak into training."],
    code: 'from sklearn.model_selection import train_test_split\nX = [[i] for i in range(10)]\ny = [i * 2 for i in range(10)]\nX_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)\nprint(len(X_train), len(X_test))\nprint(y_test)',
    quiz: [
      { q: "Why split data into train and test sets?",
        options: ["To make training faster", "To test on unseen data and get an honest accuracy", "To use less memory", "scikit-learn requires it"],
        answer: 1, why: "A score on training data can hide memorisation; unseen data keeps the model honest." },
      { q: "What does random_state=42 do?",
        options: ["Makes the random split reproducible", "Sets the test size to 42", "Trains 42 models", "Seeds the model weights"],
        answer: 0, why: "The same seed gives the same shuffle, so the split is identical on every run." },
      { q: "With test_size=0.2 on 100 rows, how many rows land in the test set?",
        options: ["80", "2", "20", "200"],
        answer: 2, why: "20 percent of 100 is 20 rows held out for testing." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from sklearn.model_selection import train_test_split\nX = list(range(8))\nX_train, X_test = train_test_split(X, test_size=0.25, random_state=1)\nprint(len(X_test))',
      options: ["2", "6", "4", "1"], answer: 0,
      hint: "A quarter of 8 rows is 2, whatever random_state you pick." }
  },
  {
    id: "a59", section: "data-lab", track: "advanced", title: "ML: scikit-learn First Model",
    explain: "scikit-learn gives every model the same two-step dance: fit(X, y) to train it, then predict(X_new) to use it. A LinearRegression learns the best-fit line through your data, and its coef_ tells you the slope it found.",
    takeaways: ["Every scikit-learn model follows `fit(X, y)` then `predict(X_new)`.", "`X` must be 2D — one row per sample, even for a single feature: `[[1], [2], [3]]`.", "After fitting, `model.coef_` holds the learned slope and `model.predict` gives new predictions."],
    code: 'from sklearn.linear_model import LinearRegression\nmodel = LinearRegression()\nmodel.fit([[1], [2], [3]], [2, 4, 6])\nprint(model.predict([[4]]))\nprint(round(model.coef_[0], 2))',
    quiz: [
      { q: "What does model.fit(X, y) do?",
        options: ["Predicts new values", "Splits the data", "Plots the results", "Trains the model on the data"],
        answer: 3, why: "fit is the training step: the model learns its parameters from X and y." },
      { q: "What does model.predict([[4]]) return after training on y = 2x?",
        options: ["An error, since 4 was never seen", "A prediction for the input 4", "The training labels", "The model coefficients"],
        answer: 1, why: "predict applies the learned rule to new inputs; here it returns [8.]." },
      { q: "In scikit-learn, what shape must X have?",
        options: ["A 2D list: one row per sample", "A flat list", "A dictionary", "A single number"],
        answer: 0, why: "X is always 2D, so one feature still needs [[1], [2]] rather than [1, 2]." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from sklearn.linear_model import LinearRegression\nm = LinearRegression()\nm.fit([[0], [1]], [1, 3])\nprint(m.predict([[2]]))',
      options: ["[4.]", "[5.]", "[3.]", "Error"], answer: 1,
      hint: "The two points lie on y = 2x + 1, so at x = 2 the model predicts 5." }
  },
  {
    id: "a60", section: "data-lab", track: "advanced", title: "ML: Classification vs Regression",
    explain: "Machine learning splits into two big jobs: classification predicts a category ('spam or not', 'low or high'), while regression predicts a number ('what price?'). Pick the wrong type and even a perfect model answers the wrong question.",
    takeaways: ["Classification predicts a label or category; regression predicts a continuous number.", "A `DecisionTreeClassifier` learns yes/no style rules by splitting the data at thresholds.", "Ask first: is the answer a category or a number? That decides the model family."],
    code: 'from sklearn.tree import DecisionTreeClassifier\nmodel = DecisionTreeClassifier(random_state=0)\nmodel.fit([[1], [2], [3], [4]], ["low", "low", "high", "high"])\nprint(model.predict([[2.5]]))\nprint(model.predict([[3.5]]))',
    quiz: [
      { q: "What does a classification model predict?",
        options: ["A continuous number", "A category or label", "A probability only", "A straight line"],
        answer: 1, why: "Classification outputs one of a fixed set of classes, like spam or not spam." },
      { q: "What does a regression model predict?",
        options: ["A continuous number", "A category label", "A file path", "A missing value"],
        answer: 0, why: "Regression predicts numbers on a scale, such as a house price or a temperature." },
      { q: "'Will this customer churn: yes or no?' is which kind of problem?",
        options: ["Regression", "Clustering", "Classification", "Sorting"],
        answer: 2, why: "The answer is one of two categories, so it is a binary classification problem." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from sklearn.tree import DecisionTreeClassifier\nm = DecisionTreeClassifier(random_state=0)\nm.fit([[0], [10]], ["a", "b"])\nprint(m.predict([[0]]))',
      options: ["['b']", "['a']", "[0]", "Error"], answer: 1,
      hint: "Input 0 was trained with label 'a', and a tree memorises its training points." }
  },
  {
    id: "a61", section: "data-lab", track: "advanced", title: "ML: Feature Engineering Basics",
    explain: "Models eat numbers, not raw text — so you engineer features: turn categories into 0/1 columns, scale numbers onto a shared range, and derive new columns from old ones. Good features often matter more than a fancier model.",
    takeaways: ["One-hot encoding turns each category into its own 0/1 column: `pd.get_dummies(df['city'])`.", "Scale numeric features so a column in the thousands does not drown one in single digits.", "Derived features like price-per-room come from combining columns you already have."],
    code: 'import pandas as pd\ndf = pd.DataFrame({"city": ["Pune", "Mumbai", "Pune"], "price": [100, 200, 150]})\ndummies = pd.get_dummies(df["city"], dtype=int)\nprint(dummies.columns.tolist())\nprint(dummies["Pune"].sum())',
    quiz: [
      { q: "What is one-hot encoding?",
        options: ["Scaling numbers to the 0-1 range", "Turning each category into its own 0/1 column", "Deleting text columns", "Sorting categories alphabetically"],
        answer: 1, why: "Each category gets a column that is 1 where it applies and 0 elsewhere." },
      { q: "Why scale numeric features before training?",
        options: ["So large numbers do not dominate distance-based models", "To make the data file smaller", "To remove categories", "Scaling is never needed"],
        answer: 0, why: "A feature in the thousands outweighs one in single digits unless both are scaled." },
      { q: "What is a derived feature?",
        options: ["A column copied from another dataset", "A random column", "A feature computed from existing columns, like price per room", "A deleted column"],
        answer: 2, why: "Derived features are new signals you build from columns you already have." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import pandas as pd\ns = pd.Series(["red", "blue", "red"])\nprint(pd.get_dummies(s, dtype=int).shape)',
      options: ["(3, 3)", "(2, 3)", "(3, 2)", "Error"], answer: 2,
      hint: "Three rows, and two distinct colours mean two dummy columns." }
  },
  {
    id: "a62", section: "data-lab", track: "advanced", title: "ML: Evaluating Models",
    explain: "A model is only as good as its score on data it has not seen. Accuracy is the fraction of correct predictions, but on lopsided data it can lie — a model that always guesses the majority class can score high while learning nothing.",
    takeaways: ["`accuracy_score(y_true, y_pred)` is the fraction of predictions that are correct.", "On imbalanced data, accuracy can look great while the model ignores the rare class.", "A confusion matrix breaks errors down by class, showing what the model confuses with what."],
    code: 'from sklearn.metrics import accuracy_score\ny_true = [1, 0, 1, 1, 0]\ny_pred = [1, 0, 0, 1, 0]\nprint(accuracy_score(y_true, y_pred))',
    quiz: [
      { q: "What is accuracy?",
        options: ["The fraction of predictions that are correct", "The training time", "The number of features", "The loss value"],
        answer: 0, why: "Accuracy divides correct predictions by total predictions." },
      { q: "Why can accuracy mislead on imbalanced data?",
        options: ["It is always wrong", "A model that always predicts the majority class can score high while learning nothing", "It only works for regression", "It needs more data to run"],
        answer: 1, why: "If 95% of the data is one class, always guessing it scores 0.95 with zero learning." },
      { q: "What does a confusion matrix show?",
        options: ["Training speed", "Feature names", "The model code", "Correct vs incorrect predictions broken down by class"],
        answer: 3, why: "It tabulates predicted vs actual labels, so you see exactly which classes get confused." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from sklearn.metrics import accuracy_score\nprint(round(accuracy_score([1, 1, 0], [1, 0, 0]), 2))',
      options: ["0.33", "1.0", "0.67", "0.5"], answer: 2,
      hint: "Two of the three predictions match, and 2/3 rounds to 0.67." }
  },
  {
    id: "a63", section: "launch-pad", track: "advanced", title: "Web: HTTP Basics for Python Devs",
    explain: "HTTP is the language browsers and servers speak: a request line (GET /lessons), headers, and an optional body, answered by a status code and a body — often JSON. You can practise the whole exchange offline by parsing sample responses instead of hitting a real server.",
    takeaways: ["A response starts with a status code: `200` means OK, `404` means not found.", "Parse a URL's parts with `urllib.parse.urlparse`: scheme, netloc, path and query.", "JSON bodies parse with `json.loads()`; the sample below is exactly what an API would hand you."],
    code: 'import json\nfrom urllib.parse import urlparse\n\n# this is what requests.get(url).json() would hand you:\nsample = \'{"status": 200, "body": {"user": "Ava", "id": 7}}\'\nresp = json.loads(sample)\nprint(resp["status"])\nprint(resp["body"]["user"])\nu = urlparse("https://example.com/lessons/7?sort=top")\nprint(u.path)\nprint(u.query)',
    quiz: [
      { q: "What does HTTP status code 200 mean?",
        options: ["Not found", "OK: the request succeeded", "Server error", "Redirect"],
        answer: 1, why: "200 is the success code; the server did what you asked." },
      { q: "What is the query string in a URL?",
        options: ["The part after ? with key=value pairs", "The domain name", "The protocol", "The page title"],
        answer: 0, why: "Everything after the ? is the query string, like sort=top." },
      { q: "What is the difference between GET and POST?",
        options: ["GET sends data in the body, POST in the URL", "GET fetches data, POST sends data to create or change something", "They are identical", "POST cannot return JSON"],
        answer: 1, why: "GET is for reading, POST carries a body to create or update a resource." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from urllib.parse import urlparse\nu = urlparse("https://skillzify.example/api/users?page=2")\nprint(u.netloc)',
      options: ["skillzify.example", "https", "/api/users", "page=2"], answer: 0,
      hint: "netloc is the network location: the domain (and port, if any)." }
  },
  {
    id: "a64", section: "launch-pad", track: "advanced", title: "Web: Flask First App",
    explain: "Flask turns a Python function into a web page: @app.route('/') maps a URL to the function below it, and the function's return value becomes the response. You can test routes with app.test_client() without ever starting a server.",
    takeaways: ["`@app.route('/')` maps a URL path to the function below it.", "The view function's return value becomes the HTTP response body.", "Use `app.test_client()` to call routes in tests — never `app.run()` in lesson code."],
    code: 'from flask import Flask\napp = Flask(__name__)\n@app.route("/")\ndef home():\n    return "Hello, Skillzify!"\nclient = app.test_client()\nresp = client.get("/")\nprint(resp.status_code)\nprint(resp.data.decode())',
    quiz: [
      { q: "What does @app.route('/') do?",
        options: ["Starts the server", "Maps the URL / to the function below it", "Creates a database", "Imports Flask"],
        answer: 1, why: "The decorator registers the view function as the handler for that path." },
      { q: "Why use app.test_client() in this lesson?",
        options: ["It exercises routes without starting a real server", "It is faster than a browser", "It deploys the app", "It writes HTML files"],
        answer: 0, why: "The test client calls your routes in-process, so no server or port is needed." },
      { q: "What does a status_code of 200 mean?",
        options: ["Page not found", "The request succeeded", "The server crashed", "A redirect"],
        answer: 1, why: "200 is HTTP for OK — the route ran and returned a response." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from flask import Flask\napp = Flask(__name__)\n@app.route("/hi")\ndef hi():\n    return "Hi Ava"\nprint(app.test_client().get("/hi").data.decode())',
      options: ["Hi Ava", "Hi", "404", "Error"], answer: 0,
      hint: "The /hi route returns the string 'Hi Ava' as the response body." }
  },
  {
    id: "a65", section: "launch-pad", track: "advanced", title: "Web: Flask Routing & Templates",
    explain: "Routes can capture parts of the URL: /hello/<name> hands 'Ava' to your function as name. Templates then mix that value into HTML with {{ name }} placeholders, so one route can serve a personalised page for every visitor.",
    takeaways: ["`<name>` in a route captures that URL segment as a function argument.", "`<int:n>` captures the segment and converts it to an int automatically.", "Render HTML with placeholders using `render_template_string('... {{ name }} ...', name=name)`."],
    code: 'from flask import Flask, render_template_string\napp = Flask(__name__)\n@app.route("/hello/<name>")\ndef hello(name):\n    return render_template_string("<h1>Hello, {{ name }}!</h1>", name=name)\nclient = app.test_client()\nprint(client.get("/hello/Ava").data.decode())\nprint(client.get("/missing").status_code)',
    quiz: [
      { q: "What does <name> in a route like /hello/<name> do?",
        options: ["It is a comment", "It captures that URL segment as a function argument", "It sets the page title", "It imports a module"],
        answer: 1, why: "Flask passes the captured segment into the view function as name." },
      { q: "What does render_template_string do?",
        options: ["Renders a template string with {{ }} placeholders filled in", "Saves a template to a file", "Starts the server", "Validates a form"],
        answer: 0, why: "It takes a template string plus values and returns the filled-in HTML." },
      { q: "What status code does Flask return for an unknown URL?",
        options: ["200", "500", "404", "301"],
        answer: 2, why: "404 means no route matched the requested path." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from flask import Flask\napp = Flask(__name__)\n@app.route("/square/<int:n>")\ndef square(n):\n    return str(n * n)\nprint(app.test_client().get("/square/5").data.decode())',
      options: ["5", "10", "25", "Error"], answer: 2,
      hint: "<int:n> converts 5 to the integer 5, and 5 squared is 25." }
  },
  {
    id: "a66", section: "launch-pad", track: "advanced", title: "Web: Flask Forms & Validation",
    explain: "Forms arrive on the server as request.form, a dict-like object of the submitted fields. Always validate there: strip whitespace, reject blanks, and answer bad input with a 400 status — because anyone can bypass the checks in the browser.",
    takeaways: ["Read submitted fields with `request.form.get('name', '')`.", "Use `.strip()` so a name of only spaces fails validation like a blank one.", "Return a `400` status for invalid input so the client knows the request was bad."],
    code: 'from flask import Flask, request\napp = Flask(__name__)\n@app.route("/signup", methods=["POST"])\ndef signup():\n    name = request.form.get("name", "").strip()\n    if not name:\n        return "Name is required", 400\n    return "Welcome, " + name\nclient = app.test_client()\nprint(client.post("/signup", data={"name": "Ava"}).status_code)\nprint(client.post("/signup", data={"name": ""}).status_code)',
    quiz: [
      { q: "Why validate form input on the server, not just in the browser?",
        options: ["Browsers never send bad data", "Anyone can bypass browser checks, so the server is the last line of defence", "It makes pages prettier", "Flask requires it"],
        answer: 1, why: "Browser validation is cosmetic; a crafted request can skip it entirely." },
      { q: "What does request.form.get('name', '') do?",
        options: ["Reads the name field, defaulting to an empty string", "Deletes the field", "Creates a database row", "Redirects the user"],
        answer: 0, why: "get with a default avoids a KeyError when the field is missing." },
      { q: "Why strip() the name before checking it?",
        options: ["To encrypt the name", "To sort the name", "To remove surrounding spaces so blank-looking input fails validation", "To make it lowercase"],
        answer: 2, why: "Without strip, a name of three spaces would pass the 'not name' check." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from flask import Flask, request\napp = Flask(__name__)\n@app.route("/signup", methods=["POST"])\ndef signup():\n    name = request.form.get("name", "").strip()\n    if not name:\n        return "Name is required", 400\n    return "Welcome, " + name\nprint(app.test_client().post("/signup", data={"name": " Bo "}).data.decode())',
      options: ["Welcome, Bo", "Welcome,  Bo ", "Name is required", "Error"], answer: 0,
      hint: "strip() removes the spaces around Bo before the greeting is built." }
  },
  {
    id: "a67", section: "launch-pad", track: "advanced", title: "Web: REST APIs with Flask",
    explain: "A REST API is a set of URLs that speak JSON instead of HTML: GET fetches, POST creates, and each resource has its own path like /api/lessons. jsonify() turns your Python dicts and lists into a proper JSON response.",
    takeaways: ["A REST endpoint returns structured data (usually JSON) over HTTP verbs.", "`jsonify(data)` converts Python data into a JSON response.", "Use GET to fetch, POST to create, and `request.get_json()` to read a JSON body."],
    code: 'from flask import Flask, jsonify\napp = Flask(__name__)\nlessons = [{"id": 1, "title": "Hello Python"}]\n@app.route("/api/lessons")\ndef get_lessons():\n    return jsonify(lessons)\nclient = app.test_client()\nresp = client.get("/api/lessons")\nprint(resp.status_code)\nprint(resp.get_json()[0]["title"])',
    quiz: [
      { q: "What makes an endpoint a REST API rather than a web page?",
        options: ["It returns HTML pages", "It returns structured data like JSON over HTTP verbs", "It uses a database", "It needs JavaScript"],
        answer: 1, why: "APIs exchange data (JSON) while pages return HTML for humans." },
      { q: "Which HTTP verb is used to create a new resource?",
        options: ["GET", "DELETE", "POST", "HEAD"],
        answer: 2, why: "By convention POST creates, GET reads, PUT/PATCH updates, DELETE removes." },
      { q: "What does jsonify() do?",
        options: ["Parses JSON from a request", "Converts Python data to a JSON response", "Validates a token", "Connects to a database"],
        answer: 1, why: "jsonify serialises your data and sets the JSON content type." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from flask import Flask, jsonify, request\napp = Flask(__name__)\n@app.route("/api/echo", methods=["POST"])\ndef echo():\n    return jsonify(request.get_json())\nprint(app.test_client().post("/api/echo", json={"x": 3}).get_json())',
      options: ["{'x': '3'}", "{'x': 3}", "None", "Error"], answer: 1,
      hint: "The JSON body round-trips: 3 stays the number 3, not the string '3'." }
  },
  {
    id: "a68", section: "launch-pad", track: "advanced", title: "Web: FastAPI First App",
    explain: "FastAPI is a modern framework for building APIs: you declare routes with decorators just like Flask, but return plain Python dicts and FastAPI turns them into JSON. It also generates interactive docs at /docs from your routes, for free.",
    takeaways: ["Declare routes with `@app.get('/hello')` and return a dict — FastAPI serialises it to JSON.", "Test without a server using `TestClient(app)`, the same idea as Flask's test client.", "FastAPI builds interactive API docs at `/docs` automatically from your code."],
    code: 'from fastapi import FastAPI\nfrom fastapi.testclient import TestClient\napp = FastAPI()\n@app.get("/hello")\ndef hello():\n    return {"message": "Hello, Ava"}\nclient = TestClient(app)\nresp = client.get("/hello")\nprint(resp.status_code)\nprint(resp.json()["message"])',
    quiz: [
      { q: "What does FastAPI give you over a plain Flask API?",
        options: ["Automatic docs and data validation from type hints", "A built-in database", "Free hosting", "It only works with JavaScript"],
        answer: 0, why: "FastAPI generates OpenAPI docs and validates requests from your type hints." },
      { q: "What does the /docs page show?",
        options: ["Your source code", "Interactive API docs generated from your routes", "Server logs", "The database contents"],
        answer: 1, why: "FastAPI builds a Swagger UI page from your routes, where you can try each endpoint." },
      { q: "What does a FastAPI view function returning a dict produce?",
        options: ["A JSON response", "An HTML page", "A file download", "An error"],
        answer: 0, why: "FastAPI serialises returned dicts to JSON automatically." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from fastapi import FastAPI\nfrom fastapi.testclient import TestClient\napp = FastAPI()\n@app.get("/square/{n}")\ndef square(n: int):\n    return {"result": n * n}\nprint(TestClient(app).get("/square/6").json())',
      options: ["{'result': 36}", "{'result': '36'}", "{'result': 6}", "Error"], answer: 0,
      hint: "The path parameter n: int converts '6' to 6, and 6 squared is 36." }
  },
  {
    id: "a69", section: "launch-pad", track: "advanced", title: "Web: Authentication Basics (Sessions & Tokens)",
    explain: "Authentication answers 'who are you?' — usually by checking a password against a stored hash, never the password itself. Once logged in, the server remembers you with a session or hands you a token to send with each request.",
    takeaways: ["Store password hashes, never plain passwords — `hashlib.sha256` turns a password into a fixed fingerprint.", "Compare hashes with `hmac.compare_digest` to avoid timing attacks.", "A session remembers a logged-in user server-side; a token is a credential the client sends with each request."],
    code: 'import hashlib, hmac\nstored = hashlib.sha256("correct-horse".encode()).hexdigest()\nattempt = hashlib.sha256("correct-horse".encode()).hexdigest()\nprint(hmac.compare_digest(stored, attempt))\nprint(hmac.compare_digest(stored, hashlib.sha256("wrong".encode()).hexdigest()))',
    quiz: [
      { q: "Why store a password hash instead of the password itself?",
        options: ["Hashes are shorter", "A stolen database then does not reveal passwords directly", "It is faster to log in", "Passwords cannot be stored at all"],
        answer: 1, why: "A hash cannot be reversed into the password, so a leak is far less damaging." },
      { q: "What is a session?",
        options: ["A server-side record that remembers a logged-in user across requests", "A browser tab", "A password hash", "A database table"],
        answer: 0, why: "The session id in a cookie points at server-side state for that user." },
      { q: "How should a client send an auth token?",
        options: ["In the URL of every link", "In an Authorization header or a secure cookie", "Printed on the page", "In a public comment"],
        answer: 1, why: "Headers and secure cookies keep the token out of URLs, logs and page text." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import hashlib\nprint(hashlib.sha256(b"abc").hexdigest()[:6])',
      options: ["e3b0c4", "ba7816", "abc123", "Error"], answer: 1,
      hint: "sha256 of 'abc' is a famous test vector — it starts with ba7816." }
  },
  {
    id: "a70", section: "launch-pad", track: "advanced", title: "Web: Talking to Databases (SQLAlchemy Intro)",
    explain: "SQLAlchemy is Python's standard ORM: you describe a table as a class, and the ORM writes the SQL for you. An engine connects to the database, Base.metadata.create_all() builds the tables, and a Session is where you add, commit and query rows.",
    takeaways: ["An ORM maps classes to tables: a `User` class becomes a `users` table.", "`create_engine('sqlite:///:memory:')` opens an in-memory SQLite database.", "Add objects to a `Session`, call `commit()` to save them, and query with `select(User)`."],
    code: 'from sqlalchemy import Column, Integer, String, create_engine, select\nfrom sqlalchemy.orm import declarative_base, Session\nBase = declarative_base()\nclass User(Base):\n    __tablename__ = "users"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\nengine = create_engine("sqlite:///:memory:")\nBase.metadata.create_all(engine)\nwith Session(engine) as s:\n    s.add(User(name="Ava"))\n    s.commit()\n    print(s.execute(select(User)).scalars().all()[0].name)\n    print(len(s.execute(select(User)).scalars().all()))',
    quiz: [
      { q: "What does an ORM like SQLAlchemy do?",
        options: ["It writes raw SQL for you by mapping classes to tables", "It hosts your database server", "It encrypts passwords", "It replaces Python"],
        answer: 0, why: "You work with Python objects and the ORM translates to SQL." },
      { q: "What does create_engine('sqlite:///:memory:') create?",
        options: ["A file database", "An in-memory SQLite database that vanishes when the program ends", "A PostgreSQL server", "A CSV file"],
        answer: 1, why: ":memory: means the whole database lives in RAM and disappears on exit." },
      { q: "What does session.commit() do?",
        options: ["Deletes all rows", "Closes the connection", "Creates the tables", "Saves pending changes to the database"],
        answer: 3, why: "Until commit, added objects are only staged; commit writes them durably." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from sqlalchemy import Column, Integer, String, create_engine, select\nfrom sqlalchemy.orm import declarative_base, Session\nBase = declarative_base()\nclass User(Base):\n    __tablename__ = "users"\n    id = Column(Integer, primary_key=True)\n    name = Column(String)\nengine = create_engine("sqlite:///:memory:")\nBase.metadata.create_all(engine)\nwith Session(engine) as s:\n    s.add_all([User(name="Ava"), User(name="Bo")])\n    s.commit()\n    print(len(s.execute(select(User)).scalars().all()))',
      options: ["1", "0", "2", "Error"], answer: 2,
      hint: "Two users are added and committed, so the query returns two rows." }
  },
{
    id: "a71", section: "launch-pad", track: "advanced", title: "Automation: Scripting Your OS with os & shutil",
    explain: "Automation starts with the operating system: listing files, copying them, and tidying folders without clicking around. The os and shutil modules give you those superpowers in a few lines, and a script can repeat the job perfectly a thousand times.",
    takeaways: ["`os.listdir('.')` lists files in the current folder; `os.path.exists(path)` checks a file is really there.", "`shutil.copy(src, dst)` copies a file; `shutil.move(src, dst)` moves or renames it.", "`os.makedirs(path, exist_ok=True)` creates folders without crashing if they already exist."],
    code: 'import os, shutil\n\nopen("demo.txt", "w").write("hello automation")\nshutil.copy("demo.txt", "demo_backup.txt")\nprint("backup exists:", os.path.exists("demo_backup.txt"))\nprint("size:", os.path.getsize("demo.txt"))\nprint("txt files:", sorted(f for f in os.listdir(".") if f.startswith("demo")))',
    quiz: [
      { q: "What does shutil.copy('a.txt', 'b.txt') do?",
        options: ["Deletes a.txt after copying it", "Renames the folder containing a.txt", "Prints the contents of a.txt", "Copies the file a.txt to a new file b.txt"],
        answer: 3, why: "copy duplicates the file; the original stays exactly where it was." },
      { q: "Why use os.makedirs('logs', exist_ok=True) instead of os.mkdir('logs')?",
        options: ["It works only on Windows", "It creates nested folders and does not crash if the folder already exists", "It is faster for large files", "It deletes old files in the folder"],
        answer: 1, why: "makedirs builds parent folders too, and exist_ok=True makes a repeat run safe." },
      { q: "What does os.path.getsize('demo.txt') return?",
        options: ["The number of lines in the file", "The date the file was created", "The folder the file lives in", "The size of the file in bytes"],
        answer: 3, why: "getsize reports the file size in bytes." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import os\nos.makedirs("logs", exist_ok=True)\nopen("logs/a.txt", "w").write("x")\nprint(os.path.isdir("logs"), os.path.exists("logs/a.txt"))', options: ["True False", "False True", "Error", "True True"], answer: 3,
      hint: "makedirs creates the folder, and the file is written inside it." }
  },
  {
    id: "a72", section: "launch-pad", track: "advanced", title: "Automation: Web Scraping Basics",
    explain: "Web scraping means pulling useful data out of a web page: titles, prices, links. You fetch the HTML, then search it for patterns — and you must respect robots.txt, rate limits, and the site's terms before scraping anything real.",
    takeaways: ["HTML is just text, so `re.findall(r'<h2>(.*?)</h2>', html)` can pull out every heading.", "Always check robots.txt and the site terms, and scrape politely with delays between requests.", "For real pages, prefer an official API; scrape only when no API exists."],
    code: 'import re\n\n# sample HTML, like the body a requests call would hand you:\nsample = "<html><body><h2>Python Tips</h2><h2>Flask Guide</h2><p>Price: $25</p></body></html>"\ntitles = re.findall(r"<h2>(.*?)</h2>", sample)\nprice = re.search(r"\\$(\\d+)", sample).group(1)\nprint(titles)\nprint("price:", price)',
    quiz: [
      { q: "What does re.findall(r'<h2>(.*?)</h2>', html) return?",
        options: ["A list of the text inside every <h2> tag", "The whole HTML page as one string", "Only the first heading on the page", "A list of all the links on the page"],
        answer: 0, why: "findall returns every non-overlapping match of the pattern." },
      { q: "Before scraping a real website, what should you check first?",
        options: ["Whether the site uses JavaScript", "The number of images on the page", "Its robots.txt and terms of use", "The colour scheme of the homepage"],
        answer: 2, why: "robots.txt and the terms say what automated access the site allows." },
      { q: "Why is scraping every second without a delay a bad idea?",
        options: ["It can overload the server and get your IP blocked", "It makes the HTML invalid", "It breaks the re module", "It deletes the page from the server"],
        answer: 0, why: "Rapid-fire requests look like an attack; polite scrapers pause between requests." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import re\nsample = "<ul><li>Ava</li><li>Bo</li></ul>"\nitems = re.findall(r"<li>(.*?)</li>", sample)\nprint(len(items), items[0])', options: ["Error", "2 Ava", "2 Bo", "1 Ava"], answer: 1,
      hint: "Count the <li> pairs, then take the first match." }
  },
  {
    id: "a73", section: "launch-pad", track: "advanced", title: "Automation: Working with Excel Files (openpyxl)",
    explain: "openpyxl lets Python read and write real .xlsx spreadsheets: build reports, fill in scores, or pull numbers out of a sheet someone emailed you. A workbook holds sheets, sheets hold cells, and you address cells like ws['B2'].",
    takeaways: ["`openpyxl.Workbook()` creates a workbook; `wb.active` is its first sheet.", "`ws.append([\"Ava\", 92])` adds a whole row at the bottom of the sheet.", "`openpyxl.load_workbook(\"scores.xlsx\")` re-opens a saved file for reading."],
    code: 'import openpyxl\n\nwb = openpyxl.Workbook()\nws = wb.active\nws.title = "Scores"\nws.append(["Name", "Score"])\nws.append(["Ava", 92])\nws.append(["Bo", 78])\nwb.save("scores.xlsx")\nwb2 = openpyxl.load_workbook("scores.xlsx")\nws2 = wb2["Scores"]\nprint(ws2["A2"].value, ws2["B2"].value)\nprint(ws2.max_row)',
    quiz: [
      { q: "What does ws.append(['Ava', 92]) do?",
        options: ["Deletes the last row of the sheet", "Adds a new row with Ava in column A and 92 in column B", "Adds a new sheet named Ava", "Sorts the sheet by score"],
        answer: 1, why: "append writes the list as the next empty row, one value per column." },
      { q: "How do you read the value in cell B2 after loading a workbook?",
        options: ["ws.B2()", "wb.read('B2')", "ws.cell_value(2)", "ws['B2'].value"],
        answer: 3, why: "Cells are addressed like ws['B2'], and .value holds the contents." },
      { q: "What does ws.max_row tell you?",
        options: ["The width of the widest column", "The number of the last row that contains data", "The maximum value in the sheet", "The number of sheets in the workbook"],
        answer: 1, why: "max_row is the index of the last non-empty row." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import openpyxl\nwb = openpyxl.Workbook()\nws = wb.active\nws.append(["Name", "Score"])\nws.append(["Al", 85])\nprint(ws["B2"].value)', options: ["Al", "0", "Error", "85"], answer: 3,
      hint: "Row 1 is the header, so Al lands in row 2 and 85 in column B." }
  },
  {
    id: "a74", section: "launch-pad", track: "advanced", title: "Automation: Sending Emails with Python",
    explain: "Python can send email with smtplib and build messages with the email.message module: set the subject, sender and recipient, add a plain-text body, and the message is ready to hand to a mail server. Never hard-code your real password — use an app password from an environment variable.",
    takeaways: ["`EmailMessage()` builds a message; set `msg[\"Subject\"]`, `msg[\"From\"]` and `msg[\"To\"]` like a dictionary.", "`msg.set_content(\"...\")` adds the plain-text body of the email.", "Send with `smtplib.SMTP_SSL(\"smtp.gmail.com\", 465)` and log in with an app password, never your main password."],
    code: 'from email.message import EmailMessage\n\nmsg = EmailMessage()\nmsg["Subject"] = "Your Skillzify progress"\nmsg["From"] = "hello@skillzify.example"\nmsg["To"] = "ava@example.com"\nmsg.set_content("Hi Ava, you finished 3 lessons this week!")\nprint(msg["Subject"])\nprint(msg["To"])\nprint("Hi Ava" in msg.get_content())',
    quiz: [
      { q: "What does msg.set_content('Hello!') do?",
        options: ["Sends the email immediately", "Adds an attachment to the email", "Sets the plain-text body of the email", "Sets the email subject line"],
        answer: 2, why: "set_content writes the message body; sending is a separate smtplib step." },
      { q: "Why should you use an app password instead of your main Gmail password in a script?",
        options: ["So a leaked script password cannot unlock your whole account and can be revoked alone", "App passwords make emails send faster", "Gmail blocks all other passwords", "App passwords are shorter to type"],
        answer: 0, why: "An app password is scoped to one use and revocable without changing your real password." },
      { q: "Which module actually delivers the message to a mail server?",
        options: ["os", "json", "smtplib", "email.message"],
        answer: 2, why: "email.message builds the message; smtplib speaks SMTP to send it." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from email.message import EmailMessage\nmsg = EmailMessage()\nmsg["From"] = "bot@skillzify.example"\nmsg["To"] = "bo@example.com"\nmsg.set_content("Reminder: quiz at 6 pm.")\nprint(msg["From"], msg["To"])', options: ["bot@skillzify.example bo@example.com", "bo@example.com bot@skillzify.example", "Reminder: quiz at 6 pm.", "Error"], answer: 0,
      hint: "Headers print in the order you ask for them." }
  },
  {
    id: "a75", section: "launch-pad", track: "advanced", title: "Automation: Scheduling Tasks",
    explain: "A scheduled task runs on its own: a daily backup, a weekly report, a reminder every morning. Inside Python, the sched module runs functions after a delay, while real deployments use cron on Linux or Task Scheduler on Windows for jobs that must survive restarts.",
    takeaways: ["`sched.scheduler(time.time, time.sleep)` runs functions after a delay you choose.", "`scheduler.enter(60, 1, job)` schedules job to run in 60 seconds; `scheduler.run()` starts the loop.", "For jobs that must run even when your script is closed, use cron (Linux) or Task Scheduler (Windows)."],
    code: 'import sched, time\n\ndone = []\ns = sched.scheduler(time.time, time.sleep)\ns.enter(0.05, 1, done.append, argument=("backup done",))\ns.run()\nprint(done)',
    quiz: [
      { q: "What does scheduler.enter(60, 1, job) do?",
        options: ["Runs job 60 times immediately", "Pauses the program for 60 minutes", "Cancels a job named job", "Schedules job to run after 60 seconds"],
        answer: 3, why: "enter takes a delay in seconds, a priority, and the function to call." },
      { q: "What does scheduler.run() do?",
        options: ["Runs the job once per second forever", "Starts the loop that waits and executes scheduled jobs", "Lists all scheduled jobs", "Deletes every scheduled job"],
        answer: 1, why: "run blocks and fires each job when its time arrives." },
      { q: "Why use cron instead of sched for a daily 6 am backup?",
        options: ["cron is written in Python", "sched cannot run daily jobs", "cron sends the backup by email automatically", "cron runs even when your Python script is not running"],
        answer: 3, why: "sched only works while your process is alive; cron is the operating system scheduler." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import sched, time\nlog = []\ns = sched.scheduler(time.time, time.sleep)\ns.enter(0.01, 1, log.append, argument=("a",))\ns.enter(0.01, 2, log.append, argument=("b",))\ns.run()\nprint(log)', options: ["[]", "Error", "['a', 'b']", "['b', 'a']"], answer: 2,
      hint: "Same delay, so the lower priority number runs first." }
  },
  {
    id: "a76", section: "power-lab", track: "advanced", title: "Packaging: Wheels, pyproject & Publishing",
    explain: "Packaging turns your code into something others can install with pip. A pyproject.toml file declares the name, version and dependencies, and building it produces a wheel — a ready-to-install .whl file you can upload to PyPI.",
    takeaways: ["`pyproject.toml` is the modern home of package metadata: name, version, and dependencies.", "A wheel filename looks like `mytool-0.1.0-py3-none-any.whl`: name, version, Python tag, platform tag.", "`python -m build` builds the wheel; `twine upload` publishes it to PyPI."],
    code: 'project = {"name": "skillzify-tools", "version": "0.1.0", "requires-python": ">=3.10"}\nprint(project["name"], project["version"])\nwheel = project["name"].replace("-", "_") + "-" + project["version"] + "-py3-none-any.whl"\nprint("wheel name:", wheel)',
    quiz: [
      { q: "What is pyproject.toml for?",
        options: ["Declaring a package name, version, and dependencies for building", "Storing your source code", "Running your test suite", "Logging errors at runtime"],
        answer: 0, why: "Build tools read pyproject.toml to know what they are packaging." },
      { q: "What is a wheel (.whl) file?",
        options: ["A compressed backup of your project", "A test report", "A pre-built package archive that pip can install directly", "A Python source file"],
        answer: 2, why: "Wheels are the installable format pip downloads from PyPI." },
      { q: "In the wheel name mytool-0.1.0-py3-none-any.whl, what is 0.1.0?",
        options: ["The package version", "The Python version", "The file size", "The upload date"],
        answer: 0, why: "Wheel names follow name-version-python-abi-platform, so 0.1.0 is the version." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'project = {"name": "quiz-app", "version": "2.3.1"}\nprint(project["name"] + " " + project["version"])', options: ["quiz-app 2.3.1", "quiz_app 2.3.1", "quiz-app2.3.1", "Error"], answer: 0,
      hint: "The plus joins the two strings with the space in between." }
  },
  {
    id: "a77", section: "power-lab", track: "advanced", title: "Profiling: Finding Bottlenecks",
    explain: "Profiling means measuring where your program actually spends its time instead of guessing. A one-line timing test can prove that a set lookup beats a list scan by a hundred times — and that is the kind of fact you optimize on.",
    takeaways: ["`timeit.timeit(code, setup=..., number=1000)` times a snippet fairly by repeating it.", "Set and dict lookups are near-instant even at 10,000 items; list scans grow with size.", "Profile first, optimize second: measure the real hotspot before rewriting code."],
    code: 'import timeit\n\nlist_time = timeit.timeit("9999 in xs", setup="xs = list(range(10000))", number=1000)\nset_time = timeit.timeit("9999 in xs", setup="xs = set(range(10000))", number=1000)\nprint("set faster:", set_time < list_time)\nprint(list_time > 0 and set_time > 0)',
    quiz: [
      { q: "Why use timeit instead of timing code once with time.time()?",
        options: ["time.time() is deprecated", "Repeating the measurement averages out noise and gives a stable result", "time.time() cannot time loops", "timeit runs the code in parallel"],
        answer: 1, why: "One run is noisy; hundreds of repeats reveal the real difference." },
      { q: "Why is 9999 in a set of 10,000 items so much faster than in a list?",
        options: ["Sets store items in sorted order", "Lists check every item twice", "Sets use less memory", "Set lookup uses a hash and is roughly constant time"],
        answer: 3, why: "Hashing jumps straight to the item instead of scanning from the start." },
      { q: "What is the first step when code feels slow?",
        options: ["Add more threads", "Measure with a profiler or timeit to find the real hotspot", "Rewrite the whole program in another language", "Delete all comments"],
        answer: 1, why: "Guessing wastes effort; measurement shows where the time actually goes." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import timeit\nt = timeit.timeit("[x * x for x in range(100)]", number=100)\nprint(t > 0)', options: ["Error", "True", "False", "0"], answer: 1,
      hint: "A timing is always a positive number of seconds." }
  },
  {
    id: "a78", section: "power-lab", track: "advanced", title: "Caching Strategies: lru_cache & Redis Intro",
    explain: "Caching means remembering an answer instead of recomputing it. functools.lru_cache remembers function results in memory, while Redis is a separate in-memory server that many processes — or many machines — can share, with keys that expire automatically.",
    takeaways: ["`@lru_cache(maxsize=128)` memoizes a function: repeated calls with the same arguments return instantly.", "`fn.cache_info()` shows hits, misses, and size so you can prove the cache is working.", "Redis is a shared in-memory key-value store with expiry (TTL); use it when the cache must outlive one process."],
    code: 'from functools import lru_cache\n\ncalls = []\n\n@lru_cache(maxsize=128)\ndef square(n):\n    calls.append(n)\n    return n * n\n\nprint(square(5), square(5), square(6))\nprint("computed:", len(calls))\nprint(square.cache_info().hits)',
    quiz: [
      { q: "What does @lru_cache do to a function?",
        options: ["Deletes the function after one call", "Saves results to a database file", "Remembers past results so repeated calls with the same arguments skip the work", "Makes the function run in parallel"],
        answer: 2, why: "The cache stores argument-to-result pairs and replays them on a hit." },
      { q: "In the example, why is len(calls) 2 after three calls?",
        options: ["The second square(5) was a cache hit, so the function body ran only twice", "square(6) was skipped", "lru_cache drops the first call", "calls only records even numbers"],
        answer: 0, why: "square(5) computed once, then hit the cache; square(6) computed once." },
      { q: "When would you pick Redis over lru_cache?",
        options: ["When you only cache one value", "When you want the slowest possible cache", "When the cache must be shared across processes or machines and survive restarts", "When the function has no arguments"],
        answer: 2, why: "lru_cache lives inside one process; Redis is a shared server with expiry." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from functools import lru_cache\n\n@lru_cache(maxsize=10)\ndef double(n):\n    return n * 2\n\nprint(double(3), double(3))\nprint(double.cache_info().hits)', options: ["6 6\n0", "6 3\n1", "Error", "6 6\n1"], answer: 3,
      hint: "The second call with 3 is a hit, not a recomputation." }
  },
  {
    id: "a79", section: "object-castle", track: "advanced", title: "Design Patterns: Singleton, Factory, Observer",
    explain: "Design patterns are battle-tested shapes for common problems. Singleton shares one instance, Factory picks which class to build, and Observer lets many listeners react when something changes — like subscribers to a channel.",
    takeaways: ["Singleton: override `__new__` so every call returns the same instance.", "Factory: a function that chooses and returns the right object for a given key.", "Observer: keep a list of subscriber callbacks and call each one when state changes."],
    code: 'class News:\n    def __init__(self):\n        self.fans = []\n    def subscribe(self, fn):\n        self.fans.append(fn)\n    def publish(self, msg):\n        for fn in self.fans:\n            fn(msg)\n\nfeed = News()\nfeed.subscribe(lambda m: print("Ava got:", m))\nfeed.subscribe(lambda m: print("Bo got:", m))\nfeed.publish("New lesson!")',
    quiz: [
      { q: "What problem does the Observer pattern solve?",
        options: ["Creating exactly one instance of a class", "Sorting a list quickly", "Hiding a password from the code", "Letting many listeners react when one object changes"],
        answer: 3, why: "Observers subscribe once, then get notified on every change." },
      { q: "What does a Factory function return?",
        options: ["Nothing, it only prints", "The right kind of object for the key you pass in", "Always the same single instance", "A list of all classes"],
        answer: 1, why: "The factory decides which class to instantiate based on its input." },
      { q: "When is Singleton the wrong choice?",
        options: ["When the class has only one method", "When the program is small", "When the instance is created lazily", "When you actually need several independent instances with different state"],
        answer: 3, why: "Forcing one shared instance makes independent state impossible." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'def make_animal(kind):\n    return {"cat": "meow", "dog": "woof"}.get(kind, "...")\n\nprint(make_animal("cat"), make_animal("dog"))', options: ["Error", "meow woof", "cat dog", "meow meow"], answer: 1,
      hint: "The dictionary maps each key to its sound." }
  },
  {
    id: "a80", section: "object-castle", track: "advanced", title: "Design Patterns: Strategy & Adapter",
    explain: "Strategy swaps whole behaviours at runtime — pick a discount rule like you pick a playlist. Adapter wraps an old interface so it fits a new one, like a travel plug adapter, so legacy code can work with modern callers.",
    takeaways: ["Strategy: store behaviours (functions) in a dict and pick one by name at runtime.", "Swapping a strategy needs no if/elif chain and no edits to the caller.", "Adapter: wrap an object with an incompatible method and expose the method your code expects."],
    code: 'def standard(price):\n    return price\n\ndef student(price):\n    return price * 0.8\n\ndef vip(price):\n    return price * 0.7\n\nstrategies = {"standard": standard, "student": student, "vip": vip}\nprint(strategies["student"](100))\nprint(strategies["vip"](100))',
    quiz: [
      { q: "What is the Strategy pattern?",
        options: ["Choosing a behaviour (function) at runtime instead of hard-coding if/elif branches", "Making a class with only one instance", "Copying an object deeply", "Running code in parallel threads"],
        answer: 0, why: "Strategies are interchangeable behaviours selected by a key at call time." },
      { q: "What does an Adapter do?",
        options: ["Converts JSON to CSV", "Deletes unused methods from a class", "Wraps an object with an old interface so it matches the interface callers expect", "Speeds up a slow function with caching"],
        answer: 2, why: "The adapter translates calls, so legacy code works without being rewritten." },
      { q: "Why is a dict of functions a good way to implement strategies in Python?",
        options: ["Functions are first-class, so a dict lookup picks the behaviour cleanly", "Dicts are faster than classes in every case", "It prevents all bugs", "It is the only way Python allows"],
        answer: 0, why: "A dict maps names to functions directly, with no class ceremony." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'class OldPrinter:\n    def old_print(self, text):\n        return "OLD: " + text\n\nclass Adapter:\n    def __init__(self, old):\n        self.old = old\n    def print(self, text):\n        return self.old.old_print(text)\n\nprint(Adapter(OldPrinter()).print("hi"))', options: ["None", "Error", "OLD: hi", "hi"], answer: 2,
      hint: "The adapter forwards print() to the old method, which adds its prefix." }
  },
  {
    id: "a81", section: "power-lab", track: "advanced", title: "Code Quality: Linting with Ruff & Black",
    explain: "Linting catches bugs before they run: Ruff flags unused imports, undefined names, and style slips in milliseconds, while Black reformats your code to one consistent style. Together they make every file look like it was written by the same careful developer.",
    takeaways: ["Ruff is a linter: it flags unused imports, undefined names, and style problems without running your code.", "Black is a formatter: it rewrites spacing and line breaks to one standard style.", "Run both in CI so messy code never merges; `py_compile` is a quick syntax sanity check."],
    code: 'import py_compile, os\n\nopen("lint_demo.py", "w").write("x = 1\\nprint(x + 1)\\n")\npy_compile.compile("lint_demo.py", doraise=True)\nprint("compiles ok:", os.path.exists("lint_demo.py"))\nprint("ruff would flag: unused import")\nprint("black would format: x=1  ->  x = 1")',
    quiz: [
      { q: "What does a linter like Ruff do?",
        options: ["Deletes unused files", "Flags likely bugs and style problems without running the code", "Runs your program faster", "Formats code automatically"],
        answer: 1, why: "Linting is static analysis: it reads the code and reports problems." },
      { q: "What is Black for?",
        options: ["Finding security vulnerabilities", "Running unit tests", "Installing packages", "Reformatting code to one consistent style"],
        answer: 3, why: "Black only changes formatting, never behaviour." },
      { q: "Why run Ruff and Black in CI (continuous integration)?",
        options: ["CI replaces the need to write tests", "So style and lint problems are caught on every push before they merge", "So tests run slower", "So code is hidden from reviewers"],
        answer: 1, why: "Automated checks enforce quality on every change, not just when someone remembers." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import py_compile\nopen("ok.py", "w").write("a = 2\\nprint(a)\\n")\npy_compile.compile("ok.py", doraise=True)\nprint("ok")', options: ["ok", "Error", "None", "2"], answer: 0,
      hint: "doraise only raises on a syntax error, and this file is valid." }
  },
  {
    id: "a82", section: "launch-pad", track: "advanced", title: "Git for Python Devs: A Practical Workflow",
    explain: "Git is how real Python projects stay sane: a branch per feature, small commits with clear messages, and pull requests for review. The daily loop is pull, branch, commit, push, and open a pull request — never commit straight to main.",
    takeaways: ["`git pull` first, so your branch starts from the latest main.", "One branch per feature (`feature/login-fix`); small commits with messages like `Add login validation`.", "Never force-push shared branches; merge or rebase, then open a pull request for review."],
    code: 'import subprocess\n\nresult = subprocess.run(["git", "--version"], capture_output=True, text=True)\nprint(result.stdout.strip())\nprint("branch: feature/add-lesson")\nprint("main is protected: push via pull request")',
    quiz: [
      { q: "Why pull before starting new work?",
        options: ["It is required by Python", "It makes commits smaller", "So your branch starts from the latest main and avoids needless conflicts", "Pulling deletes your local changes"],
        answer: 2, why: "Working from stale main guarantees merge conflicts later." },
      { q: "What is a pull request for?",
        options: ["Proposing a branch for review before it merges into main", "Downloading a repository", "Deleting a branch", "Backing up your files"],
        answer: 0, why: "A pull request is the review gate: discussion, tests, and approval before merging." },
      { q: "Why should you avoid force-pushing a shared branch?",
        options: ["It deletes the remote repository", "It only works on main", "It rewrites history other people have already based work on", "It is slower than a normal push"],
        answer: 2, why: "Force-push can strand teammates' commits; it is safe only on your own private branch." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import re\nprint(bool(re.fullmatch(r"[a-z0-9/-]+", "feature/login-fix")))', options: ["feature", "Error", "True", "False"], answer: 2,
      hint: "Every character in the branch name is a lowercase letter, digit, slash, or hyphen." }
  },
  {
    id: "a83", section: "launch-pad", track: "advanced", title: "Capstone: REST API with Flask & SQLite",
    explain: "This capstone ties it together: a Flask REST API backed by SQLite. Routes return JSON, POST adds a note, GET lists them — and you test it all with Flask's built-in test client, no server needed.",
    takeaways: ["`app.test_client()` exercises routes in-process: no server, no network, instant tests.", "Return JSON with `jsonify(...)` and the right status code (201 for a created resource).", "`request.get_json()` reads the JSON body a client POSTed."],
    code: 'from flask import Flask, jsonify, request\n\napp = Flask(__name__)\nnotes = []\n\n@app.route("/notes", methods=["GET"])\ndef list_notes():\n    return jsonify(notes)\n\n@app.route("/notes", methods=["POST"])\ndef add_note():\n    notes.append(request.get_json()["text"])\n    return jsonify({"added": notes[-1]}), 201\n\nclient = app.test_client()\nprint(client.post("/notes", json={"text": "Learn Flask"}).status_code)\nprint(client.get("/notes").get_json())',
    quiz: [
      { q: "What does app.test_client() give you?",
        options: ["A real web browser", "A production server", "A database connection", "A way to call your routes in-process without starting a server"],
        answer: 3, why: "The test client simulates HTTP requests directly against the app object." },
      { q: "Which status code should a successful POST that creates a resource return?",
        options: ["500", "201", "200", "404"],
        answer: 1, why: "201 Created is the standard code for a newly created resource." },
      { q: "How do you read JSON a client sent in a POST body?",
        options: ["request.args['text']", "json.loads(app)", "flask.read_json()", "request.get_json()"],
        answer: 3, why: "get_json parses the request body into a Python dict." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from flask import Flask, jsonify\napp = Flask(__name__)\n\n@app.route("/ping")\ndef ping():\n    return jsonify({"status": "ok"})\n\nclient = app.test_client()\nprint(client.get("/ping").status_code)\nprint(client.get("/ping").get_json())', options: ["404\n{}", "200\nok", "Error", "200\n{'status': 'ok'}"], answer: 3,
      hint: "The route exists, and jsonify turns the dict into a JSON response." }
  },
  {
    id: "a84", section: "data-lab", track: "advanced", title: "Capstone: Data Analysis Project (Real Dataset)",
    explain: "A data analysis project follows one shape: load a small dataset, clean it, group it, and answer a question with numbers. Here the dataset is built inline, so the whole analysis runs anywhere — the same groupby pattern scales to a real CSV later.",
    takeaways: ["Build a DataFrame from inline lists or dicts: `pd.DataFrame({\"city\": [...], \"sales\": [...]})`.", "`df.groupby(\"city\")[\"sales\"].mean()` answers 'which city sells more on average?'.", "Always print row counts and a quick summary before trusting any result."],
    code: 'import pandas as pd\n\ndata = {"city": ["Pune", "Pune", "Mumbai", "Mumbai"], "sales": [120, 180, 200, 150]}\ndf = pd.DataFrame(data)\nprint(df.groupby("city")["sales"].mean().to_dict())\nprint("rows:", len(df))',
    quiz: [
      { q: "What does df.groupby('city')['sales'].mean() compute?",
        options: ["The average sales for each city", "The total sales across all cities", "The highest single sale", "The number of cities"],
        answer: 0, why: "groupby splits rows by city, then mean averages sales within each group." },
      { q: "Why check len(df) before analysing?",
        options: ["pandas requires it", "It sorts the data", "To confirm the data actually loaded and spot an empty or truncated frame", "It makes groupby faster"],
        answer: 2, why: "An empty or half-loaded frame silently produces wrong answers." },
      { q: "What is the first step of a data analysis project?",
        options: ["Load the data and look at it before computing anything", "Build the final chart", "Write the conclusion", "Delete missing values blindly"],
        answer: 0, why: "You need to see the shape, columns, and quirks before any analysis is trustworthy." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import pandas as pd\ndata = {"city": ["Pune", "Pune", "Mumbai", "Mumbai"], "sales": [120, 180, 200, 150]}\ndf = pd.DataFrame(data)\nprint(df["sales"].sum())', options: ["Error", "650", "600", "150"], answer: 1,
      hint: "Add all four sales numbers together." }
  },
  {
    id: "a85", section: "launch-pad", track: "advanced", title: "Capstone: Full-Stack Mini App",
    explain: "A full-stack mini app is a small web app end to end: Flask serves a page, the page is rendered from a template, and the test client proves it works. The pattern is the same one big apps use — routes, templates, data — just smaller.",
    takeaways: ["`render_template_string(\"<h1>{{ title }}</h1>\", title=\"...\")` renders a template from a string.", "Routes return HTML for browsers and JSON for APIs; one Flask app can serve both.", "Test the rendered page with `client.get(\"/\")` and check the status code and body."],
    code: 'from flask import Flask, render_template_string\n\napp = Flask(__name__)\n\n@app.route("/")\ndef home():\n    return render_template_string("<h1>{{ title }}</h1>", title="Skillzify")\n\nclient = app.test_client()\nresp = client.get("/")\nprint(resp.status_code)\nprint(b"Skillzify" in resp.data)',
    quiz: [
      { q: "What does render_template_string do?",
        options: ["Starts the Flask server", "Renders a Jinja template given as a string, filling in the variables", "Reads a template file from disk", "Sends an email"],
        answer: 1, why: "It takes the template text directly instead of loading a file." },
      { q: "In a Flask app, what is the difference between a route returning HTML and one returning JSON?",
        options: ["HTML routes are faster", "JSON routes need no test client", "There is no difference", "HTML is for browsers to display; JSON is data for other programs to consume"],
        answer: 3, why: "Same routing, different payload: pages for people, JSON for clients." },
      { q: "How do you check what a route actually returned in a test?",
        options: ["Open a browser", "resp.status_code and resp.data on the test client response", "Print the Flask app object", "Read the server log file"],
        answer: 1, why: "The response object carries the status and the raw body bytes." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from flask import Flask\napp = Flask(__name__)\n\n@app.route("/hello/<name>")\ndef hello(name):\n    return "Hello, " + name + "!"\n\nclient = app.test_client()\nprint(client.get("/hello/Ava").data.decode())', options: ["Hello, name!", "404", "Error", "Hello, Ava!"], answer: 3,
      hint: "The <name> part of the URL is captured and passed to the function." }
  },
  {
    id: "a86", section: "launch-pad", track: "advanced", title: "Asyncio: Web Scraping at Scale",
    explain: "Scraping one page is easy; scraping a hundred pages one by one is slow, because each request mostly waits. asyncio lets hundreds of fetches wait at the same time, so the whole job finishes in roughly the time of the slowest single page.",
    takeaways: ["`asyncio.gather(*tasks)` runs many coroutines concurrently and collects their results in order.", "While one fetch awaits a response, the event loop runs the others — that is where the speedup comes from.", "Always cap concurrency (a semaphore) and respect rate limits, or you will hammer the server."],
    code: 'import asyncio, re\n\npages = {"page1": "<h1>Python</h1>", "page2": "<h1>Flask</h1>", "page3": "<h1>asyncio</h1>"}\n\nasync def fetch(name, html):\n    await asyncio.sleep(0.01)\n    return re.search(r"<h1>(.*?)</h1>", html).group(1)\n\nasync def main():\n    titles = await asyncio.gather(*(fetch(n, h) for n, h in pages.items()))\n    print(titles)\n\nasyncio.run(main())',
    quiz: [
      { q: "What does asyncio.gather(*tasks) do?",
        options: ["Runs them on separate CPU cores", "Cancels all but the first task", "Runs the coroutines concurrently and returns their results in order", "Runs them one by one in sequence"],
        answer: 2, why: "gather schedules all tasks on the event loop and collects results in task order." },
      { q: "Why is asyncio faster than a loop for scraping many pages?",
        options: ["While one fetch waits for a response, others run instead of idling", "It downloads pages at a higher bandwidth", "It skips parsing the HTML", "It uses multiple CPUs"],
        answer: 0, why: "Network scraping is wait-bound; asyncio overlaps the waiting." },
      { q: "Why cap concurrency with a semaphore when scraping at scale?",
        options: ["asyncio requires one for every task", "It reduces the HTML size", "To avoid overwhelming the server and getting blocked", "Semaphores make parsing faster"],
        answer: 2, why: "Unbounded concurrency looks like an attack; polite scrapers limit in-flight requests." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import asyncio\n\nasync def work(n):\n    await asyncio.sleep(0.01)\n    return n * 2\n\nasync def main():\n    print(await asyncio.gather(work(1), work(2)))\n\nasyncio.run(main())', options: ["[2, 4]", "[1, 2]", "[4, 2]", "Error"], answer: 0,
      hint: "gather returns results in the order the tasks were given." }
  },
  {
    id: "a87", section: "data-lab", track: "advanced", title: "ML: Text Classification Project",
    explain: "Text classification turns words into a label: positive or negative review, spam or not spam. CountVectorizer turns text into word counts, and a Naive Bayes model learns which words point at which label — a complete ML project in a few lines.",
    takeaways: ["`CountVectorizer()` turns text into a table of word counts the model can learn from.", "`MultinomialNB` is a fast, solid first model for word-count text data.", "Fit the vectorizer on training text only, then `transform` new text with the same vectorizer."],
    code: 'from sklearn.feature_extraction.text import CountVectorizer\nfrom sklearn.naive_bayes import MultinomialNB\n\ntexts = ["I love this course", "great lesson, loved it", "boring and confusing", "waste of time, awful"]\nlabels = ["pos", "pos", "neg", "neg"]\nvec = CountVectorizer()\nmodel = MultinomialNB()\nmodel.fit(vec.fit_transform(texts), labels)\nprint(model.predict(vec.transform(["loved the lesson"]))[0])\nprint(model.predict(vec.transform(["boring lesson"]))[0])',
    quiz: [
      { q: "What does CountVectorizer do?",
        options: ["Counts the characters in a file", "Removes stop words only", "Translates text to another language", "Turns text into a table of word counts"],
        answer: 3, why: "It builds a vocabulary and counts how often each word appears in each document." },
      { q: "Why must new text go through the same fitted vectorizer?",
        options: ["The model stores the raw text", "So its word columns line up exactly with what the model was trained on", "It makes predictions faster", "New text cannot be vectorized twice"],
        answer: 1, why: "A fresh vectorizer would build a different vocabulary and the columns would not match." },
      { q: "Why is MultinomialNB a good first model for text?",
        options: ["It never makes mistakes", "It needs no training data", "It only works on images", "It is fast, simple, and works well on word-count features"],
        answer: 3, why: "Naive Bayes is a strong baseline for bag-of-words classification." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from sklearn.feature_extraction.text import CountVectorizer\nfrom sklearn.naive_bayes import MultinomialNB\ntexts = ["I love this course", "great lesson, loved it", "boring and confusing", "waste of time, awful"]\nlabels = ["pos", "pos", "neg", "neg"]\nvec = CountVectorizer()\nmodel = MultinomialNB()\nmodel.fit(vec.fit_transform(texts), labels)\nprint(model.predict(vec.transform(["great course"]))[0])', options: ["great", "Error", "pos", "neg"], answer: 2,
      hint: "The word great appeared only in a positive example." }
  },
  {
    id: "a88", section: "launch-pad", track: "advanced", title: "Web: Deploying a Flask App",
    explain: "Deploying means your Flask app runs on a server anyone can reach. The checklist is short: a production server like Gunicorn instead of the dev server, a PORT from the environment, a /health endpoint to prove the app is alive, and your secrets in environment variables — never in the code.",
    takeaways: ["Never deploy with the Flask dev server; use a production server such as Gunicorn.", "Read the port from the environment: `os.environ.get(\"PORT\", \"5000\")`.", "Add a `/health` endpoint returning `{\"status\": \"ok\"}` so the platform can check the app is alive."],
    code: 'import os\nfrom flask import Flask\n\napp = Flask(__name__)\n\n@app.route("/health")\ndef health():\n    return {"status": "ok"}\n\nclient = app.test_client()\nprint(client.get("/health").status_code)\nprint(client.get("/health").get_json())\nprint("port:", os.environ.get("PORT", "5000"))',
    quiz: [
      { q: "Why not deploy with Flask's built-in development server?",
        options: ["It is single-threaded, insecure, and not built for production traffic", "It cannot serve JSON", "It costs money", "It only runs on Windows"],
        answer: 0, why: "The dev server is a debugging convenience; production needs Gunicorn or similar." },
      { q: "Why read PORT from the environment instead of hard-coding 5000?",
        options: ["Port 5000 is banned in production", "Flask requires it", "The hosting platform assigns the port your app must listen on", "Environment variables are faster"],
        answer: 2, why: "Platforms like Render assign a port dynamically; hard-coding breaks the deploy." },
      { q: "What is a /health endpoint for?",
        options: ["Letting the platform and monitoring check the app is alive and responding", "Showing users a status page", "Logging users in", "Backing up the database"],
        answer: 0, why: "Health checks ping /health and restart or alert if it stops answering." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'from flask import Flask\napp = Flask(__name__)\n\n@app.route("/health")\ndef health():\n    return {"status": "ok"}\n\nclient = app.test_client()\nprint(client.get("/health").get_json()["status"])', options: ["ok", "200", "healthy", "Error"], answer: 0,
      hint: "get_json() gives a dict; take its status value." }
  },
  {
    id: "a89", section: "data-lab", track: "advanced", title: "Data Science: Time Series Basics",
    explain: "Time series data is indexed by time: daily temperatures, monthly sales, hourly traffic. pandas gives the index a real date type, so you can resample, slice by date, and smooth noise with a rolling average.",
    takeaways: ["`pd.date_range(\"2026-11-01\", periods=7)` builds a week of dates for a Series index.", "`series.rolling(3).mean()` smooths noise with a 3-day moving average.", "Time series plots and averages only make sense when the index is sorted by time."],
    code: 'import pandas as pd\n\ntemps = pd.Series([22, 23, 25, 24, 26, 28, 27], index=pd.date_range("2026-11-01", periods=7))\nprint(temps.mean())\nprint(list(temps.rolling(3).mean().dropna().round(1)))',
    quiz: [
      { q: "Why index a time series with real dates instead of 0, 1, 2?",
        options: ["It makes the mean larger", "So pandas can slice by date, resample, and plot on a time axis", "Dates use less memory", "Integers are not allowed as an index"],
        answer: 1, why: "A datetime index unlocks date slicing, resampling, and time-aware plotting." },
      { q: "What does rolling(3).mean() compute?",
        options: ["The mean of the first 3 values only", "The mean of every third value", "A 3-day forecast", "A moving average over each window of 3 consecutive values"],
        answer: 3, why: "Each output is the mean of the current value and the two before it." },
      { q: "Why does rolling(3) produce NaN for the first two values?",
        options: ["The data starts on a weekend", "A 3-value window does not exist until the third value arrives", "The first two values are missing", "rolling always drops the first two rows"],
        answer: 1, why: "The window needs 3 values, so positions 0 and 1 have nothing complete to average." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import pandas as pd\ntemps = pd.Series([22, 23, 25, 24, 26, 28, 27], index=pd.date_range("2026-11-01", periods=7))\nprint(temps.iloc[-1] - temps.iloc[0])', options: ["Error", "5", "7", "27"], answer: 1,
      hint: "Last value minus first value: 27 minus 22." }
  },
  {
    id: "a90", section: "launch-pad", track: "advanced", title: "Capstone: Personal AI Assistant CLI",
    explain: "This capstone builds a tiny personal assistant as a command-line tool: argparse reads the command, a small rule-based brain picks the reply, and the whole thing runs from the terminal. It is the skeleton every bigger assistant starts from — commands in, answers out.",
    takeaways: ["`argparse` turns `assistant remind` into a parsed command your code can act on.", "A rule-based brain is just a dict of commands to replies — start simple, add rules as you go.", "Keep the brain a pure function (`reply(task)`) so you can test it without the CLI."],
    code: 'import argparse\n\ndef reply(task):\n    answers = {"remind": "Reminder set for 6 pm.", "joke": "Why do programmers prefer dark mode? Less light to debug."}\n    return answers.get(task, "I can remind or joke - try one of those.")\n\np = argparse.ArgumentParser()\np.add_argument("task")\nargs = p.parse_args(["remind"])\nprint(reply(args.task))',
    quiz: [
      { q: "Why keep the assistant brain as a pure function reply(task)?",
        options: ["argparse requires it", "It saves the replies to disk", "So you can test it directly without going through the CLI", "Pure functions run faster"],
        answer: 2, why: "A pure function takes a string and returns a string — trivially testable." },
      { q: "How does argparse know the user typed 'remind'?",
        options: ["parse_args reads the command-line words into args.task", "It scans the source code", "It asks with input()", "It reads an environment variable"],
        answer: 0, why: "The positional argument 'task' captures the first word after the program name." },
      { q: "What is the sensible next step after a rule-based assistant works?",
        options: ["Rewrite it in another language", "Remove argparse", "Add more commands, then swap the brain for a real model API when needed", "Delete the rules immediately"],
        answer: 2, why: "Grow the command set first; an LLM backend slots into the same reply() shape later." }
    ],
    challenge: { type: "predict", prompt: "What will this print?",
      code: 'import argparse\n\ndef reply(task):\n    answers = {"remind": "Reminder set for 6 pm.", "joke": "Why do programmers prefer dark mode? Less light to debug."}\n    return answers.get(task, "I can remind or joke - try one of those.")\n\np = argparse.ArgumentParser()\np.add_argument("task")\nargs = p.parse_args(["joke"])\nprint(reply(args.task))', options: ["Reminder set for 6 pm.", "I can remind or joke - try one of those.", "Error", "Why do programmers prefer dark mode? Less light to debug."], answer: 3,
      hint: "The joke key maps to the joke string." }
  }
];
