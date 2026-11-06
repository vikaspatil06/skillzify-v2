/* Skillzify Guided Projects — real-world Python builds.
   List view shows compact cards; #project=<id> opens the full guide.
   steps: HTML strings (may include <code>). code: plain Python. */
window.SkillzifyProjects = [
  {
    id: "file-organizer", icon: "📁", title: "File Organizer",
    level: "Beginner", color: "#34d399",
    skills: "os, pathlib, loops, conditionals",
    desc: "Write a script that scans your Downloads folder and sorts files into subfolders by extension — images, documents, videos, everything else.",
    steps: [
      "List every file in a folder with <code>pathlib.Path.iterdir()</code>.",
      "Map extensions to folder names with a dictionary (<code>{\".jpg\": \"images\", \".pdf\": \"docs\"}</code>).",
      "Create missing folders with <code>mkdir(exist_ok=True)</code> and move files with <code>shutil.move()</code>.",
      "<strong>Stretch:</strong> add a <code>--dry-run</code> flag that prints moves without doing them."
    ],
    code: `from pathlib import Path
import shutil

downloads = Path.home() / "Downloads"
kinds = {".jpg": "images", ".png": "images",
         ".pdf": "docs", ".mp4": "videos"}

for f in downloads.iterdir():
    if f.is_file() and f.suffix in kinds:
        dest = downloads / kinds[f.suffix]
        dest.mkdir(exist_ok=True)
        shutil.move(str(f), dest / f.name)
print("Done! ✨")`,
    tryIt: true
  },
  {
    id: "weather-api", icon: "🌤️", title: "Weather API Client",
    level: "Intermediate", color: "#22d3ee",
    skills: "requests, JSON, error handling, f-strings",
    desc: "Fetch live weather data from a free API and print a friendly report. Your first program that talks to the internet.",
    steps: [
      "Get a free key from <code>openweathermap.org</code> (or use the no-key <code>wttr.in</code> service).",
      "<code>requests.get(url, params={...})</code> — always pass a <code>timeout</code>.",
      "Check <code>response.status_code</code>; parse with <code>response.json()</code>.",
      "Handle failures gracefully: <code>try/except requests.RequestException</code>.",
      "<strong>Stretch:</strong> accept the city as a command-line argument via <code>sys.argv</code>."
    ],
    code: `import requests

city = "Pune"
r = requests.get("https://wttr.in/" + city,
                 params={"format": "j1"}, timeout=10)
data = r.json()
now = data["current_condition"][0]
print(f"{city}: {now['weatherDesc'][0]['value']}, "
      f"{now['temp_C']}°C (feels {now['FeelsLikeC']}°C)")`,
    tryIt: false,
    note: "⚠️ Needs <code>pip install requests</code> on your machine — the in-browser compiler can't reach the network."
  },
  {
    id: "web-scraper", icon: "🕷️", title: "Web Scraper",
    level: "Intermediate", color: "#9d6bff",
    skills: "requests, BeautifulSoup, lists, CSV output",
    desc: "Scrape headlines from a news site and save them to a CSV file. Respect robots.txt — scrape gently.",
    steps: [
      "Fetch the page HTML with <code>requests</code>.",
      "Parse with <code>BeautifulSoup(html, \"html.parser\")</code>.",
      "Select headlines with <code>soup.select(\"h2 a\")</code> (inspect the page first!).",
      "Write title + link rows with the <code>csv</code> module.",
      "<strong>Stretch:</strong> scrape 3 pages and de-duplicate with a <code>set</code>."
    ],
    code: `import csv, requests
from bs4 import BeautifulSoup

html = requests.get("https://example.com/news", timeout=10).text
soup = BeautifulSoup(html, "html.parser")

rows = [(a.get_text(strip=True), a["href"])
        for a in soup.select("h2 a") if a.get("href")]

with open("headlines.csv", "w", newline="") as f:
    csv.writer(f).writerows([("title", "link"), *rows])
print(f"Saved {len(rows)} headlines.")`,
    tryIt: false,
    note: "⚠️ Needs <code>pip install beautifulsoup4</code> — and always check a site's terms before scraping."
  }
,
  {
    id: "csv-analyzer", icon: "📊", title: "CSV Data Analyzer",
    level: "Advanced", color: "#f472b6",
    skills: "csv, collections.Counter, statistics, comprehensions",
    desc: "Analyze a real dataset (e.g. your exercise attempts exported as CSV): top categories, averages, trends.",
    steps: [
      "Read rows with <code>csv.DictReader</code> — dictionaries beat index juggling.",
      "Count categories with <code>collections.Counter</code>.",
      "Compute averages with <code>statistics.mean</code>; group with dict comprehensions.",
      "Print a clean text report with f-strings and <code>max(..., key=...)</code> highlights.",
      "<strong>Stretch:</strong> draw a bar chart with <code>matplotlib</code>."
    ],
    code: `import csv
from collections import Counter
from statistics import mean

with open("scores.csv") as f:
    rows = list(csv.DictReader(f))

by_topic = {}
for r in rows:
    by_topic.setdefault(r["topic"], []).append(float(r["score"]))

for topic, scores in sorted(by_topic.items()):
    print(f"{topic:12} avg {mean(scores):5.1f}  "
          f"n={len(scores)}")
top = Counter(r["topic"] for r in rows).most_common(1)[0]
print(f"\\nMost practiced: {top[0]} ({top[1]} attempts)")`,
    tryIt: true
  },
{
    id: "guess-number", icon: "🎲", title: "Guess the Number",
    level: "Beginner", color: "#34d399",
    skills: "random, while loops, input validation",
    desc: "The computer picks a secret number between 1 and 100 — you guess, it tells you higher or lower, until you nail it. A perfect first game: loops, randomness and bulletproof input handling in about 20 lines.",
    steps: [
      "Pick the secret with <code>random.randint(1, 100)</code> — one line, endlessly replayable.",
      "Loop forever with <code>while True</code>, reading each guess through <code>input()</code>.",
      "Wrap <code>int(guess)</code> in <code>try/except ValueError</code> so typos don't crash the game.",
      "Count attempts and print higher/lower hints until the guess matches the secret.",
      "<strong>Stretch:</strong> add difficulty levels (1–50 easy, 1–1000 hard) or track a best score across runs."
    ],
    code: `import random

secret = random.randint(1, 100)
attempts = 0

print("I'm thinking of a number between 1 and 100.")

while True:
    guess = input("Your guess: ")
    try:
        guess = int(guess)
    except ValueError:
        print("That's not a number — try again!")
        continue
    attempts += 1
    if guess < secret:
        print("Too low! Go higher.")
    elif guess > secret:
        print("Too high! Go lower.")
    else:
        print(f"You got it in {attempts} tries! 🎉")
        break`,
    tryIt: true
  },
  {
    id: "password-generator", icon: "🔐", title: "Password Generator",
    level: "Beginner", color: "#34d399",
    skills: "secrets, strings, randomization",
    desc: "Generate cryptographically strong passwords with Python's secrets module — guaranteed letters, digits and symbols in every one. The kind of tiny utility you'll actually use every week.",
    steps: [
      "Build character pools from <code>string.ascii_letters</code>, <code>string.digits</code> and <code>string.punctuation</code>.",
      "Pick with <code>secrets.choice()</code> — cryptographically strong, unlike <code>random</code>.",
      "Guarantee strength: force one letter, one digit and one symbol into every password.",
      "Shuffle with <code>secrets.SystemRandom().shuffle()</code> so the guaranteed characters aren't predictable.",
      "<strong>Stretch:</strong> print the entropy in bits (<code>length × log2(pool size)</code>) or add a pronounceable mode."
    ],
    code: `import secrets
import string

pools = {
    "letters": string.ascii_letters,
    "digits": string.digits,
    "symbols": string.punctuation,
}

def make_password(length=16):
    if length < 4:
        raise ValueError("length must be at least 4")
    chars = [secrets.choice(pools["letters"]),
             secrets.choice(pools["digits"]),
             secrets.choice(pools["symbols"])]
    all_chars = "".join(pools.values())
    chars += [secrets.choice(all_chars) for _ in range(length - 3)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)

print(make_password(16))`,
    tryIt: true
  },
  {
    id: "todo-cli", icon: "✅", title: "To-Do CLI",
    level: "Beginner", color: "#34d399",
    skills: "JSON persistence, lists, dicts",
    desc: "A command-line to-do list that saves to a JSON file, so your tasks survive between runs. Lists, dicts, file I/O and a REPL loop — the backbone of countless real tools.",
    steps: [
      "Model tasks as a list of dicts: <code>{\"text\": ..., \"done\": False}</code>.",
      "Run a REPL loop parsing <code>add &lt;text&gt;</code>, <code>list</code>, <code>done &lt;n&gt;</code> and <code>quit</code>.",
      "Persist with <code>json.dump</code> / <code>json.load</code> to <code>todos.json</code> via <code>pathlib</code>.",
      "Guard bad input: <code>try/except (ValueError, IndexError)</code> around the <code>done</code> command.",
      "<strong>Stretch:</strong> add priorities (<code>add !Buy milk</code>) or due dates."
    ],
    code: `import json
from pathlib import Path

DB = Path("todos.json")

def load():
    if DB.exists():
        return json.loads(DB.read_text())
    return []

def save(tasks):
    DB.write_text(json.dumps(tasks, indent=2))

def show(tasks):
    if not tasks:
        print("(empty)")
    for i, t in enumerate(tasks, 1):
        mark = "✓" if t["done"] else " "
        print(f"{i}. [{mark}] {t['text']}")

tasks = load()

while True:
    raw = input("\\n> ").strip()
    cmd = raw.lower()
    if cmd in ("quit", "q", "exit"):
        break
    elif cmd == "list":
        show(tasks)
    elif cmd.startswith("add "):
        tasks.append({"text": raw[4:].strip(), "done": False})
        save(tasks)
        print("Added.")
    elif cmd.startswith("done "):
        try:
            tasks[int(cmd[5:]) - 1]["done"] = True
            save(tasks)
            print("Done!")
        except (ValueError, IndexError):
            print("No such task number.")
    else:
        print("Commands: add <text> | list | done <n> | quit")`,
    tryIt: true
  },
{
    id: "pomodoro-timer", icon: "⏱️", title: "Pomodoro Timer",
    level: "Intermediate", color: "#22d3ee",
    skills: "time, loops, datetime",
    desc: "A terminal Pomodoro timer: 25-minute focus sessions and 5-minute breaks with a live countdown, a session counter, and a graceful Ctrl+C exit. Train your focus like a muscle.",
    steps: [
      "Keep <code>WORK_MIN</code> and <code>BREAK_MIN</code> as constants at the top — the whole timer is tweakable in one place.",
      "Write <code>countdown(minutes, label)</code>: a <code>for</code> loop with <code>time.sleep(1)</code> that redraws <code>MM:SS</code> on one line using <code>\\r</code>.",
      "Build the state machine in <code>main()</code>: focus → break, looping forever until <code>Ctrl+C</code> raises <code>KeyboardInterrupt</code>.",
      "Count completed pomodoros and stamp the start time with <code>datetime.now()</code>.",
      "<strong>Stretch:</strong> take a long break every 4 sessions, and pop a desktop notification with <code>plyer</code> when a session ends."
    ],
    code: `import time
from datetime import datetime

WORK_MIN = 25    # tweak me
BREAK_MIN = 5    # tweak me

def countdown(minutes, label):
    total = int(minutes * 60)
    for remaining in range(total, 0, -1):
        mins, secs = divmod(remaining, 60)
        print(f"\\r{label}: {mins:02d}:{secs:02d}", end="", flush=True)
        time.sleep(1)
    print(f"\\r{label}: 00:00 — done!{' ' * 10}")

def main():
    pomodoros = 0
    print("🍅 Pomodoro Timer — started", datetime.now().strftime("%H:%M"))
    try:
        while True:
            pomodoros += 1
            print(f"\\n▶ Focus #{pomodoros} — {WORK_MIN} min. Go!")
            countdown(WORK_MIN, "Focus")
            print(f"☕ Break — {BREAK_MIN} min. Breathe.")
            countdown(BREAK_MIN, "Break")
    except KeyboardInterrupt:
        print(f"\\n\\nFinished with {pomodoros} pomodoro(s). Well done! 🎉")

main()`,
    tryIt: true
  },
  {
    id: "quiz-app", icon: "💬", title: "Quiz App",
    level: "Intermediate", color: "#22d3ee",
    skills: "OOP, JSON, scoring",
    desc: "A multiple-choice quiz engine in one file: questions load from JSON, answers are validated and scored, and you get a grade plus a review of every miss. The reusable core of any trivia game.",
    steps: [
      "Model each question with a <code>Question</code> class holding <code>text</code>, <code>choices</code> and the <code>answer</code> index.",
      "Keep the question bank as a JSON string and load it with <code>json.loads()</code> — no external file needed.",
      "Shuffle with <code>random.shuffle()</code> (seed it while testing), then loop: <code>ask()</code>, validate the input, keep score.",
      "Print the final score, a letter grade, and a review of every question you missed.",
      "<strong>Stretch:</strong> add a per-question timer with <code>time.time()</code>, or group questions by category."
    ],
    code: `import json
import random

QUESTIONS_JSON = """[
 {"text": "Which keyword defines a function?", "choices": ["def", "func", "define", "lambda"], "answer": 0},
 {"text": "What does len([1, 2, 3]) return?", "choices": ["2", "3", "6", "Error"], "answer": 1},
 {"text": "Which of these is immutable?", "choices": ["list", "dict", "tuple", "set"], "answer": 2},
 {"text": "What is 'py' * 2?", "choices": ["py2", "pypy", "Error", "py py"], "answer": 1},
 {"text": "How do you catch an exception?", "choices": ["try/catch", "try/except", "catch/throw", "handle/with"], "answer": 1}
]"""

class Question:
    def __init__(self, text, choices, answer):
        self.text = text
        self.choices = choices
        self.answer = answer

    def ask(self):
        print("\\n" + self.text)
        for i, c in enumerate(self.choices, 1):
            print(f"  {i}. {c}")
        while True:
            try:
                pick = int(input("Your answer (number): ")) - 1
                if 0 <= pick < len(self.choices):
                    return pick == self.answer
                print("Pick a number from the list.")
            except ValueError:
                print("Type a number, not text.")

def grade(pct):
    if pct >= 90: return "A 🏆"
    if pct >= 75: return "B 👍"
    if pct >= 60: return "C 💪"
    return "Keep practicing 💪"

def main():
    bank = [Question(**q) for q in json.loads(QUESTIONS_JSON)]
    random.seed(7)
    random.shuffle(bank)
    score, wrong = 0, []
    for q in bank:
        if q.ask():
            print("✓ Correct!")
            score += 1
        else:
            print(f"✗ The answer was: {q.choices[q.answer]}")
            wrong.append(q)
    pct = score / len(bank) * 100
    print(f"\\nScore: {score}/{len(bank)} ({pct:.0f}%) — grade {grade(pct)}")
    if wrong:
        print("\\nReview your misses:")
        for q in wrong:
            print(f" • {q.text} → {q.choices[q.answer]}")

main()`,
    tryIt: true
  },
  {
    id: "expense-tracker", icon: "💰", title: "Expense Tracker",
    level: "Intermediate", color: "#22d3ee",
    skills: "csv, datetime, collections",
    desc: "Log daily spending to a CSV file from the terminal, then print this month's totals grouped by category. Your first step toward data-driven money habits.",
    steps: [
      "Store each expense as a CSV row — <code>date, category, amount, note</code> — readable by Excel too.",
      "Write <code>load()</code> / <code>save()</code> with <code>csv.DictReader</code> and <code>DictWriter</code>; handle the missing file on first run.",
      "Commands: <code>add</code> (stamps <code>date.today()</code> automatically), <code>list</code> (last 10), <code>month</code>.",
      "Summarize the current month with <code>collections.Counter</code>: per-category totals plus a grand total.",
      "<strong>Stretch:</strong> warn when a category passes its monthly limit from a <code>BUDGETS</code> dict, then add a <code>set-budget</code> command."
    ],
    code: `import csv
from collections import Counter
from datetime import date

FILE = "expenses.csv"

def load():
    try:
        with open(FILE, newline="") as f:
            return list(csv.DictReader(f))
    except FileNotFoundError:
        return []

def save(rows):
    with open(FILE, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["date", "category", "amount", "note"])
        w.writeheader()
        w.writerows(rows)

def add(rows):
    cat = input("Category: ").strip() or "other"
    amount = float(input("Amount: "))
    note = input("Note: ").strip()
    rows.append({"date": date.today().isoformat(), "category": cat,
                 "amount": f"{amount:.2f}", "note": note})
    save(rows)
    print("✓ Logged.")

def show(rows):
    if not rows:
        print("No expenses yet — add one!")
        return
    for r in rows[-10:]:
        print(f"{r['date']}  {r['category']:<8} {float(r['amount']):8.2f}  {r['note']}")

def monthly(rows):
    m = date.today().strftime("%Y-%m")
    totals = Counter()
    for r in rows:
        if r["date"].startswith(m):
            totals[r["category"]] += float(r["amount"])
    print(f"\\n--- {m} ---")
    for cat, t in totals.most_common():
        print(f"{cat:<8} {t:8.2f}")
    print(f"{'TOTAL':<8} {sum(totals.values()):8.2f}")

def main():
    rows = load()
    while True:
        cmd = input("\\n(add / list / month / quit): ").strip().lower()
        if cmd == "add":
            add(rows)
        elif cmd == "list":
            show(rows)
        elif cmd == "month":
            monthly(rows)
        elif cmd in ("quit", "q", ""):
            print("Bye! 💰")
            break
        else:
            print("Unknown command.")

main()`,
    tryIt: true
  },
{
    id: "image-resizer", icon: "🖼️", title: "Bulk Image Resizer",
    level: "Intermediate", color: "#9d6bff",
    skills: "Pillow, pathlib, batch processing",
    desc: "Resize every image in a folder to web-friendly dimensions in one run — the same batch job every portfolio site and blog needs before launch.",
    steps: [
      "Point <code>SRC</code> at your photo folder and <code>DST</code> at the output folder — <code>pathlib</code> handles paths on any OS.",
      "Collect the images with <code>Path.iterdir()</code>, keeping only <code>.jpg</code> / <code>.png</code> / <code>.webp</code> files.",
      "Open each with <code>Image.open()</code> and call <code>thumbnail((1280, 1280))</code> — it shrinks the image while preserving the aspect ratio.",
      "Convert to RGB and save as an optimized JPEG (<code>quality=85</code>) into the output folder.",
      "<strong>Stretch:</strong> stamp a text watermark with <code>ImageDraw</code>, or skip the JPEG conversion and keep each file's original format.",
    ],
    code: `from pathlib import Path
from PIL import Image

SRC = Path("photos")        # folder with your originals
DST = Path("photos_web")    # resized copies land here
SIZE = (1280, 1280)         # max width/height; aspect ratio is preserved

def main():
    DST.mkdir(exist_ok=True)
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    files = [p for p in SRC.iterdir() if p.suffix.lower() in exts]
    print(f"Found {len(files)} images")
    for src in files:
        with Image.open(src) as im:
            im.thumbnail(SIZE)  # shrinks in place, keeps aspect ratio
            out = DST / (src.stem + ".jpg")
            im.convert("RGB").save(out, "JPEG", quality=85, optimize=True)
            print(f"  {src.name} -> {out.name} ({im.size[0]}x{im.size[1]})")
    print("Done!")

if __name__ == "__main__":
    main()
`,
    tryIt: false,
    note: "⚠️ Needs <code>pip install Pillow</code> on your machine."
  },
  {
    id: "sqlite-notes", icon: "🗄️", title: "Notes App with SQLite",
    level: "Advanced", color: "#f472b6",
    skills: "sqlite3, CRUD, datetime",
    desc: "A command-line notes app with real persistent storage: add, list, search and delete notes backed by a SQLite database file.",
    steps: [
      "Create the database with <code>CREATE TABLE IF NOT EXISTS notes</code> — the table is created once, then reused on every run.",
      "Write <code>add()</code>, <code>list_all()</code>, <code>search()</code> and <code>delete()</code> around one shared <code>get_db()</code> helper.",
      "Always use <code>?</code> placeholders instead of f-strings in your SQL — sqlite3 escapes parameters for you, which stops SQL injection attacks.",
      "Stamp every note with <code>datetime.now().isoformat()</code> so notes always sort chronologically.",
      "<strong>Stretch:</strong> add a <code>tags</code> table with a many-to-many join, or export all notes to a Markdown file.",
    ],
    code: `import sqlite3
from datetime import datetime

DB = "notes.db"

def get_db():
    con = sqlite3.connect(DB)
    con.execute(
        "CREATE TABLE IF NOT EXISTS notes ("
        "id INTEGER PRIMARY KEY, text TEXT NOT NULL, "
        "created TEXT NOT NULL)"
    )
    return con

def add(text):
    with get_db() as con:
        con.execute("INSERT INTO notes (text, created) VALUES (?, ?)",
                    (text, datetime.now().isoformat(timespec="seconds")))

def list_all():
    with get_db() as con:
        for nid, text, created in con.execute(
                "SELECT id, text, created FROM notes ORDER BY id"):
            print(f"[{nid}] {created} -- {text}")

def search(keyword):
    with get_db() as con:
        rows = con.execute(
            "SELECT id, text FROM notes WHERE text LIKE ?",
            ("%" + keyword + "%",)).fetchall()
    for nid, text in rows:
        print(f"[{nid}] {text}")
    if not rows:
        print("No matches.")

def delete(nid):
    with get_db() as con:
        cur = con.execute("DELETE FROM notes WHERE id = ?", (nid,))
        print("Deleted." if cur.rowcount else "No such note.")

if __name__ == "__main__":
    add("Buy milk")
    add("Read about parameterized queries")
    list_all()
    search("milk")
    delete(1)
    list_all()
`,
    tryIt: true,
  },
  {
    id: "log-analyzer", icon: "🔍", title: "Log Analyzer",
    level: "Advanced", color: "#f472b6",
    skills: "regex, Counter, argparse",
    desc: "Parse Apache-style server logs to find the top IP addresses, the error rate, and the busiest hours of the day.",
    steps: [
      "Match each log line with a <code>re.compile()</code> pattern using named groups for <code>ip</code>, <code>ts</code> and <code>status</code>.",
      "Tally IPs, status codes and hours with <code>collections.Counter</code> — one pass over the file, no nested loops.",
      "Count a line malformed (not crashed) when the regex doesn't match, and report how many were skipped.",
      "Add <code>argparse</code> so the script takes a log <code>file</code> argument plus a <code>--top</code> option for rows per section.",
      "<strong>Stretch:</strong> flag brute-force attacks — an IP with 20+ failed logins in 5 minutes.",
    ],
    code: `import argparse
import random
import re
from collections import Counter
from datetime import datetime, timedelta

LOG_RE = re.compile(
    r"(?P<ip>\\d+\\.\\d+\\.\\d+\\.\\d+) - - \\[(?P<ts>[^\\]]+)\\] "
    r'"(?P<method>\\w+) (?P<path>\\S+) HTTP/[\\d.]+" (?P<status>\\d{3}) (?P<size>\\d+|-)'
)

def sample_log(n=200, seed=7):
    """Generate fake Apache-style lines so the script runs standalone."""
    rng = random.Random(seed)
    ips = ["203.0.113.8", "198.51.100.23", "192.0.2.44",
           "203.0.113.8", "198.51.100.99"]
    paths = ["/", "/about", "/api/users", "/login", "/static/app.js"]
    base = datetime(2026, 11, 4, 9, 0, 0)
    lines = []
    for _ in range(n):
        ts = base + timedelta(minutes=rng.randrange(0, 600))
        status = rng.choices([200, 200, 200, 404, 500],
                             weights=[70, 10, 10, 7, 3])[0]
        lines.append(
            f"{rng.choice(ips)} - - [{ts.strftime('%d/%b/%Y:%H:%M:%S +0000')}] "
            f'"GET {rng.choice(paths)} HTTP/1.1" '
            f"{status} {rng.randrange(200, 9000)}"
        )
    return lines

def parse(lines):
    ips, statuses, hours = Counter(), Counter(), Counter()
    bad = 0
    for line in lines:
        m = LOG_RE.match(line)
        if not m:
            bad += 1
            continue
        ips[m.group("ip")] += 1
        statuses[m.group("status")] += 1
        hours[m.group("ts")[12:14]] += 1  # hour from "04/Nov/2026:09:.."
    return ips, statuses, hours, bad

def report(ips, statuses, hours, bad, top=5):
    total = sum(ips.values())
    print(f"Requests: {total}  (skipped {bad} malformed lines)")
    print("\\nTop IPs:")
    for ip, n in ips.most_common(top):
        print(f"  {ip:>15}  {n}")
    errors = sum(n for code, n in statuses.items()
                 if code.startswith(("4", "5")))
    rate = f"{errors / total:.1%}" if total else "n/a"
    print(f"\\nError rate: {rate} ({errors} of {total})")
    print("\\nBusiest hours:")
    for hour, n in hours.most_common(top):
        print(f"  {hour}:00  {'#' * min(n, 40)}")

def main():
    ap = argparse.ArgumentParser(description="Analyze Apache-style access logs.")
    ap.add_argument("file", nargs="?", help="log file (default: sample data)")
    ap.add_argument("--top", type=int, default=5, help="rows per section")
    args = ap.parse_args()
    lines = open(args.file).read().splitlines() if args.file else sample_log()
    ips, statuses, hours, bad = parse(lines)
    report(ips, statuses, hours, bad, top=args.top)

if __name__ == "__main__":
    main()
`,
    tryIt: true,
  },
  {
    id: "port-scanner", icon: "🕸️", title: "Port Scanner",
    level: "Advanced", color: "#fb923c",
    skills: "sockets, concurrent.futures",
    desc: "Scan the common ports on a host with threads and report what's open — a hands-on intro to sockets and concurrency.",
    steps: [
      "Probe a port with <code>socket.connect_ex()</code> and a short timeout — it returns <code>0</code> when the port is open instead of raising.",
      "Wrap each attempt in a <code>with socket.socket(...)</code> block so sockets always get closed.",
      "Fan the scans out with <code>ThreadPoolExecutor(max_workers=50)</code> — thirteen ports finish in about a second instead of thirteen.",
      "Translate open ports to names with a <code>WELL_KNOWN</code> dict (<code>22 → SSH</code>, <code>443 → HTTPS</code>, …).",
      "<strong>Stretch:</strong> grab the service banner with <code>s.recv(1024)</code> after connecting, or take the target and port range from <code>sys.argv</code>.",
    ],
    code: `import socket
from concurrent.futures import ThreadPoolExecutor

TARGET = "127.0.0.1"   # only scan hosts you own or have permission to scan
TIMEOUT = 0.5
WORKERS = 50

WELL_KNOWN = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS",
    3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis", 8080: "HTTP-alt",
}

def scan_port(port):
    """Return (port, True) if open, else (port, False)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(TIMEOUT)
        return port, s.connect_ex((TARGET, port)) == 0

def main():
    ports = sorted(WELL_KNOWN)
    print(f"Scanning {TARGET} ({len(ports)} ports)...")
    found = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for port, is_open in pool.map(scan_port, ports):
            if is_open:
                found += 1
                print(f"  [OPEN] {port:>5}  {WELL_KNOWN[port]}")
    print(f"Done -- {found} open port(s).")

if __name__ == "__main__":
    main()
`,
    tryIt: false,
    note: "⚠️ Sockets don't work in the in-browser compiler — run this on your machine. Only scan hosts you own."
  }
];
