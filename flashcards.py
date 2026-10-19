import csv
import json
import random
import re
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk


ANSWER_DISPLAY_MS = 5000


class FlashcardApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Language Flashcards")
        self.root.geometry("650x430")
        self.root.minsize(500, 350)

        self.csv_path = None
        self.words = []
        self.weights = {}
        self.questions = []
        self.current_word = None
        self.score = 0
        self.question_number = 0

        self.direction = tk.StringVar(value="Hungarian → Foreign")
        self.question_count = tk.StringVar(value="20")
        self.status = tk.StringVar(value="Load a CSV file to begin.")
        self.search_text = tk.StringVar()

        self._build_ui()

    def _build_ui(self):
        controls = ttk.Frame(self.root, padding=12)
        controls.pack(fill="x")

        ttk.Button(controls, text="Choose CSV…", command=self.choose_file).pack(
            side="left"
        )

        ttk.Label(controls, text="Direction:").pack(side="left", padx=(18, 5))
        self.direction_box = ttk.Combobox(
            controls,
            textvariable=self.direction,
            values=("Hungarian → Foreign", "Foreign → Hungarian"),
            state="readonly",
            width=22,
        )
        self.direction_box.pack(side="left")

        ttk.Label(controls, text="Questions:").pack(side="left", padx=(14, 5))
        ttk.Spinbox(
            controls, from_=1, to=999, textvariable=self.question_count, width=5
        ).pack(side="left")

        ttk.Button(controls, text="Start", command=self.start_quiz).pack(
            side="left", padx=10
        )

        search_row = ttk.Frame(self.root, padding=(12, 0, 12, 6))
        search_row.pack(fill="x")

        ttk.Label(search_row, text="Search:").pack(side="left", padx=(0, 5))
        self.search_entry = ttk.Entry(search_row, textvariable=self.search_text)
        self.search_entry.pack(side="left", fill="x", expand=True)
        self.search_entry.bind("<Return>", lambda _event: self.search_words())

        ttk.Button(search_row, text="Search", command=self.search_words).pack(
            side="left", padx=10
        )

        self.file_label = ttk.Label(self.root, text="No CSV selected", padding=(12, 0))
        self.file_label.pack(anchor="w")

        self.card = ttk.Label(
            self.root,
            text="Choose a CSV file",
            anchor="center",
            justify="center",
            font=("TkDefaultFont", 28, "bold"),
            wraplength=560,
            relief="ridge",
            padding=30,
        )
        self.card.pack(fill="both", expand=True, padx=24, pady=16)

        answer_row = ttk.Frame(self.root, padding=(24, 0, 24, 12))
        answer_row.pack(fill="x")

        self.answer_entry = ttk.Entry(answer_row, font=("TkDefaultFont", 16))
        self.answer_entry.pack(side="left", fill="x", expand=True)
        self.answer_entry.bind("<Return>", lambda _event: self.check_answer())

        self.check_button = ttk.Button(
            answer_row, text="Check", command=self.check_answer, state="disabled"
        )
        self.check_button.pack(side="left", padx=(8, 0))

        self.feedback = ttk.Label(self.root, text="", anchor="center")
        self.feedback.pack(fill="x", pady=(0, 4))

        ttk.Label(self.root, textvariable=self.status, anchor="center").pack(
            fill="x", pady=(0, 12)
        )

    def choose_file(self):
        selected = filedialog.askopenfilename(
            title="Choose vocabulary CSV",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
        )
        if not selected:
            return

        try:
            words = self.load_csv(Path(selected))
        except (OSError, ValueError, csv.Error) as error:
            messagebox.showerror("Could not load CSV", str(error))
            return

        if not words:
            messagebox.showerror("Empty vocabulary", "The CSV has no usable word pairs.")
            return

        self.csv_path = Path(selected)
        self.words = words
        self._load_weights()
        self.file_label.config(
            text=f"{self.csv_path.name} — {len(self.words)} word pairs"
        )
        self.card.config(text="Ready to practice")
        self.status.set("Choose a direction and question count, then press Start.")

    @staticmethod
    def wildcard_to_regex(pattern):
        # * matches any run of characters, ? matches one; no wildcard means "contains".
        pattern = pattern.strip()
        if "*" not in pattern and "?" not in pattern:
            pattern = f"*{pattern}*"
        parts = []
        for char in pattern:
            if char == "*":
                parts.append(".*")
            elif char == "?":
                parts.append(".")
            else:
                parts.append(re.escape(char))
        return re.compile("".join(parts), re.IGNORECASE | re.DOTALL)

    def search_words(self):
        if not self.words:
            messagebox.showinfo("Choose a file", "Choose a vocabulary CSV first.")
            return

        query = self.search_text.get().strip()
        if not query:
            return

        regex = self.wildcard_to_regex(query)
        matches = [
            word
            for word in self.words
            if regex.fullmatch(word["Hungarian"]) or regex.fullmatch(word["Foreign"])
        ]

        window = tk.Toplevel(self.root)
        window.title(f"Search results: {query}")
        window.geometry("520x360")

        table = ttk.Treeview(
            window, columns=("hu", "foreign"), show="headings", selectmode="browse"
        )
        table.heading("hu", text="Hungarian")
        table.heading("foreign", text="Foreign")
        table.column("hu", width=250)
        table.column("foreign", width=250)
        scrollbar = ttk.Scrollbar(window, orient="vertical", command=table.yview)
        table.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        table.pack(fill="both", expand=True)

        for word in matches:
            table.insert("", "end", values=(word["Hungarian"], word["Foreign"]))

        self.status.set(f"Search '{query}': {len(matches)} match(es)")

    @staticmethod
    def load_csv(path):
        with path.open("r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)

            if not reader.fieldnames:
                raise ValueError("The CSV needs a header row: Hungarian,Foreign")

            headers = {name.strip().casefold(): name for name in reader.fieldnames}
            if "hungarian" not in headers or "foreign" not in headers:
                raise ValueError("CSV headers must include Hungarian and Foreign.")

            hu_col = headers["hungarian"]
            foreign_col = headers["foreign"]
            words = []

            for row in reader:
                hungarian = (row.get(hu_col) or "").strip()
                foreign = (row.get(foreign_col) or "").strip()
                if hungarian and foreign:
                    words.append({"Hungarian": hungarian, "Foreign": foreign})

            return words

    def _weights_path(self):
        return self.csv_path.with_suffix(".weights.json")

    def _word_key(self, word):
        return f"{word['Hungarian']}\t{word['Foreign']}"

    def _load_weights(self):
        path = self._weights_path()
        try:
            saved = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(saved, dict):
                saved = {}
        except (OSError, json.JSONDecodeError):
            saved = {}

        self.weights = {
            self._word_key(word): max(1, int(saved.get(self._word_key(word), 1)))
            for word in self.words
        }

    def _save_weights(self):
        if not self.csv_path:
            return
        try:
            self._weights_path().write_text(
                json.dumps(self.weights, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError as error:
            messagebox.showwarning("Progress not saved", str(error))

    def start_quiz(self):
        if not self.words:
            messagebox.showinfo("Choose a file", "Choose a vocabulary CSV first.")
            return

        try:
            count = int(self.question_count.get())
            if count < 1:
                raise ValueError
        except ValueError:
            messagebox.showerror("Invalid number", "Enter a question count of at least 1.")
            return

        # Draw with replacement so short lists can still fill a longer session.
        self.questions = random.choices(
            self.words,
            weights=[self.weights[self._word_key(word)] for word in self.words],
            k=count,
        )
        self.score = 0
        self.question_number = 0
        self.check_button.config(state="normal")
        self.next_question()

    def next_question(self):
        if self.question_number >= len(self.questions):
            self.card.config(text="Session complete!")
            self.answer_entry.delete(0, tk.END)
            self.feedback.config(text=f"Score: {self.score} / {len(self.questions)}")
            self.status.set("Press Start to practice again.")
            self.check_button.config(state="disabled")
            return

        self.current_word = self.questions[self.question_number]
        if self.direction.get() == "Hungarian → Foreign":
            prompt = self.current_word["Hungarian"]
        else:
            prompt = self.current_word["Foreign"]

        self.question_number += 1
        self.card.config(text=prompt)
        self.answer_entry.delete(0, tk.END)
        self.answer_entry.focus_set()
        self.feedback.config(text="")
        self.status.set(
            f"Question {self.question_number} of {len(self.questions)}"
            f"     •     Score: {self.score}"
        )

    @staticmethod
    def normalize(text):
        return " ".join(text.casefold().strip().split())

    def check_answer(self):
        if not self.current_word:
            return

        if self.direction.get() == "Hungarian → Foreign":
            correct = self.current_word["Foreign"]
        else:
            correct = self.current_word["Hungarian"]

        answer = self.answer_entry.get()
        key = self._word_key(self.current_word)

        if self.normalize(answer) == self.normalize(correct):
            self.score += 1
            self.weights[key] = max(1, self.weights[key] - 1)
            self.feedback.config(text="Correct!", foreground="green")
        else:
            self.weights[key] += 2
            self.feedback.config(
                text=f"Not quite — the answer is: {correct}",
                foreground="firebrick",
            )

        self._save_weights()
        self.root.after(ANSWER_DISPLAY_MS, self.next_question)


if __name__ == "__main__":
    root = tk.Tk()
    app = FlashcardApp(root)
    root.mainloop()
