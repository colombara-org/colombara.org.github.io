/**
 * Bible Memorization App — app.js
 *
 * Loads verse data from verses.csv, populates dropdowns, and handles
 * Memorization and Check Yourself modes with localStorage state persistence.
 *
 * IMPORTANT: fetch() requires a web server. This will NOT work when opened
 * as a local file:// URL in most browsers due to browser security restrictions.
 * Serve it via GitHub Pages, VS Code Live Server, or `npx serve memorize/`.
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE = {
  book:             'bible-mem-book',
  chapter:          'bible-mem-chapter',
  translation:      'bible-mem-translation',
  verse:            'bible-mem-verse',
  mode:             'bible-mem-mode',
  instructionsSeen: 'bible-mem-instructions-seen',
};

// Instruction text for each mode
const INSTRUCTIONS = {
  memorize: 'Read the verse out loud 10 times, including the verse reference each time. '
    + 'Look carefully at each word as you read. Pay attention to the rhythm and flow. '
    + 'Then click Hide, cover your eyes, and recite the verse from memory 10 times — '
    + 'always beginning with the verse reference. Glance at the text if you need to, then keep going.',
  check: 'Say the verse reference, then recite the verse from memory. '
    + 'When you\'re ready, click Show to check yourself.',
};

// ── State ─────────────────────────────────────────────────────────────────────

let allVerses     = [];  // every row from verses.csv
let currentVerses = [];  // rows for the selected book + chapter + translation
let currentIndex  = 0;   // position within currentVerses
let currentMode   = 'memorize';
let textVisible   = true;

// ── DOM references ────────────────────────────────────────────────────────────

const bookSelect        = document.getElementById('book-select');
const chapterSelect     = document.getElementById('chapter-select');
const verseSelect       = document.getElementById('verse-select');
const translationSelect = document.getElementById('translation-select');
const modeMemorize      = document.getElementById('mode-memorize');
const modeCheck         = document.getElementById('mode-check');
const instructionsEl    = document.getElementById('instructions');
const instructionsText  = document.getElementById('instructions-text');
const verseReference    = document.getElementById('verse-reference');
const verseText         = document.getElementById('verse-text');
const verseTranslation  = document.getElementById('verse-translation');
const hideShowBtn       = document.getElementById('hide-show-btn');
const prevBtn           = document.getElementById('prev-btn');
const nextBtn           = document.getElementById('next-btn');
const endMessage        = document.getElementById('end-message');

// ── CSV parser ────────────────────────────────────────────────────────────────
// Handles quoted fields (commas inside quotes) and escaped double-quotes ("")

function parseCSVLine(line) {
  const fields = [];
  let field    = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // "" inside a quoted field → literal double-quote
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function parseCSV(text) {
  const lines   = text.trim().split(/\r?\n/);
  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  return lines
    .slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = parseCSVLine(line);
      const row    = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] || '').trim();
      });
      return row;
    });
}

// ── Dropdown population ───────────────────────────────────────────────────────

function populateBooks() {
  // Collect unique books keyed by canonical order, then sort
  const seen = {};
  allVerses.forEach(v => {
    if (!(v.book in seen)) seen[v.book] = parseInt(v.order, 10);
  });

  const books = Object.entries(seen)
    .sort((a, b) => a[1] - b[1])
    .map(([book]) => book);

  bookSelect.innerHTML = '';
  books.forEach(book => {
    const opt      = document.createElement('option');
    opt.value      = book;
    opt.textContent = book;
    bookSelect.appendChild(opt);
  });
}

function populateChapters() {
  const book     = bookSelect.value;
  const chapters = [...new Set(
    allVerses.filter(v => v.book === book).map(v => parseInt(v.chapter, 10))
  )].sort((a, b) => a - b);

  chapterSelect.innerHTML = '';
  chapters.forEach(ch => {
    const opt      = document.createElement('option');
    opt.value      = String(ch);
    opt.textContent = String(ch);
    chapterSelect.appendChild(opt);
  });
}

function populateTranslations() {
  const book        = bookSelect.value;
  const chapter     = chapterSelect.value;
  const translations = [...new Set(
    allVerses
      .filter(v => v.book === book && v.chapter === chapter)
      .map(v => v.translation)
  )].sort();

  translationSelect.innerHTML = '';
  translations.forEach(t => {
    const opt      = document.createElement('option');
    opt.value      = t;
    opt.textContent = t;
    translationSelect.appendChild(opt);
  });
}

// ── Verse filtering & display ─────────────────────────────────────────────────

// Rebuild the verse dropdown to match the current currentVerses list.
// Called whenever currentVerses changes (i.e. after filterVerses).
function populateVerseDropdown() {
  verseSelect.innerHTML = '';
  currentVerses.forEach((v, i) => {
    const opt      = document.createElement('option');
    opt.value      = String(i);        // option value is the array index
    opt.textContent = v.verse;         // label is the verse number (e.g. "1")
    verseSelect.appendChild(opt);
  });
  verseSelect.value = String(currentIndex);
}

// Convenience: filter then immediately refresh the verse dropdown.
// Use this everywhere instead of calling filterVerses() directly.
function applyFilter() {
  filterVerses();
  populateVerseDropdown();
}

function filterVerses() {
  const book        = bookSelect.value;
  const chapter     = chapterSelect.value;
  const translation = translationSelect.value;

  currentVerses = allVerses
    .filter(v => v.book === book && v.chapter === chapter && v.translation === translation)
    .sort((a, b) => parseInt(a.verse, 10) - parseInt(b.verse, 10));

  currentIndex = 0;
}

function displayCurrentVerse() {
  endMessage.classList.add('hidden');

  if (currentVerses.length === 0) {
    verseReference.textContent   = '';
    verseText.textContent        = 'No verses found for this selection.';
    verseTranslation.textContent = '';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const v = currentVerses[currentIndex];
  verseReference.textContent   = `${v.book} ${v.chapter}:${v.verse}`;
  verseText.innerHTML          = v.text;
  verseTranslation.textContent = v.translation;

  // Check Yourself mode always starts with text hidden on each new verse
  textVisible = (currentMode !== 'check');
  updateTextVisibility();
  updateNavButtons();
  verseSelect.value = String(currentIndex);  // keep dropdown in sync
  saveState();
}

function updateTextVisibility() {
  verseText.classList.toggle('hidden', !textVisible);
  hideShowBtn.textContent = textVisible ? 'Hide' : 'Show';
}

function updateNavButtons() {
  prevBtn.disabled = (currentIndex === 0);
  // Next is always enabled; clicking it at the last verse shows the end message
  nextBtn.disabled = false;
}

// ── Mode switching ────────────────────────────────────────────────────────────

function setMode(mode) {
  currentMode = mode;
  const isCheck = (mode === 'check');

  modeMemorize.classList.toggle('active',  !isCheck);
  modeCheck.classList.toggle('active',      isCheck);
  instructionsText.textContent = INSTRUCTIONS[mode];

  // Apply the mode's default text-visibility rule to the current verse
  textVisible = !isCheck;
  updateTextVisibility();
  endMessage.classList.add('hidden');
  saveState();
}

// ── localStorage ──────────────────────────────────────────────────────────────

function saveState() {
  localStorage.setItem(STORAGE.book,        bookSelect.value);
  localStorage.setItem(STORAGE.chapter,     chapterSelect.value);
  localStorage.setItem(STORAGE.translation, translationSelect.value);
  localStorage.setItem(STORAGE.mode,        currentMode);
  if (currentVerses[currentIndex]) {
    localStorage.setItem(STORAGE.verse, currentVerses[currentIndex].verse);
  }
}

// Sets a select's value to savedValue if that option exists; returns true on success
function restoreSelectValue(select, savedValue) {
  if (!savedValue) return false;
  const found = [...select.options].some(o => o.value === savedValue);
  if (found) select.value = savedValue;
  return found;
}

// ── Event listeners ───────────────────────────────────────────────────────────

bookSelect.addEventListener('change', () => {
  populateChapters();
  populateTranslations();
  applyFilter();
  displayCurrentVerse();
});

chapterSelect.addEventListener('change', () => {
  populateTranslations();
  applyFilter();
  displayCurrentVerse();
});

verseSelect.addEventListener('change', () => {
  currentIndex = parseInt(verseSelect.value, 10);
  displayCurrentVerse();
});

translationSelect.addEventListener('change', () => {
  applyFilter();
  displayCurrentVerse();
});

modeMemorize.addEventListener('click', () => setMode('memorize'));
modeCheck.addEventListener('click',    () => setMode('check'));

hideShowBtn.addEventListener('click', () => {
  textVisible = !textVisible;
  updateTextVisibility();
});

prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    displayCurrentVerse();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < currentVerses.length - 1) {
    currentIndex++;
    displayCurrentVerse();
  } else {
    // Already on the last verse — show the end message
    endMessage.classList.remove('hidden');
    saveState();
  }
});

// ── Initialisation ────────────────────────────────────────────────────────────

async function init() {
  try {
    const response = await fetch('verses.csv');
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    allVerses = parseCSV(await response.text());

    if (allVerses.length === 0) {
      verseText.textContent = 'verses.csv is empty — please add verse data.';
      return;
    }

    // Build the book dropdown first
    populateBooks();

    // Read saved state from localStorage
    const saved = {
      book:             localStorage.getItem(STORAGE.book),
      chapter:          localStorage.getItem(STORAGE.chapter),
      translation:      localStorage.getItem(STORAGE.translation),
      verse:            localStorage.getItem(STORAGE.verse),
      mode:             localStorage.getItem(STORAGE.mode),
      instructionsSeen: localStorage.getItem(STORAGE.instructionsSeen),
    };

    // Restore selection in cascade: book → chapter → translation
    restoreSelectValue(bookSelect, saved.book);
    populateChapters();
    restoreSelectValue(chapterSelect, saved.chapter);
    populateTranslations();
    restoreSelectValue(translationSelect, saved.translation);

    // Build the verse list and verse dropdown for the restored (or default) selection
    applyFilter();

    // Restore position within the chapter by verse number (more stable than index)
    if (saved.verse) {
      const idx = currentVerses.findIndex(v => v.verse === saved.verse);
      if (idx >= 0) currentIndex = idx;
    }

    // Restore mode
    if (saved.mode === 'memorize' || saved.mode === 'check') {
      currentMode = saved.mode;
      const isCheck = (currentMode === 'check');
      modeMemorize.classList.toggle('active', !isCheck);
      modeCheck.classList.toggle('active',     isCheck);
    }
    instructionsText.textContent = INSTRUCTIONS[currentMode];

    displayCurrentVerse();

    // Instructions open state:
    //   First-time visitor  → expanded (so they read it)
    //   Returning visitor   → collapsed (they know the drill)
    if (!saved.instructionsSeen) {
      instructionsEl.open = true;
      localStorage.setItem(STORAGE.instructionsSeen, 'true');
    } else {
      instructionsEl.open = false;
    }

  } catch (err) {
    console.error('Initialisation failed:', err);
    verseText.textContent =
      'Could not load verses.csv. '
      + 'Make sure this page is served from a web server (GitHub Pages, Live Server, etc.) '
      + 'and that verses.csv is in the same directory as index.html.';
  }
}

init();
