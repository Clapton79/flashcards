const elements = {
  file: document.querySelector("#csv-file"),
  direction: document.querySelector("#direction"),
  count: document.querySelector("#question-count"),
  start: document.querySelector("#start-button"),
  fileLabel: document.querySelector("#file-label"),
  prompt: document.querySelector("#prompt"),
  form: document.querySelector("#answer-form"),
  answer: document.querySelector("#answer"),
  check: document.querySelector("#check-button"),
  feedback: document.querySelector("#feedback"),
  summary: document.querySelector("#summary"),
  chart: document.querySelector("#chart"),
  statsCaption: document.querySelector("#stats-caption"),
  openResults: document.querySelector("#open-results-button"),
  saveResults: document.querySelector("#save-results-button"),
  status: document.querySelector("#status"),
};

const HISTORY_KEY = "language-flashcards-session-results";
const RESULTS_FILE_NAME = "language-flashcards.json";

const state = {
  fileName: "",
  fileId: "",
  words: [],
  weights: {},
  questions: [],
  currentWord: null,
  score: 0,
  questionNumber: 0,
  answered: false,
  results: [],
  sessionSaved: false,
  resultsFileHandle: null,
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (!rows.length) throw new Error("The CSV is empty.");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const huIndex = headers.indexOf("hungarian");
  const foreignIndex = headers.indexOf("foreign");
  if (huIndex < 0 || foreignIndex < 0) {
    throw new Error("CSV headers must include Hungarian and Foreign.");
  }

  return rows.slice(1)
    .map((values) => ({
      Hungarian: (values[huIndex] || "").trim(),
      Foreign: (values[foreignIndex] || "").trim(),
    }))
    .filter((word) => word.Hungarian && word.Foreign);
}

function wordKey(word) {
  return `${word.Hungarian}\t${word.Foreign}`;
}

function storageKey() {
  return `language-flashcards-weights:${state.fileId}`;
}

function loadWeights() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey()) || "{}");
  } catch {
    saved = {};
  }
  state.weights = Object.fromEntries(state.words.map((word) => {
    const savedWeight = Number(saved[wordKey(word)]);
    return [wordKey(word), Number.isFinite(savedWeight) ? Math.max(1, Math.floor(savedWeight)) : 1];
  }));
}

function saveWeights() {
  localStorage.setItem(storageKey(), JSON.stringify(state.weights));
}

function getHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function setHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-100)));
}

function resultKey(entry) {
  return `${entry.date}|${entry.file}|${entry.direction}|${entry.score}|${entry.total}`;
}

function mergeHistory(...histories) {
  const merged = [];
  const keys = new Set();
  histories.flat().forEach((entry) => {
    if (!entry || typeof entry !== "object" || !entry.date || !Number.isFinite(entry.rate)) return;
    const key = resultKey(entry);
    if (!keys.has(key)) {
      keys.add(key);
      merged.push(entry);
    }
  });
  return merged.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function saveSession() {
  if (state.sessionSaved || !state.questions.length) return;
  const history = getHistory();
  history.push({
    date: new Date().toISOString(),
    file: state.fileName,
    direction: elements.direction.value,
    score: state.score,
    total: state.questions.length,
    rate: Math.round((state.score / state.questions.length) * 100),
  });
  setHistory(history);
  state.sessionSaved = true;
  renderStats();
}

function renderStats() {
  const history = getHistory();
  elements.chart.replaceChildren();
  if (!history.length) {
    elements.statsCaption.textContent = "Complete a test to add a result.";
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No results saved yet.";
    elements.chart.append(empty);
    return;
  }

  const recent = history.slice(-20);
  const width = 600;
  const height = 120;
  const padding = 12;
  const xStep = recent.length > 1
    ? (width - padding * 2) / (recent.length - 1)
    : 0;
  const points = recent.map((entry, index) => {
    const x = recent.length === 1 ? width / 2 : padding + xStep * index;
    const y = height - padding - (entry.rate / 100) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Success rate over the last practice sessions");
  const baseline = document.createElementNS("http://www.w3.org/2000/svg", "line");
  baseline.setAttribute("x1", padding);
  baseline.setAttribute("x2", width - padding);
  baseline.setAttribute("y1", height - padding);
  baseline.setAttribute("y2", height - padding);
  baseline.setAttribute("stroke", "#cbd5e1");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#2563eb");
  line.setAttribute("stroke-width", "4");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  svg.append(baseline, line);
  recent.forEach((entry, index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const [x, y] = points.split(" ")[index].split(",");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "5");
    circle.setAttribute("fill", "#2563eb");
    circle.setAttribute("aria-label", `${entry.rate}%`);
    svg.append(circle);
  });
  elements.chart.append(svg);
  const latest = recent.at(-1);
  elements.statsCaption.textContent = `${recent.length} session${recent.length === 1 ? "" : "s"} • Latest success rate: ${latest.rate}%`;
}

async function readResultsFile(handle) {
  const file = await handle.getFile();
  const contents = await file.text();
  if (!contents.trim()) return [];
  const parsed = JSON.parse(contents);
  if (!Array.isArray(parsed)) throw new Error("The results file must contain a JSON array.");
  return parsed;
}

async function openResultsFile() {
  if (!window.showOpenFilePicker) {
    alert("This browser does not support opening files directly. Use Save results to download a copy.");
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "Flashcard results", accept: { "application/json": [".json"] } }],
    });
    const fileHistory = await readResultsFile(handle);
    const history = mergeHistory(fileHistory, getHistory());
    setHistory(history);
    state.resultsFileHandle = handle;
    renderStats();
  } catch (error) {
    if (error.name !== "AbortError") alert(`Could not open results file: ${error.message}`);
  }
}

async function saveResults() {
  const history = getHistory();
  if (!history.length) {
    alert("Complete a test before saving results.");
    return;
  }

  if (!state.resultsFileHandle && window.showSaveFilePicker) {
    try {
      state.resultsFileHandle = await window.showSaveFilePicker({
        suggestedName: RESULTS_FILE_NAME,
        types: [{ description: "Flashcard results", accept: { "application/json": [".json"] } }],
      });
    } catch (error) {
      if (error.name !== "AbortError") alert(`Could not choose results file: ${error.message}`);
      return;
    }
  }

  if (state.resultsFileHandle) {
    try {
      const existing = await readResultsFile(state.resultsFileHandle);
      const combined = mergeHistory(existing, history);
      const writable = await state.resultsFileHandle.createWritable();
      await writable.write(`${JSON.stringify(combined, null, 2)}\n`);
      await writable.close();
      setHistory(combined);
      renderStats();
      elements.statsCaption.textContent = `${combined.length} sessions saved to ${RESULTS_FILE_NAME}`;
      return;
    } catch (error) {
      alert(`Could not save results: ${error.message}`);
      return;
    }
  }

  const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = RESULTS_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

function normalize(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function weightedChoice() {
  const total = state.words.reduce((sum, word) => sum + state.weights[wordKey(word)], 0);
  let target = Math.random() * total;
  for (const word of state.words) {
    target -= state.weights[wordKey(word)];
    if (target <= 0) return word;
  }
  return state.words.at(-1);
}

function setPracticeEnabled(enabled) {
  elements.answer.disabled = !enabled;
  elements.check.disabled = !enabled;
}

function showNextQuestion() {
  if (state.questionNumber >= state.questions.length) {
    elements.prompt.textContent = "Session complete!";
    elements.feedback.textContent = "Test complete.";
    elements.feedback.className = "feedback";
    elements.status.textContent = "Press Start to practice again.";
    showSummary();
    state.currentWord = null;
    setPracticeEnabled(false);
    return;
  }

  state.currentWord = state.questions[state.questionNumber];
  state.questionNumber += 1;
  elements.prompt.textContent = elements.direction.value === "hu-foreign"
    ? state.currentWord.Hungarian
    : state.currentWord.Foreign;
  elements.answer.value = "";
  elements.answer.focus();
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  elements.summary.hidden = true;
  elements.summary.replaceChildren();
  elements.status.textContent = `Question ${state.questionNumber} of ${state.questions.length} • Score: ${state.score}`;
  state.answered = false;
}

function showSummary() {
  saveSession();
  const total = state.questions.length;
  const percentage = Math.round((state.score / total) * 100);
  const heading = document.createElement("h2");
  heading.textContent = "Test summary";
  const result = document.createElement("p");
  result.textContent = `Score: ${state.score} / ${total} (${percentage}%)`;
  elements.summary.replaceChildren(heading, result);

  const missed = state.results.filter((entry) => !entry.correct);
  if (missed.length) {
    const missedLabel = document.createElement("p");
    missedLabel.textContent = `Words to review: ${missed.length}`;
    const list = document.createElement("ul");
    missed.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `${entry.prompt} — `;
      const answer = document.createElement("span");
      answer.className = "missed-answer";
      answer.textContent = entry.expected;
      item.append(answer);
      list.append(item);
    });
    elements.summary.append(missedLabel, list);
  } else {
    const perfect = document.createElement("p");
    perfect.textContent = "Perfect session — no words to review.";
    elements.summary.append(perfect);
  }
  elements.summary.hidden = false;
}

function startQuiz() {
  if (!state.words.length) {
    alert("Choose a vocabulary CSV first.");
    return;
  }
  const count = Number(elements.count.value);
  if (!Number.isInteger(count) || count < 1) {
    alert("Enter a question count of at least 1.");
    return;
  }
  state.questions = Array.from({ length: count }, weightedChoice);
  state.score = 0;
  state.questionNumber = 0;
  state.results = [];
  state.sessionSaved = false;
  elements.summary.hidden = true;
  elements.summary.replaceChildren();
  setPracticeEnabled(true);
  showNextQuestion();
}

function checkAnswer(event) {
  event.preventDefault();
  if (!state.currentWord || state.answered) return;
  state.answered = true;

  const expected = elements.direction.value === "hu-foreign"
    ? state.currentWord.Foreign
    : state.currentWord.Hungarian;
  const key = wordKey(state.currentWord);
  const correct = normalize(elements.answer.value) === normalize(expected);
  state.results.push({
    prompt: elements.prompt.textContent,
    expected,
    correct,
  });

  if (correct) {
    state.score += 1;
    state.weights[key] = Math.max(1, state.weights[key] - 1);
    elements.feedback.textContent = "Correct!";
    elements.feedback.className = "feedback correct";
  } else {
    state.weights[key] += 2;
    elements.feedback.textContent = `Not quite — the answer is: ${expected}`;
    elements.feedback.className = "feedback incorrect";
  }
  saveWeights();
  elements.status.textContent = `Question ${state.questionNumber} of ${state.questions.length} • Score: ${state.score}`;
  window.setTimeout(showNextQuestion, 900);
}

elements.file.addEventListener("change", async () => {
  const file = elements.file.files[0];
  if (!file) return;
  try {
    const words = parseCsv(await file.text());
    if (!words.length) throw new Error("The CSV has no usable word pairs.");
    state.fileName = file.name;
    state.fileId = `${file.name}:${await file.text()}`.slice(0, 5000);
    state.words = words;
    loadWeights();
    elements.fileLabel.textContent = `${file.name} — ${words.length} word pairs`;
    elements.prompt.textContent = "Ready to practice";
    elements.status.textContent = "Choose a direction and question count, then press Start.";
    setPracticeEnabled(false);
  } catch (error) {
    alert(`Could not load CSV: ${error.message}`);
  }
});

elements.start.addEventListener("click", startQuiz);
elements.form.addEventListener("submit", checkAnswer);
elements.openResults.addEventListener("click", openResultsFile);
elements.saveResults.addEventListener("click", saveResults);
renderStats();
