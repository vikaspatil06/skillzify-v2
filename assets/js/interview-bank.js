/* ============================================================
   Skillzify AI Interview Intelligence — question bank (Phase 1)
   Authored interview questions with rubric key points and
   follow-up trees. The interview engine (interview.js) drives
   its adaptive controller off this data:
   - points[]: the rubric key points a strong answer covers.
     Used by the local fallback scorer (token overlap), by the
     "probe the missing point" follow-ups, and as the rubric the
     AI scorer (server mode interview_score) judges against.
   - followups[]: {kind:"deeper"} = harder extension asked when
     an answer is strong; {kind:"probe", point:n} = asks about
     rubric point n when an answer is partial.
   Coding problems carry visible + hidden tests in the same
   {run, expect} shape as practice-data.js (run = a Python
   expression, expect = the exact str() of its value), plus a
   reference `solution` the bank's own test-suite runs against
   every test (the solution is never shown to candidates).
   Exposes window.SkillzifyInterviewBank. ES5, no dependencies.
   ============================================================ */
(function () {
  "use strict";

  var TECHNICAL = [
    /* ---------- Python fundamentals ---------- */
    { id: "f1", topic: "fundamentals", skill: "Python Fundamentals", tier: 1,
      q: "What is the difference between a list and a tuple in Python? When would you use each?",
      points: ["lists are mutable, tuples are immutable", "tuples can be dictionary keys / hashed, lists cannot", "lists suit data that changes; tuples suit fixed records like coordinates"],
      followups: [
        { kind: "deeper", q: "A tuple containing a list — is that tuple really immutable? What can still change?" },
        { kind: "probe", point: 1, q: "Why exactly can a list not be used as a dictionary key, while a tuple can?" }
      ] },
    { id: "f2", topic: "fundamentals", skill: "Python Fundamentals", tier: 1,
      q: "If I write a = [1, 2], then b = a, then b.append(3) — what is a afterwards, and why?",
      points: ["b is the same object as a, not a copy", "a becomes [1, 2, 3]", "assignment binds a name to an object; use list(a), a[:] or copy() for a real copy"],
      followups: [
        { kind: "deeper", q: "Now the list contains a nested list and I use copy.copy(). What is still shared, and how does deepcopy differ?" },
        { kind: "probe", point: 2, q: "How would you make b an independent copy so changing it never touches a?" }
      ] },
    { id: "f3", topic: "fundamentals", skill: "Python Fundamentals", tier: 2,
      q: "What goes wrong with def add_item(item, box=[]) — a mutable default argument — and how do you fix it?",
      points: ["the default is created once, when the function is defined", "the same list is shared across calls, so items leak between calls", "fix: default to None and create the list inside the function"],
      followups: [
        { kind: "deeper", q: "Why does Python evaluate defaults once at definition time instead of on every call?" },
        { kind: "probe", point: 2, q: "Show me the standard fix — what does the signature and the first lines look like?" }
      ] },
    { id: "f4", topic: "fundamentals", skill: "Python Fundamentals", tier: 2,
      q: "What is the difference between == and is in Python? When must you use is?",
      points: ["== compares values, is compares identity (same object)", "interning makes small ints and short strings sometimes identical — an implementation detail, not a guarantee", "use is for None and singletons; == for value comparison"],
      followups: [
        { kind: "deeper", q: "Why might x = 1000; y = 1000 give x is y as False while 10 is 10 gives True?" },
        { kind: "probe", point: 0, q: "In plain words: what does each operator actually compare?" }
      ] },
    { id: "f5", topic: "fundamentals", skill: "Python Fundamentals", tier: 1,
      q: "What is the difference between d[key] and d.get(key) for a dictionary? When do you prefer get?",
      points: ["d[key] raises KeyError when the key is missing", "get returns None or a supplied default instead of raising", "get suits optional keys and counting patterns like counts.get(k, 0)"],
      followups: [
        { kind: "deeper", q: "What does setdefault do that get does not, and when is that the better tool?" },
        { kind: "probe", point: 1, q: "What exactly does get return when the key is absent and no default is given?" }
      ] },
    { id: "f6", topic: "fundamentals", skill: "Python Fundamentals", tier: 3,
      q: "What is a generator in Python, and what problem does it solve compared with building a list?",
      points: ["generators produce values lazily, one at a time, using yield", "memory stays roughly constant instead of holding the whole sequence", "a generator is a one-pass iterator — it is exhausted after one full pass"],
      followups: [
        { kind: "deeper", q: "When would a generator actually be the wrong choice — what operations does it not support?" },
        { kind: "probe", point: 0, q: "What does the yield keyword do to a function's execution when it is reached?" }
      ] },
    { id: "f7", topic: "fundamentals", skill: "Python Fundamentals", tier: 1,
      q: "Which values are falsy in Python, and what does short-circuit evaluation mean for and / or?",
      points: ["falsy: False, None, 0, empty string, empty list/dict/set", "and / or return one of their operands, not always True or False", "evaluation stops as soon as the result is decided — the right side may never run"],
      followups: [
        { kind: "deeper", q: "What does the expression x or 'default' actually return when x is an empty string, and why is that useful?" },
        { kind: "probe", point: 2, q: "Give me an example where short-circuiting prevents an error." }
      ] },
    { id: "f8", topic: "fundamentals", skill: "Python Fundamentals", tier: 3,
      q: "Explain *args and **kwargs. What types do they collect into, and what ordering rules apply in a call?",
      points: ["*args collects extra positional arguments into a tuple", "**kwargs collects extra keyword arguments into a dict", "order in a definition: positional, *args, keyword-only, **kwargs; unpacking with * and ** also works in calls"],
      followups: [
        { kind: "deeper", q: "How do you force an argument to be keyword-only, and why would an API designer do that?" },
        { kind: "probe", point: 1, q: "If a caller passes name='x', age=3 — where do those land, and in what data structure?" }
      ] },

    /* ---------- OOP ---------- */
    { id: "o1", topic: "oop", skill: "OOP", tier: 1,
      q: "What is the difference between a class attribute and an instance attribute in Python?",
      points: ["class attributes are shared by all instances and live on the class", "instance attributes belong to one object and shadow the class attribute of the same name", "mutating a mutable class attribute through an instance changes it for everyone"],
      followups: [
        { kind: "deeper", q: "When is a shared class attribute actually the right design, rather than a bug waiting to happen?" },
        { kind: "probe", point: 0, q: "If I read obj.x and the instance has no x, where does Python look next?" }
      ] },
    { id: "o2", topic: "oop", skill: "OOP", tier: 1,
      q: "Explain inheritance in Python. What does super() do, and when would you choose composition instead?",
      points: ["a subclass reuses and extends a parent class (is-a relationship)", "super() calls the parent implementation, e.g. parent __init__ or an overridden method", "composition (has-a) is looser and avoids deep hierarchies when there is no true is-a relationship"],
      followups: [
        { kind: "deeper", q: "What can go wrong with a deep inheritance hierarchy as a codebase grows?" },
        { kind: "probe", point: 1, q: "Inside a child's __init__, what exactly does super().__init__() run?" }
      ] },
    { id: "o3", topic: "oop", skill: "OOP", tier: 2,
      q: "Python has no true private variables. How is encapsulation usually done, and what does @property add?",
      points: ["a single underscore is a convention: internal, touch at your own risk", "double underscore triggers name mangling — it is about avoiding subclass clashes, not real privacy", "@property turns attribute access into a method call, allowing validation while keeping the .attr syntax"],
      followups: [
        { kind: "deeper", q: "Why does Python prefer convention over enforced privacy — what is the philosophy behind it?" },
        { kind: "probe", point: 2, q: "With a property setter, what can you enforce that a plain attribute cannot?" }
      ] },
    { id: "o4", topic: "oop", skill: "OOP", tier: 2,
      q: "What are dunder methods? Contrast __str__ and __repr__, and say what __eq__ changes by default.",
      points: ["dunder methods hook objects into Python's protocols (len, str, +, ==, iteration)", "__str__ is the human-readable form; __repr__ is the developer/debug form and should be unambiguous", "by default == is identity; defining __eq__ compares by value — and makes instances unhashable unless __hash__ is also defined"],
      followups: [
        { kind: "deeper", q: "Why does defining __eq__ set __hash__ to None, and what breaks when you then put objects in a set?" },
        { kind: "probe", point: 1, q: "When you print a list of your objects, which of the two methods does Python actually call on each?" }
      ] },
    { id: "o5", topic: "oop", skill: "OOP", tier: 3,
      q: "What is the MRO in Python, and how does it solve the diamond problem in multiple inheritance?",
      points: ["the Method Resolution Order is the linearised order Python searches classes for a method", "Python uses C3 linearisation, which keeps local precedence and monotonicity", "in a diamond, each class is visited exactly once, so the shared ancestor's method runs once via cooperative super()"],
      followups: [
        { kind: "deeper", q: "What makes multiple inheritance cooperative — what must every class in the chain do with super()?" },
        { kind: "probe", point: 0, q: "How can you inspect a class's MRO at runtime?" }
      ] },
    { id: "o6", topic: "oop", skill: "OOP", tier: 2,
      q: "Contrast instance methods, @classmethod and @staticmethod. When is each the right choice?",
      points: ["instance methods receive self and work on one object's state", "classmethod receives cls — used for alternative constructors / factory methods", "staticmethod receives neither — a namespaced function that logically belongs to the class"],
      followups: [
        { kind: "deeper", q: "Why does a classmethod factory behave better than a plain constructor when subclasses get involved?" },
        { kind: "probe", point: 1, q: "Give me a concrete factory example — what would the classmethod's body look like?" }
      ] },

    /* ---------- Data structures & algorithms ---------- */
    { id: "d1", topic: "dsa", skill: "Data Structures & Algorithms", tier: 1,
      q: "For a Python list, what is the time complexity of append, indexing lst[i], insert(0, x), and checking x in lst?",
      points: ["append is amortised O(1); indexing is O(1)", "insert at the front is O(n) — every element shifts", "membership test is O(n) — it scans until it finds the value"],
      followups: [
        { kind: "deeper", q: "If you need a queue with fast pops from the front, what do you use instead of a list, and why?" },
        { kind: "probe", point: 1, q: "Why is inserting at the front expensive while appending is cheap — what physically happens in memory?" }
      ] },
    { id: "d2", topic: "dsa", skill: "Data Structures & Algorithms", tier: 2,
      q: "How does a Python dictionary find a value by key so fast? What can make it slow down?",
      points: ["the key is hashed and the hash picks a bucket/slot — average lookup O(1)", "collisions (different keys, same slot) must be resolved and degrade lookups", "keys must be hashable/immutable; worst case degrades toward O(n)"],
      followups: [
        { kind: "deeper", q: "Why must dictionary keys be immutable — what breaks if a key changes after insertion?" },
        { kind: "probe", point: 0, q: "Walk me through a lookup step by step, from d[k] to the value." }
      ] },
    { id: "d3", topic: "dsa", skill: "Data Structures & Algorithms", tier: 1,
      q: "Stack versus queue: what is the ordering difference, and what does Python offer for each?",
      points: ["stack is LIFO (last in, first out); queue is FIFO (first in, first out)", "a list works as a stack with append/pop at the end", "use collections.deque for a queue — popleft is O(1), while list.pop(0) is O(n)"],
      followups: [
        { kind: "deeper", q: "Name one real algorithm that needs a stack and one that needs a queue." },
        { kind: "probe", point: 2, q: "Why is list.pop(0) slow, exactly?" }
      ] },
    { id: "d4", topic: "dsa", skill: "Data Structures & Algorithms", tier: 2,
      q: "What must be true of the data for binary search to work, and why is it O(log n)?",
      points: ["the data must be sorted (on the key being searched)", "each comparison discards half the remaining range", "the range halves every step, so the number of steps grows logarithmically"],
      followups: [
        { kind: "deeper", q: "Your array is unsorted and you must answer many searches. When is sorting first worth it?" },
        { kind: "probe", point: 0, q: "What goes wrong if you run binary search on unsorted data — does it error, or silently mislead?" }
      ] },
    { id: "d5", topic: "dsa", skill: "Data Structures & Algorithms", tier: 2,
      q: "What two things must every recursive function have, and what happens in Python if the recursion goes too deep?",
      points: ["a base case that stops the recursion", "each call must move toward the base case", "deep recursion hits Python's recursion limit / overflows the call stack — Python does no tail-call optimisation"],
      followups: [
        { kind: "deeper", q: "What is memoisation, and which recursive function does it famously rescue?" },
        { kind: "probe", point: 2, q: "Roughly how deep can Python recursion go by default, and what error do you get?" }
      ] },
    { id: "d6", topic: "dsa", skill: "Data Structures & Algorithms", tier: 3,
      q: "BFS versus DFS on a graph: how do they differ mechanically, and when is BFS the only correct choice?",
      points: ["BFS explores level by level using a queue; DFS dives deep using a stack or recursion", "BFS finds the shortest path (fewest edges) in an unweighted graph", "DFS suits topological ordering, cycle detection and backtracking; memory profiles differ"],
      followups: [
        { kind: "deeper", q: "Why does DFS not guarantee the shortest path in an unweighted graph?" },
        { kind: "probe", point: 1, q: "In an unweighted graph, why does the first time BFS reaches a node give the shortest route?" }
      ] },
    { id: "d7", topic: "dsa", skill: "Data Structures & Algorithms", tier: 3,
      q: "What does it mean that Python's sort is stable, and why does that matter? Also: sorted() versus list.sort()?",
      points: ["stable = equal elements keep their original relative order", "stability lets you sort by multiple keys in successive passes (least significant first)", "sorted() returns a new list; list.sort() sorts in place and returns None; both are O(n log n) Timsort"],
      followups: [
        { kind: "deeper", q: "How would you sort students by grade, then by name within a grade — two ways, using stability or a key tuple?" },
        { kind: "probe", point: 2, q: "A classic beginner bug: x = lst.sort(). What is x?" }
      ] },
    { id: "d8", topic: "dsa", skill: "Data Structures & Algorithms", tier: 2,
      q: "Explain the two-pointer technique with an example, and what it improves over the brute-force approach.",
      points: ["two indices move through the data (often toward each other or as a window) instead of nested loops", "classic example: pair with a target sum in a sorted array, or a sliding window over a subarray", "it typically cuts O(n^2) brute force down to O(n) by never moving a pointer backwards"],
      followups: [
        { kind: "deeper", q: "In the sorted pair-sum problem, why is it safe to move the right pointer left when the sum is too big?" },
        { kind: "probe", point: 0, q: "What property of the data makes the two-pointer trick valid for pair-sum?" }
      ] },

    /* ---------- Databases & SQL ---------- */
    { id: "s1", topic: "dbms", skill: "Databases & SQL", tier: 1,
      q: "What is the difference between a primary key and a foreign key?",
      points: ["a primary key uniquely identifies a row — unique and never NULL, one per table", "a foreign key stores a primary key of another table, linking rows across tables", "foreign keys enforce referential integrity — no orphan references"],
      followups: [
        { kind: "deeper", q: "What should happen to orders when the customer they belong to is deleted — and which mechanisms express that?" },
        { kind: "probe", point: 2, q: "What does referential integrity actually prevent?" }
      ] },
    { id: "s2", topic: "dbms", skill: "Databases & SQL", tier: 2,
      q: "Explain INNER JOIN versus LEFT JOIN. What do you get in each result for rows with no match?",
      points: ["INNER JOIN keeps only rows that match on both sides", "LEFT JOIN keeps every left row; unmatched right-side columns come back NULL", "finding left rows with NO match = LEFT JOIN plus WHERE right-key IS NULL"],
      followups: [
        { kind: "deeper", q: "How would you list customers who have never placed an order, in SQL?" },
        { kind: "probe", point: 1, q: "In a LEFT JOIN, what appears in the columns of the right table when there is no match?" }
      ] },
    { id: "s3", topic: "dbms", skill: "Databases & SQL", tier: 2,
      q: "What is a database index? Why not simply index every column?",
      points: ["an index (typically a B-tree) lets the database find rows by a value without scanning the whole table", "reads on indexed columns get much faster, especially joins and filters", "each index costs storage and slows writes — every insert/update must maintain it"],
      followups: [
        { kind: "deeper", q: "Which columns in an orders table would you index first, and why those?" },
        { kind: "probe", point: 2, q: "Explain the write cost: what exactly must the database update on each INSERT?" }
      ] },
    { id: "s4", topic: "dbms", skill: "Databases & SQL", tier: 3,
      q: "What is normalisation trying to achieve? And when would you deliberately denormalise?",
      points: ["it removes duplicated data by splitting it into related tables", "that prevents update/insert/delete anomalies — one fact, one place", "denormalisation duplicates data on purpose to make hot reads faster, accepting the consistency burden"],
      followups: [
        { kind: "deeper", q: "Give me an example of an update anomaly in an un-normalised table." },
        { kind: "probe", point: 0, q: "In one line, what does the first normal form demand of a column's values?" }
      ] },
    { id: "s5", topic: "dbms", skill: "Databases & SQL", tier: 2,
      q: "What is a transaction, and what do the four ACID properties each guarantee?",
      points: ["a transaction groups statements into one all-or-nothing unit of work", "Atomicity: everything commits or everything rolls back; Consistency: the database moves between valid states", "Isolation: concurrent transactions do not corrupt each other; Durability: committed data survives a crash"],
      followups: [
        { kind: "deeper", q: "Walk a bank transfer through ACID — which property saves you if the server crashes mid-transfer?" },
        { kind: "probe", point: 0, q: "Concretely, what does rollback undo, and when does it happen automatically?" }
      ] },
    { id: "s6", topic: "dbms", skill: "Databases & SQL", tier: 3,
      q: "SQL versus NoSQL: how do you decide which fits a new project?",
      points: ["relational suits structured, interrelated data and strong consistency; document/NoSQL suits flexible schemas and simple access patterns at scale", "the deciding factor is the data's relationships and how it is queried, not fashion", "scaling models differ: vertical + read replicas versus horizontal sharding, with consistency trade-offs"],
      followups: [
        { kind: "deeper", q: "A social feed and a payments ledger — which store for each, and what drives the difference?" },
        { kind: "probe", point: 1, q: "What question about the data do you ask first when choosing?" }
      ] },

    /* ---------- Operating systems ---------- */
    { id: "p1", topic: "os", skill: "Operating Systems", tier: 1,
      q: "What is the difference between a process and a thread?",
      points: ["a process has its own private memory space; threads share the memory of their process", "processes are expensive to create and isolate crashes; threads are cheap and communicate easily", "threads sharing memory means race conditions — synchronisation is the programmer's problem"],
      followups: [
        { kind: "deeper", q: "If threads are cheaper and share memory, why do servers like browsers still use multiple processes?" },
        { kind: "probe", point: 0, q: "Concretely: can two threads of one process read the same global variable? Can two processes?" }
      ] },
    { id: "p2", topic: "os", skill: "Operating Systems", tier: 2,
      q: "What is Python's GIL, and what does it mean for using threads on a CPU-bound task?",
      points: ["the Global Interpreter Lock lets only one thread execute Python bytecode at a time in CPython", "threads still help I/O-bound work because the GIL is released while waiting", "for CPU-bound parallelism in Python you use multiprocessing (separate processes, separate GILs)"],
      followups: [
        { kind: "deeper", q: "Your web scraper uses 20 threads and is fast; your image filter uses 4 threads and gains nothing. Explain both." },
        { kind: "probe", point: 2, q: "What does multiprocessing give up in exchange for true parallelism?" }
      ] },
    { id: "p3", topic: "os", skill: "Operating Systems", tier: 2,
      q: "What is a deadlock? Describe a minimal two-thread example and one way to prevent it.",
      points: ["two or more threads each hold a resource the other needs, so all wait forever (circular wait)", "example: thread A locks X then wants Y; thread B locks Y then wants X", "prevention: always acquire locks in the same global order (or use timeouts / one lock)"],
      followups: [
        { kind: "deeper", q: "Deadlock needs four conditions at once. Name any two and how breaking one prevents it." },
        { kind: "probe", point: 2, q: "Why does a fixed lock ordering actually break the circular wait?" }
      ] },
    { id: "p4", topic: "os", skill: "Operating Systems", tier: 3,
      q: "Explain virtual memory and paging in about a minute, as you would to a junior developer.",
      points: ["each process sees its own virtual address space, translated to physical memory in pages", "pages not currently needed can live on disk; a page fault loads them on demand", "if the working set exceeds RAM the system thrashes — constantly paging instead of working"],
      followups: [
        { kind: "deeper", q: "How can the sum of all processes' memory exceed the machine's RAM without everything crashing immediately?" },
        { kind: "probe", point: 1, q: "What exactly happens, step by step, on a page fault?" }
      ] },
    { id: "p5", topic: "os", skill: "Operating Systems", tier: 2,
      q: "What is a context switch, why does it cost time, and who decides which process runs next?",
      points: ["a context switch saves one process/thread's CPU state and restores another's", "the cost is the state save/restore plus cache/TLB disruption — the CPU does no useful work meanwhile", "the OS scheduler decides, using priorities and time slices (preemptive scheduling)"],
      followups: [
        { kind: "deeper", q: "How is cooperative scheduling — like Python's asyncio — different in who decides to switch?" },
        { kind: "probe", point: 0, q: "What state must be saved for a thread to resume exactly where it stopped?" }
      ] },

    /* ---------- Computer networks ---------- */
    { id: "n1", topic: "cn", skill: "Computer Networks", tier: 1,
      q: "TCP versus UDP — what do you gain and give up with each?",
      points: ["TCP: connection-oriented, reliable, ordered delivery with retransmission", "UDP: no connection, no delivery or ordering guarantee — minimal overhead and latency", "TCP for web/files/payments; UDP for live media, games and DNS where a lost packet beats a late one"],
      followups: [
        { kind: "deeper", q: "A video call uses UDP but adds its own sequencing. Why build reliability on top instead of just using TCP?" },
        { kind: "probe", point: 0, q: "What does TCP do when a packet is lost — how does the sender find out?" }
      ] },
    { id: "n2", topic: "cn", skill: "Computer Networks", tier: 2,
      q: "You type a URL into a browser and press Enter. Walk me through what happens, at a high level.",
      points: ["DNS resolves the hostname to an IP address (often cached)", "a TCP connection opens, plus a TLS handshake for HTTPS", "the browser sends an HTTP request; the server responds; the browser parses and renders, fetching sub-resources"],
      followups: [
        { kind: "deeper", q: "Where can caching happen along that path, and what does each layer save?" },
        { kind: "probe", point: 0, q: "What exactly does DNS return, and what happens if the name does not exist?" }
      ] },
    { id: "n3", topic: "cn", skill: "Computer Networks", tier: 2,
      q: "Which HTTP status codes should every developer know cold? Give me the meaning of 200, 201, 301, 400, 401, 403, 404 and 500.",
      points: ["200 OK; 201 Created (usually a successful POST)", "301 permanent redirect; 400 the request itself is malformed/invalid", "401 unauthenticated versus 403 authenticated but not allowed; 404 resource not found; 500 the server's own error"],
      followups: [
        { kind: "deeper", q: "A user is logged in but opens an admin page. 401 or 403 — and why?" },
        { kind: "probe", point: 2, q: "What is the practical difference between 401 and 403 for the client developer?" }
      ] },
    { id: "n4", topic: "cn", skill: "Computer Networks", tier: 3,
      q: "What does HTTPS add over HTTP, and what does it NOT protect against?",
      points: ["TLS encrypts traffic in transit — eavesdroppers see ciphertext, not content", "certificates authenticate the server's identity, so you know who you are talking to", "it does not make the site itself honest or secure — a phishing site can have a valid certificate"],
      followups: [
        { kind: "deeper", q: "In the TLS handshake, how do two sides that never met end up with a shared secret over a public channel?" },
        { kind: "probe", point: 1, q: "What is a certificate authority's role in that identity check?" }
      ] },

    /* ---------- Web & APIs ---------- */
    { id: "w1", topic: "web", skill: "Web & APIs", tier: 1,
      q: "What makes an API RESTful? Describe its core ideas.",
      points: ["resources are nouns in URLs (/users/42), acted on with HTTP verbs (GET/POST/PUT/DELETE)", "requests are stateless — each carries everything the server needs", "responses use proper status codes and usually JSON representations"],
      followups: [
        { kind: "deeper", q: "Design the endpoints for a blog: posts and comments on posts. What do the URLs and verbs look like?" },
        { kind: "probe", point: 1, q: "What does stateless force the client to send with every request?" }
      ] },
    { id: "w2", topic: "web", skill: "Web & APIs", tier: 2,
      q: "Session-based auth versus token-based (JWT) auth — how do they differ, and what are the trade-offs?",
      points: ["sessions: the server stores state and the browser holds an opaque session id in a cookie; JWT: a signed, self-contained token the server verifies without storage", "sessions are easy to revoke; a JWT cannot be individually revoked before expiry without extra machinery", "where the token lives matters: localStorage is readable by any script (XSS), an httpOnly cookie is not"],
      followups: [
        { kind: "deeper", q: "A user's JWT is stolen an hour before it expires. What are your options, and what does that tell you about token lifetimes?" },
        { kind: "probe", point: 0, q: "If the server stores nothing for a JWT, how does it know the token was not forged?" }
      ] },
    { id: "w3", topic: "web", skill: "Web & APIs", tier: 2,
      q: "What does idempotent mean? Which HTTP methods are idempotent, and why does it matter in practice?",
      points: ["idempotent = making the same request multiple times has the same effect as making it once", "GET, PUT and DELETE are idempotent; POST is not", "it makes retries safe — crucial for payments and flaky networks; POST endpoints add idempotency keys to fake it"],
      followups: [
        { kind: "deeper", q: "A payment POST times out on the client. Why is blindly retrying dangerous, and how does an idempotency key fix it?" },
        { kind: "probe", point: 0, q: "DELETE /users/42 runs twice. What should the second call do, and is that idempotent?" }
      ] },
    { id: "w4", topic: "web", skill: "Web & APIs", tier: 3,
      q: "Your API endpoint gets slow as users grow toward 10,000. What are the first things you check, and in what order?",
      points: ["measure first — profile/logs to find whether the time is in the database, the app or the network", "database causes first: missing indexes, N+1 queries, unbounded result sets (add pagination)", "then caching for hot reads and removing repeated work — before scaling hardware"],
      followups: [
        { kind: "deeper", q: "What is an N+1 query problem, and how do you spot one in logs?" },
        { kind: "probe", point: 1, q: "Why is an unbounded SELECT on a growing table a time bomb, and what is the standard fix?" }
      ] },
    { id: "w5", topic: "web", skill: "Web & APIs", tier: 1,
      q: "Why do APIs exchange JSON, and in Python what do json.loads and json.dumps each do?",
      points: ["JSON is a language-agnostic text format that maps naturally to dicts and lists", "loads parses JSON text into Python objects; dumps serialises Python objects into JSON text", "not everything is serialisable by default — dates, sets and custom objects need conversion"],
      followups: [
        { kind: "deeper", q: "Your API must return a datetime. What happens with plain json.dumps, and what are your options?" },
        { kind: "probe", point: 1, q: "Mnemonic check: which of loads/dumps deals with a string, and how do you remember?" }
      ] },

    /* ---------- Data (for Data Analyst / Scientist roles) ---------- */
    { id: "da1", topic: "data", skill: "Data & pandas", tier: 2,
      q: "In pandas, what is a Series versus a DataFrame, and why does the index matter?",
      points: ["a Series is one labelled 1-D column; a DataFrame is a 2-D table of Series sharing an index", "operations align on the index, not on position — mismatched indexes produce NaN", "vectorised operations on whole columns replace slow Python loops"],
      followups: [
        { kind: "deeper", q: "You add two Series with different indexes and get NaNs everywhere. What happened?" },
        { kind: "probe", point: 2, q: "Why is df['x'] * 2 faster than looping over rows in pure Python?" }
      ] },
    { id: "da2", topic: "data", skill: "Data & pandas", tier: 2,
      q: "Explain groupby in one line, then unpack it: what are the three phases happening under the hood?",
      points: ["groupby computes a summary per group — split, apply, combine", "split: rows are divided by the grouping key; apply: an aggregation runs per group", "combine: the per-group results are assembled into one result indexed by the key"],
      followups: [
        { kind: "deeper", q: "groupby('city').mean() on a table with text columns — what happens to those columns, and why does it surprise people?" },
        { kind: "probe", point: 0, q: "What is the SQL equivalent of a pandas groupby with an aggregation?" }
      ] },
    { id: "da3", topic: "data", skill: "Data & pandas", tier: 3,
      q: "Why do we split data into train and test sets, and what is data leakage?",
      points: ["the test set estimates performance on unseen data — tuning on the test set inflates the estimate", "leakage: information from the future or from the target leaks into the features, giving impossible accuracy", "defences: split before any fitting, fit preprocessing on train only, stratify for classification"],
      followups: [
        { kind: "deeper", q: "Your model scores 99% in training and 61% in production. Leakage or something else — how do you investigate?" },
        { kind: "probe", point: 1, q: "Give me one concrete leakage example in a sales-prediction dataset." }
      ] }
  ];

  /* HR & behavioural. points[] are STAR rubric points: a strong
     answer names a concrete Situation, the candidate's Task, the
     Actions THEY personally took, and a Result (ideally with an
     outcome or a lesson). The local scorer also watches for STAR
     marker words (see interview.js). Follow-ups probe the STAR
     part candidates most often skip. */
  var STAR = ["a concrete, real situation (not a hypothetical)", "their own task or responsibility in it", "specific actions they personally took", "a result or outcome", "a reflection — what they learned or would do differently"];
  function hr(id, tier, q, focus, followups) {
    return { id: id, topic: "hr", skill: "Communication & HR", tier: tier, q: q, points: STAR.slice(), focus: focus, followups: followups };
  }
  var HR = [
    hr("h1", 1, "Tell me about yourself.", "a structured 60-90 second arc: present role/studies, relevant skills, one proof point, and why this role",
      [{ kind: "probe", point: 2, q: "You mentioned your skills — which single project or result best proves them?" }]),
    hr("h2", 1, "Why should we hire you for this role?", "a direct match between the role's needs and their demonstrated skills, with evidence rather than adjectives",
      [{ kind: "probe", point: 3, q: "What result have you produced that is closest to what this role needs?" }]),
    hr("h3", 1, "What is your greatest strength? Give me an example of it in action.", "one real strength backed by a story, not a list of adjectives",
      [{ kind: "probe", point: 2, q: "Walk me through that example — what did you personally do?" }]),
    hr("h4", 2, "Tell me about a real weakness of yours. What are you doing about it?", "an honest, non-fatal weakness plus a concrete improvement practice already under way",
      [{ kind: "probe", point: 4, q: "How will I be able to tell, in three months, that this weakness is improving?" }]),
    hr("h5", 2, "Describe a time you failed at something that mattered to you. What happened?", "ownership without blaming others, and a lesson that visibly changed later behaviour",
      [{ kind: "probe", point: 4, q: "What do you do differently now because of that failure?" }]),
    hr("h6", 2, "Tell me about a conflict you had with a teammate or classmate. How did you handle it?", "they addressed the issue directly and respectfully, focused on the work, and reached a working outcome",
      [{ kind: "probe", point: 2, q: "What did you say in the first conversation about it — how did you open it?" }]),
    hr("h7", 2, "Describe a time you had to deliver under serious time pressure. How did you manage it?", "prioritisation, communication about trade-offs, and a delivered result — not just working longer hours",
      [{ kind: "probe", point: 1, q: "What did you deliberately choose NOT to do when time ran short?" }]),
    hr("h8", 1, "Tell me about the project you are most proud of. What was your exact contribution?", "a specific personal contribution, distinguishable from the team's work",
      [{ kind: "probe", point: 2, q: "If I removed your contribution, what would the project have lost?" }]),
    hr("h9", 3, "You discover, two days before a deadline, that your approach is fundamentally wrong. What do you do?", "early escalation with options and a recommendation, not silent heroics or hiding the problem",
      [{ kind: "probe", point: 2, q: "What exactly do you tell your lead in that first conversation?" }]),
    hr("h10", 2, "Tell me about a time you had to learn something completely new, fast. How did you approach it?", "a learning strategy: sources, practice, feedback loops — and a usable result at the end",
      [{ kind: "probe", point: 3, q: "How did you verify you had actually learned it, rather than just read about it?" }]),
    hr("h11", 1, "Where do you see yourself in five years?", "a plausible growth direction connected to this role, showing intent to stay and grow",
      [{ kind: "probe", point: 0, q: "What is the first step of that plan that you have already started?" }]),
    hr("h12", 2, "Tell me about a time you received tough feedback. How did you respond?", "they listened without defensiveness, extracted the useful part, and changed something concrete",
      [{ kind: "probe", point: 4, q: "What did you change in the following weeks because of it?" }]),
    hr("h13", 1, "Why do you want to join our company, specifically?", "specific, researched reasons tied to the company's work — not interchangeable flattery",
      [{ kind: "probe", point: 0, q: "What is one thing about our work that a generic applicant would not know?" }]),
    hr("h14", 3, "Describe a time you took ownership of something that was not officially your job.", "they noticed a problem, acted without being asked, and followed through to a result",
      [{ kind: "probe", point: 3, q: "What was the measurable outcome of stepping in?" }]),
    hr("h15", 1, "Do you have any questions for us?", "thoughtful questions about the role, team and growth — asking none reads as disinterest; the rubric here scores the questions they pose",
      [{ kind: "probe", point: 0, q: "Of everything you could ask, why did you pick those questions?" }])
  ];

  /* Coding problems. Tests follow the practice-data convention:
     `run` is a Python expression evaluated after the candidate's
     code; `expect` is the exact str() of the result. Hidden tests
     are never displayed — only their count is. `solution` is the
     reference implementation the bank test-suite verifies against
     every test; it is never sent to the page's UI. */
  var CODING = [
    { id: "c1", title: "Second Largest (distinct)", topic: "coding", skill: "Coding", tier: 1, minutes: 10,
      prompt: "Write second_largest(nums) that returns the second-largest DISTINCT value in a list of numbers. If there is no second distinct value (empty list, one element, or all elements equal), return None.",
      starter: "def second_largest(nums):\n    # your code here\n    pass\n",
      visible: [
        { run: "second_largest([3, 1, 4, 1, 5])", expect: "4" },
        { run: "second_largest([10, 10, 9])", expect: "9" }
      ],
      hidden: [
        { run: "second_largest([7])", expect: "None" },
        { run: "second_largest([-5, -2, -9])", expect: "-5" },
        { run: "second_largest([2, 2, 2])", expect: "None" },
        { run: "second_largest([0, -1])", expect: "-1" }
      ],
      solution: "def second_largest(nums):\n    uniq = sorted(set(nums), reverse=True)\n    return uniq[1] if len(uniq) > 1 else None\n",
      optimalTime: "O(n)", optimalSpace: "O(n)",
      ideaPoints: ["distinct values (set or track two maxima)", "single pass tracking the top two, or sort the unique values", "fewer than two distinct values returns None"] },
    { id: "c2", title: "Two Sum", topic: "coding", skill: "Coding", tier: 1, minutes: 12,
      prompt: "Write two_sum(nums, target) that returns the indices of the two numbers that add up to target, as a list [i, j] with i < j. Exactly one solution exists, and the same element may not be used twice.",
      starter: "def two_sum(nums, target):\n    # your code here\n    pass\n",
      visible: [
        { run: "two_sum([2, 7, 11, 15], 9)", expect: "[0, 1]" },
        { run: "two_sum([3, 2, 4], 6)", expect: "[1, 2]" }
      ],
      hidden: [
        { run: "two_sum([3, 3], 6)", expect: "[0, 1]" },
        { run: "two_sum([-1, -2, -3], -5)", expect: "[1, 2]" },
        { run: "two_sum([0, 4, 3, 0], 0)", expect: "[0, 3]" }
      ],
      solution: "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n",
      optimalTime: "O(n)", optimalSpace: "O(n)",
      ideaPoints: ["hash map / dictionary of seen values", "one pass", "look up the complement (target - current)"] },
    { id: "c3", title: "Balanced Brackets", topic: "coding", skill: "Coding", tier: 2, minutes: 12,
      prompt: "Write is_balanced(s) that returns True if every opening bracket in s — ( [ { — is closed by the matching bracket in the correct order, and False otherwise. The string contains only bracket characters.",
      starter: "def is_balanced(s):\n    # your code here\n    pass\n",
      visible: [
        { run: "is_balanced('()[]{}')", expect: "True" },
        { run: "is_balanced('(]')", expect: "False" }
      ],
      hidden: [
        { run: "is_balanced('([{}])')", expect: "True" },
        { run: "is_balanced('(((')", expect: "False" },
        { run: "is_balanced('')", expect: "True" },
        { run: "is_balanced('}{')", expect: "False" }
      ],
      solution: "def is_balanced(s):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for ch in s:\n        if ch in '([{':\n            stack.append(ch)\n        elif not stack or stack.pop() != pairs[ch]:\n            return False\n    return not stack\n",
      optimalTime: "O(n)", optimalSpace: "O(n)",
      ideaPoints: ["stack (LIFO)", "push opening brackets, match each closing bracket against the top", "stack must be empty at the end"] },
    { id: "c4", title: "First Non-Repeating Character", topic: "coding", skill: "Coding", tier: 2, minutes: 12,
      prompt: "Write first_unique(s) that returns the first character of s that occurs exactly once in the string. Return an empty string if every character repeats.",
      starter: "def first_unique(s):\n    # your code here\n    pass\n",
      visible: [
        { run: "first_unique('leetcode')", expect: "l" },
        { run: "first_unique('aabb')", expect: "" }
      ],
      hidden: [
        { run: "first_unique('aabbc')", expect: "c" },
        { run: "first_unique('swiss')", expect: "w" },
        { run: "first_unique('')", expect: "" }
      ],
      solution: "def first_unique(s):\n    counts = {}\n    for ch in s:\n        counts[ch] = counts.get(ch, 0) + 1\n    for ch in s:\n        if counts[ch] == 1:\n            return ch\n    return ''\n",
      optimalTime: "O(n)", optimalSpace: "O(n)",
      ideaPoints: ["count occurrences with a dictionary", "second pass in original order to find the first with count 1", "dictionary preserves insertion order"] },
    { id: "c5", title: "Reverse the Words", topic: "coding", skill: "Coding", tier: 1, minutes: 10,
      prompt: "Write reverse_words(sentence) that returns the sentence with its words in reverse order. Words are separated by single spaces, with no leading or trailing spaces.",
      starter: "def reverse_words(sentence):\n    # your code here\n    pass\n",
      visible: [
        { run: "reverse_words('the sky is blue')", expect: "blue is sky the" },
        { run: "reverse_words('hello world')", expect: "world hello" }
      ],
      hidden: [
        { run: "reverse_words('hello')", expect: "hello" },
        { run: "reverse_words('a b c')", expect: "c b a" },
        { run: "reverse_words('')", expect: "" }
      ],
      solution: "def reverse_words(sentence):\n    if not sentence:\n        return ''\n    return ' '.join(sentence.split(' ')[::-1])\n",
      optimalTime: "O(n)", optimalSpace: "O(n)",
      ideaPoints: ["split into words", "reverse the list of words (not the characters)", "join with single spaces"] },
    { id: "c6", title: "Group Anagrams", topic: "coding", skill: "Coding", tier: 3, minutes: 18,
      prompt: "Write group_anagrams(words) that groups the words that are anagrams of each other. Return a list of lists; the order of groups and of words inside a group does not matter.",
      starter: "def group_anagrams(words):\n    # your code here\n    pass\n",
      visible: [
        { run: "sorted([sorted(g) for g in group_anagrams(['eat', 'tea', 'tan', 'ate', 'nat', 'bat'])])", expect: "[['ate', 'eat', 'tea'], ['bat'], ['nat', 'tan']]" },
        { run: "sorted([sorted(g) for g in group_anagrams(['abc'])])", expect: "[['abc']]" }
      ],
      hidden: [
        { run: "sorted([sorted(g) for g in group_anagrams(['', ''])])", expect: "[['', '']]" },
        { run: "sorted([sorted(g) for g in group_anagrams(['ab', 'ba', 'abc', 'cab', 'bca'])])", expect: "[['ab', 'ba'], ['abc', 'bca', 'cab']]" }
      ],
      solution: "def group_anagrams(words):\n    groups = {}\n    for w in words:\n        key = ''.join(sorted(w))\n        groups.setdefault(key, []).append(w)\n    return list(groups.values())\n",
      optimalTime: "O(n·k log k)", optimalSpace: "O(n·k)",
      ideaPoints: ["anagrams share a canonical key — their sorted letters", "group with a dictionary keyed by the sorted word", "character-count tuple is an alternative key"] },
    { id: "c7", title: "Maximum Subarray Sum", topic: "coding", skill: "Coding", tier: 2, minutes: 15,
      prompt: "Write max_subarray(nums) that returns the largest sum of any contiguous subarray. The list has at least one number, and numbers may all be negative.",
      starter: "def max_subarray(nums):\n    # your code here\n    pass\n",
      visible: [
        { run: "max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4])", expect: "6" },
        { run: "max_subarray([1, 2, 3, 4])", expect: "10" }
      ],
      hidden: [
        { run: "max_subarray([-3, -1])", expect: "-1" },
        { run: "max_subarray([5])", expect: "5" },
        { run: "max_subarray([-2, -5, -1, -4])", expect: "-1" }
      ],
      solution: "def max_subarray(nums):\n    best = cur = nums[0]\n    for n in nums[1:]:\n        cur = max(n, cur + n)\n        best = max(best, cur)\n    return best\n",
      optimalTime: "O(n)", optimalSpace: "O(1)",
      ideaPoints: ["Kadane's algorithm — running best-ending-here", "restart the current sum when extending hurts", "track the global maximum; handle all-negative by seeding with the first element"] },
    { id: "c8", title: "Merge Two Sorted Lists", topic: "coding", skill: "Coding", tier: 2, minutes: 12,
      prompt: "Write merge_sorted(a, b) that merges two already-sorted lists of numbers into one new sorted list. Do not call sorted() or .sort() — merge them directly.",
      starter: "def merge_sorted(a, b):\n    # your code here\n    pass\n",
      visible: [
        { run: "merge_sorted([1, 3, 5], [2, 4, 6])", expect: "[1, 2, 3, 4, 5, 6]" },
        { run: "merge_sorted([1, 2], [3, 4])", expect: "[1, 2, 3, 4]" }
      ],
      hidden: [
        { run: "merge_sorted([], [1])", expect: "[1]" },
        { run: "merge_sorted([5, 6], [])", expect: "[5, 6]" },
        { run: "merge_sorted([1, 2, 2], [2, 3])", expect: "[1, 2, 2, 2, 3]" }
      ],
      solution: "def merge_sorted(a, b):\n    out = []\n    i = j = 0\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            out.append(a[i]); i += 1\n        else:\n            out.append(b[j]); j += 1\n    return out + a[i:] + b[j:]\n",
      optimalTime: "O(n + m)", optimalSpace: "O(n + m)",
      ideaPoints: ["two pointers, one per list", "append the smaller front element each step", "append the remaining tail when one list is exhausted"] }
  ];

  /* Which technical topics each role is examined on. Roles outside
     the Python stack still get the CS core (fundamentals/OOP/DSA/
     DBMS/OS/CN) plus HR — depth there is honest Phase-1 coverage. */
  var ROLE_TOPICS = {
    "Python Developer": ["fundamentals", "oop", "dsa", "dbms", "web", "os"],
    "Software Developer": ["fundamentals", "oop", "dsa", "dbms", "os", "cn", "web"],
    "Full Stack Developer": ["fundamentals", "oop", "dsa", "dbms", "web", "cn"],
    "Frontend Developer": ["fundamentals", "oop", "dsa", "web", "cn"],
    "Backend Developer": ["fundamentals", "oop", "dsa", "dbms", "web", "os", "cn"],
    "Java Developer": ["fundamentals", "oop", "dsa", "dbms", "os", "cn"],
    "Data Analyst": ["fundamentals", "dbms", "data", "dsa"],
    "Data Scientist": ["fundamentals", "dbms", "data", "dsa", "oop"],
    "AI/ML Engineer": ["fundamentals", "data", "dsa", "oop", "dbms"],
    "DevOps Engineer": ["fundamentals", "os", "cn", "web", "dbms"],
    "Cybersecurity Analyst": ["fundamentals", "os", "cn", "web"],
    "QA / Software Testing Engineer": ["fundamentals", "oop", "dsa", "dbms", "web"]
  };

  /* Coding rubric (spec §6 example weights — Skillzify's rubric,
     shown to candidates in the report; configurable here). */
  var CODING_RUBRIC = { correctness: 35, time: 20, space: 15, edge: 15, quality: 10, explanation: 5 };

  window.SkillzifyInterviewBank = {
    version: 1,
    technical: TECHNICAL,
    hr: HR,
    coding: CODING,
    roleTopics: ROLE_TOPICS,
    codingRubric: CODING_RUBRIC
  };
})();
