const DEFAULT_DELAY_MS = 8000;
const FIXED_START_REFERENCE = 'Psalm 27:4';
const FIXED_END_REFERENCE = 'Psalm 27:8';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      field = '';
      if (row.length > 1 || row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  if (row.length > 1 || row.some((value) => value.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function normalizeVerse(text) {
  return text.replaceAll('\\n', '\n');
}

function parseDelayMs() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('delay');
  if (!raw) {
    return DEFAULT_DELAY_MS;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_DELAY_MS;
  }

  return Math.max(2000, Math.floor(value * 1000));
}

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function normalizeReference(reference) {
  return reference.trim().toLowerCase();
}

function buildDisplayOrder(entries) {
  const startKey = normalizeReference(FIXED_START_REFERENCE);
  const endKey = normalizeReference(FIXED_END_REFERENCE);
  const startEntry = entries.find((entry) => normalizeReference(entry.reference) === startKey);
  const endEntry = entries.find((entry) => normalizeReference(entry.reference) === endKey);

  if (!startEntry || !endEntry) {
    return [...entries];
  }

  const middleEntries = entries.filter((entry) => {
    const key = normalizeReference(entry.reference);
    return key !== startKey && key !== endKey;
  });

  shuffleInPlace(middleEntries);

  return [startEntry, ...middleEntries, endEntry];
}

function updateStatus(text) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = text;
  }
}

function formatCitation(reference, translation) {
  if (translation) {
    return `${reference} (${translation})`;
  }
  return reference;
}

function setVerse(reference, verse, translation) {
  const verseEl = document.getElementById('verse');
  const citeEl = document.getElementById('citation');

  verseEl.classList.remove('fade-in');
  citeEl.classList.remove('fade-in');
  verseEl.classList.add('fade-out');
  citeEl.classList.add('fade-out');

  window.setTimeout(() => {
    verseEl.textContent = verse;
    citeEl.textContent = formatCitation(reference, translation);
    verseEl.classList.remove('fade-out');
    citeEl.classList.remove('fade-out');
    verseEl.classList.add('fade-in');
    citeEl.classList.add('fade-in');
  }, 300);
}

async function init() {
  updateStatus('Loading scripture...');

  const response = await fetch('assets/data/scriptures.csv');
  const text = await response.text();
  const rows = parseCsv(text).filter((row) => row.length >= 2);

  if (rows.length === 0) {
    updateStatus('No scripture entries found.');
    return;
  }

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const dataRows = rows.slice(1);

  const referenceIndex = headers.indexOf('reference');
  const textIndex = headers.indexOf('text');
  const translationIndex = headers.indexOf('translation');

  if (referenceIndex === -1 || textIndex === -1) {
    updateStatus('Scripture data is missing required columns.');
    return;
  }

  const entries = dataRows
    .map((row) => ({
      reference: row[referenceIndex] || '',
      verse: normalizeVerse(row[textIndex] || ''),
      translation: row[translationIndex] || '',
    }))
    .filter((entry) => entry.reference.trim().length > 0 && entry.verse.trim().length > 0);

  if (entries.length === 0) {
    updateStatus('No scripture entries found.');
    return;
  }

  const orderedEntries = buildDisplayOrder(entries);
  let index = 0;
  const delayMs = parseDelayMs();

  const showIndex = (nextIndex) => {
    index = (nextIndex + orderedEntries.length) % orderedEntries.length;
    const entry = orderedEntries[index];
    setVerse(entry.reference, entry.verse, entry.translation);
  };

  updateStatus('');
  showIndex(index);

  window.setInterval(() => {
    showIndex(index + 1);
  }, delayMs);

  const prevButton = document.querySelector('.nav-prev');
  const nextButton = document.querySelector('.nav-next');

  if (prevButton) {
    prevButton.addEventListener('click', () => showIndex(index - 1));
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => showIndex(index + 1));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      showIndex(index - 1);
    }
    if (event.key === 'ArrowRight') {
      showIndex(index + 1);
    }
  });
}

init().catch(() => {
  updateStatus('Unable to load scripture data.');
});
