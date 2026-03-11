const DEFAULT_DELAY_MS = 8000;

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

function parseStartIndex(total) {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('start');
  if (!raw) {
    return 0;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value) % total;
}

function shouldShuffle() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('random');
  if (!raw) {
    return false;
  }

  return raw === '1' || raw.toLowerCase() === 'true' || raw === 'yes';
}

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function updateStatus(text) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = text;
  }
}

function formatCitation(citation, translation) {
  if (translation) {
    return `${citation} (${translation})`;
  }
  return citation;
}

function setVerse(reference, verse, citation, translation) {
  const verseEl = document.getElementById('verse');
  const citeEl = document.getElementById('citation');

  verseEl.classList.remove('fade-in');
  citeEl.classList.remove('fade-in');
  verseEl.classList.add('fade-out');
  citeEl.classList.add('fade-out');

  window.setTimeout(() => {
    verseEl.textContent = verse;
    citeEl.textContent = formatCitation(citation || reference, translation);
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
  const citationIndex = headers.indexOf('citation');
  const translationIndex = headers.indexOf('translation');

  const entries = dataRows
    .map((row) => ({
      reference: row[referenceIndex] || '',
      verse: normalizeVerse(row[textIndex] || ''),
      citation: row[citationIndex] || '',
      translation: row[translationIndex] || '',
    }))
    .filter((entry) => entry.verse.trim().length > 0);

  if (entries.length === 0) {
    updateStatus('No scripture entries found.');
    return;
  }

  if (shouldShuffle()) {
    shuffleInPlace(entries);
  }

  let index = parseStartIndex(entries.length);
  const delayMs = parseDelayMs();

  const showIndex = (nextIndex) => {
    index = (nextIndex + entries.length) % entries.length;
    const entry = entries[index];
    setVerse(entry.reference, entry.verse, entry.citation, entry.translation);
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
