# ECE-to-AI: The Gauntlet

A local cyber-RPG for an ECE graduate learning Python, backend engineering and AI engineering. Your browser is the quest console; your editor is the workbench. You write real Python, and pytest verifies it.

## Launch on your Mac

1. Install **Python 3.12** (recommended; 3.11+ supported) if you do not already have it. VS Code is optional but recommended as your editor.
2. Extract `ECE-to-AI.zip`. In Terminal, change into the extracted `ECE-to-AI` folder.
3. Run:

```bash
./setup_and_run.sh
```

Open **http://localhost:8000**. Keep Terminal running; press Ctrl+C to stop. First launch needs internet access and may take several minutes to install Chroma and the other dependencies. Later launches reuse `.venv` and work offline for lessons, quizzes and verification. There are no CDN fonts, CSS libraries or scripts.

If the ZIP extractor drops executable permissions, use `bash setup_and_run.sh`. If your default Python is too old, use `GAUNTLET_PYTHON=python3.12 ./setup_and_run.sh` after installing Python 3.12. If port 8000 is occupied, stop the other service before relaunching. Do not move the project with an existing virtual environment; recreate `.venv` after moving it.

## Play your first mission

The home screen shows one **Up next** card; click **Continue**. Every mission has three steps, shown one at a time:

1. **Learn**: short lesson pages (one idea each, with runnable-looking examples and their output) and practice questions. Practice questions never cost HP. Use ← / → to move between pages.
2. **Quiz**: three questions; get 3/3 in one attempt to unlock Build. The quiz only opens once the lesson is finished.
3. **Build**: click **Create file**, open it in VS Code, implement the function, save, and click **Run tests**. Failures show the failing assertions first; the full pytest log is one click away.

`workspace/` is a directory **inside this project**, not `/workspace` at the filesystem root. Initializing again preserves existing work. Boss initialization also copies sample documents and helper files.

## What is implemented

| World | Four levels | Boss project |
|---|---|---|
| Silicon Citadel | Variables, filtering, JSON, secure SDK calls | CLI AI research assistant |
| Nexus Grid | GET, Pydantic/POST, SQLite, async/errors | AI classification REST service |
| Vector Vault | Chunking, cosine similarity, Chroma, grounding | Document RAG with exact source quotes |
| Production Forge | Tool dispatch, bounded agents, browser fetch, Docker | Multi-source agent service with UI and container files |

All **16 levels** have a briefing, code example, three questions, a starter template, function contracts, hints, and executable tests. World 1 lessons are expanded for beginners. Each world has a **10-question Gatekeeper**, available after all four coding quests. Pass at least 8/10 to earn its Boss Key. Timed mode allows five minutes; untimed mode is also available. A previous-world boss defeat unlocks the next world.

The four bosses provide starter projects and full test contracts. They are projects **you build**, not pre-solved answers. Tests check behavior, edge cases, fake AI integration, persistence, retrieval, citation validation, and portfolio artifacts. The game is a learning tool, not a tamper-proof examination system: its files and tests are inspectable and editable locally.

## Game rules

- Start with 100 HP. Wrong quiz answers and failed code submissions cost 10 HP.
- At zero HP, visit the Med Bay; recovery is free and preserves completed progress, but clears the active trial and current answer streak.
- Pass a level quiz: +30 XP once and a 1.5× code reward multiplier.
- First code clear: 100 × 1.5 = 150 XP, plus 20 HP up to 100.
- Gatekeeper pass: +100 XP once. Boss clear: +300 XP once.
- Player level increases every 200 XP. Repeated clears do not farm XP.
- Boss HP is 100 until its complete verification passes, then 0. Partial passes are feedback, not partial boss damage.
- Training Grounds offers five randomized questions from completed levels. Missed and overdue cards have greater selection weight. Correct recalls expand the review interval to 1, 2, 4…30 days; a miss makes the card immediately due. With only one completed level, cards repeat to fill five slots.
- The first completed daily session earns 10 XP per correct answer (up to 50 XP). Later sessions still update review scheduling but award no XP. Dates follow your Mac's local date.

## Real Gemini calls

No API key is needed for verification. Tests use injected clients, stub responses and synthetic vectors. Chroma receives explicit vectors, so these tests do not download an embedding model.

The launcher copies `.env.example` to `.env` if absent. For live calls, set:

```dotenv
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=a_generation_model_available_to_your_account
GEMINI_EMBED_MODEL=an_embedding_model_available_to_your_account
```

Model IDs are deliberately configurable because model availability changes. Your live calls use your own account and can incur charges. Never put a real key in source, browser JavaScript, a Dockerfile or Git. `.env` is a local convenience, not encryption.

World 1.4 teaches the official `google-genai` client directly. Boss 1 must create its own secure live client. The later boss folders receive `gauntlet_ai.py`, which supplies lazy live adapters for JSON generation, embeddings, grounded answers and tool decisions. No adapter calls the network at import time. Implement the default branches described in each boss contract so your finished projects work without injected fakes.

For Boss 1, after implementing it:

```bash
source .venv/bin/activate
python workspace/world1_boss/assistant.py workspace/world1_boss/sample.txt workspace/world1_boss/result.json
```

For Boss 2, once implemented, run it on a separate port:

```bash
python -m uvicorn server:app --app-dir workspace/world2_boss --host 127.0.0.1 --port 8001
```

For the final boss, make its `requirements.txt` include all runtime dependencies used by your implementation, including `google-genai` and `python-dotenv` if you use the supplied adapter.

## Docker verification boundary

Level 4.4 and the final boss check the Dockerfile recipe, requirements, ignore files and Python service behavior. They do **not** start Docker or prove the built image runs. Docker Desktop is optional until you reach this stage. After finishing the final boss, run:

```bash
cd workspace/world4_boss
docker build -t ece-ai-agent .
docker run --rm -p 127.0.0.1:8001:8000 --env-file ../../.env ece-ai-agent
```

Open http://localhost:8001 and test the actual UI. Include `gauntlet_ai.py`, `docs.json` and `index.html` in your project. Confirm `.dockerignore` excludes secrets before building.

## Persistence and backups

Progress lives in `data/save.sqlite3`: XP, HP, trial scores, keys, completed quests, badges, streaks, active trial and spaced-review scheduling. Close the game, then back up this file together with `workspace/`. To restore, stop the server and replace the database with your backup. **Export save snapshot** produces readable JSON for inspection; this release does not provide JSON import.

## Project layout

- `app/main.py`: local API, SQLite persistence, progression, quizzes and verification orchestration.
- `app/runner.py`: pytest subprocess entry point and best-effort resource limits.
- `static/`: responsive HTML, local CSS and vanilla JavaScript.
- `content/lessons.json`: paged lessons and practice questions for each level.
- `content/curriculum.json`: mission contracts and question bank; `bosses.json`: boss contracts.
- `templates/`: immutable starter assets copied on demand.
- `verification/`: 20 quest/boss test modules and shared helpers.
- `tests/`: platform regression tests (separate from learner verification).
- `workspace/`: your code; initially empty.
- `gauntlet_ai.py`: configurable live Gemini adapters.

## Run tests

```bash
source .venv/bin/activate
python -m pytest -q                         # platform tests, no learner work required
python -m pytest verification/test_1_1.py -q # a single initialized learner quest
```

Running the entire `verification/` directory before completing the campaign will naturally fail for unfinished or uninitialized quests. Tests are visible so you can learn from them. Browser-triggered verification uses a separate Python process, a 45-second timeout, a 35-second CPU limit and a bounded log. It does not inherit API-key environment variables. Learner code can still read local files, including `.env`, if written to do so.

**Execution is not sandboxed.** Your code runs with your Mac user permissions. Only run code you trust. The launcher binds to 127.0.0.1; mutation routes require a local UI header and reject foreign browser origins. Do not expose this development application to a public network. One server process and one local player are supported.

## Validation and limits

The platform regression tests passed, and 67 quest checks passed against separate working validation implementations, including fake-client SDK calls, a real CLI subprocess, FastAPI endpoint requests and persistent Chroma retrieval. Those validation solutions are not included in your workspace. Python compilation and JavaScript syntax checks passed. Visual browser QA could not be completed in the build environment; live Gemini calls, Docker builds and execution on an actual Mac remain local integration checks.

Tests are finite checks, not proof of arbitrary program correctness or semantic answer quality. Grounding checks verify known source IDs and exact quotes, not whether every generated claim logically follows from them.

## Official references

- Python tutorial: https://docs.python.org/3/tutorial/
- FastAPI testing: https://fastapi.tiangolo.com/tutorial/testing/
- Google Gen AI SDK: https://googleapis.github.io/python-genai/
- Chroma Python reference: https://docs.trychroma.com/reference/python
- Dockerfile reference: https://docs.docker.com/reference/dockerfile/
