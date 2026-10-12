# Language Flashcards

## Browser version

The browser version is self-contained and requires no installation or build
tools. Open [index.html](./index.html) in a browser, then click **Choose
CSV…** and select a vocabulary file.

```text
index.html   application page
styles.css   responsive visual styling
app.js       CSV parsing, quiz logic, weighted selection, and progress
```

Browser security prevents a web page from writing a progress file beside the
CSV. The browser version therefore stores weights in `localStorage`, keyed by
the selected file name and contents. Your CSV remains unchanged and editable.
Progress is kept in the same browser on the same computer.

Session scores are also stored in `localStorage` (up to the latest 100
sessions). The chart displays the latest 20 session success rates.

The browser version is the recommended way to use the app. The original
Python/Tkinter version remains below for desktop use.

A small Tkinter app for practicing Hungarian ↔ German / Hungarian ↔ Spanish
vocabulary with weighted spaced repetition.

## Setup (already done on this machine)

Tkinter isn't installable via pip — it's a binding to the system Tcl/Tk
library. On macOS with Homebrew Python it was installed via:

```bash
brew install python-tk@3.14
```

(match the `@3.14` to your `python3 --version`).

## Running

```bash
python3 flashcards.py
```

No other dependencies are required — the app only uses the Python standard
library (`csv`, `json`, `random`, `tkinter`).

## Usage

1. Click **Choose CSV…** and pick a vocabulary file, e.g. `data_HU_DE.csv`
   (Hungarian ↔ German) or `data_HU_ES.csv` (Hungarian ↔ Spanish).
2. Pick a **Direction**: "Hungarian → Foreign" or "Foreign → Hungarian".
   The "Foreign" language is whatever is in the CSV's `Foreign` column, so
   the same two directions cover both German and Spanish depending on which
   file you load.
3. Set how many **Questions** you want in the session.
4. Click **Start**, type the translation for each tile, and press Enter or
   **Check**.
5. After the final question, review the **Test summary** for your score,
   percentage, and any words you missed.
6. The **Success rate over time** chart is updated after every completed
   session. Results are saved automatically in the browser, and **Save
   results** downloads the saved session history as
   `language-flashcards.json`.

To keep using one results file, click **Open results file** and select
`language-flashcards.json` once. Future **Save results** clicks append any new
sessions to that JSON array and update the chart from the combined history.
Browsers without the File System Access API use a download fallback instead.

## Data files

CSV format, header required:

```csv
Hungarian,Foreign
kutya,Hund
ház,Haus
```

Add as many rows as you like — edit the CSV directly (in a spreadsheet app
or a text editor) and reload it in the app.

## Weighting / spaced repetition

Next to each CSV, the app keeps a `<name>.weights.json` file (created
automatically) that tracks how often each word has been missed. Words you
get wrong become more likely to reappear; words you answer correctly
gradually become less frequent. Delete the `.weights.json` file to reset
progress for that word list.
