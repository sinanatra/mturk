export const TIMELINE = [
  {
    id: "windows",
    label: "Windows",
    mode: "windows",
    overviewMs: 9000,
    zoomInMs: 4200,
    focusAdvanceMs: 2800,
  },
  {
    id: "screens",
    label: "Screens",
    mode: "screens",
    overviewMs: 9000,
    zoomInMs: 1800,
    focusAdvanceMs: 10000,
  },
  {
    id: "opinions",
    label: "Opinions",
    mode: "opinions",
    overviewMs: 10000,
    zoomInMs: 4600,
    focusAdvanceMs: 10600,
  },
  {
    id: "broken",
    label: "Broken Telephone",
    mode: "broken",
    overviewMs: 8000,
    zoomInMs: 4200,
    focusAdvanceMs: 9900,
  },
];

export const VIEWS_PALETTE = {
  canvas: [0, 0, 0],
  tile: [0, 0, 0],
  missing: [0, 0, 8],
  textPrimary: [0, 0, 94],
};

export const OPINIONS_TEXT_STYLE = {
  sizeScale: 0.82,
  leadingRatio: 1.2,
  excerpt: 520,
};

export const BROKEN_TEXT_STYLE = {
  sizeScale: 0.84,
  leadingRatio: 1.12,
  excerpt: 520,
};

export const NOTE_RESTART_PAUSE_SEC = 12;

export function emptyLayout() {
  return {
    map: new Map(),
    worldWidth: 1,
    worldHeight: 1,
    maxW: 1,
    maxH: 1,
  };
}

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMultilineText(value) {
  const raw = String(value ?? "").replace(/\r\n?/g, "\n");
  const lines = raw
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.join("\n");
}

export function noteDurSec(note) {
  return Math.max(0.5, Number(note?.durationSec) || 0.5);
}

export function noteStartSec(notes, index) {
  let total = 0;
  for (let i = 0; i < index; i += 1) total += noteDurSec(notes[i]);
  return total;
}

export function noteIndexAtElapsed(
  notes,
  elapsedSec,
  { loop = false, restartPauseSec = 0 } = {},
) {
  if (!notes.length) return { index: -1, inPause: false };
  const totalSec = notes.reduce((sum, note) => sum + noteDurSec(note), 0);
  if (totalSec <= 0) return { index: notes.length - 1, inPause: false };

  let remaining = Math.max(0, elapsedSec);
  if (loop) {
    const cycleSec = totalSec + Math.max(0, restartPauseSec);
    if (cycleSec > 0) remaining %= cycleSec;
    if (remaining >= totalSec) return { index: -1, inPause: true };
  } else if (remaining >= totalSec) {
    return { index: notes.length - 1, inPause: false };
  }

  for (let i = 0; i < notes.length; i += 1) {
    const dur = noteDurSec(notes[i]);
    if (remaining < dur) return { index: i, inPause: false };
    remaining -= dur;
  }
  return { index: notes.length - 1, inPause: false };
}

export function normalizeRecord(row, index) {
  const normalizeImagePath = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    const noLead = raw.replace(/^\/+/, "");
    if (noLead.startsWith("cables/images/")) {
      return `/${noLead.replace(/^cables\/images\//, "images/")}`;
    }
    if (noLead.startsWith("images/")) return `/${noLead}`;
    return `/${noLead}`;
  };

  return {
    id: row.id || `row-${index}`,
    mode: row.mode || "",
    chainId: row.chain_id || "",
    step: row.step || "",
    location: row.location || "Unknown",
    country: row.country || "",
    typology: row.typology || "",
    imageUrl: normalizeImagePath(row.local_image_url || row.image_url || ""),
    text: normalizeText(row.text),
    sentiment: row.sentiment || "",
    orderHint: Number.parseInt(row.order_hint, 10) || index + 1,
  };
}

export function sortRecords(list) {
  return [...list].sort((a, b) => {
    const byLocation = String(a.location).localeCompare(String(b.location));
    if (byLocation !== 0) return byLocation;
    const byTypology = String(a.typology).localeCompare(String(b.typology));
    if (byTypology !== 0) return byTypology;
    return a.orderHint - b.orderHint;
  });
}

export function buildGridLayout(list, cardW, cardH, gap = 0) {
  if (list.length === 0) return emptyLayout();

  const cols = Math.max(1, Math.ceil(Math.sqrt((list.length * cardW) / cardH)));
  const rowsCount = Math.ceil(list.length / cols);
  const worldWidth = cols * (cardW + gap) - gap;
  const worldHeight = rowsCount * (cardH + gap) - gap;

  const xStart = -worldWidth / 2 + cardW / 2;
  const yStart = -worldHeight / 2 + cardH / 2;

  const map = new Map();
  list.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    map.set(item.id, {
      x: xStart + col * (cardW + gap),
      y: yStart + row * (cardH + gap),
      w: cardW,
      h: cardH,
    });
  });

  return { map, worldWidth, worldHeight, maxW: cardW, maxH: cardH };
}

export function buildMasonryLayout(list, getAspect, columns, baseWidth, gap = 0) {
  if (list.length === 0) return emptyLayout();

  const cols = Math.max(1, columns);
  const colHeights = Array.from({ length: cols }, () => 0);
  const map = new Map();
  let maxH = 0;

  list.forEach((item) => {
    const aspect = Math.max(0.01, getAspect(item));
    const tileH = Math.max(1, baseWidth / aspect);

    let bestCol = 0;
    for (let c = 1; c < cols; c += 1) {
      if (colHeights[c] < colHeights[bestCol]) bestCol = c;
    }

    const x = bestCol * (baseWidth + gap) + baseWidth / 2;
    const y = colHeights[bestCol] + tileH / 2;
    map.set(item.id, { x, y, w: baseWidth, h: tileH, col: bestCol });

    colHeights[bestCol] += tileH + gap;
    if (tileH > maxH) maxH = tileH;
  });

  const worldWidth = cols * (baseWidth + gap) - gap;
  const worldHeight = Math.max(...colHeights) - gap;

  const offsetX = -worldWidth / 2;
  const offsetY = -worldHeight / 2;
  for (const [id, entry] of map.entries()) {
    const colCenterOffset = (worldHeight - colHeights[entry.col]) / 2;
    map.set(id, {
      x: entry.x + offsetX,
      y: entry.y + colCenterOffset + offsetY,
      w: entry.w,
      h: entry.h,
    });
  }

  return { map, worldWidth, worldHeight, maxW: baseWidth, maxH };
}

export function estimateOpinionCardHeight(text, cardW) {
  const clean = normalizeMultilineText(text);
  const minH = Math.max(90, Math.round(cardW * 0.62));
  if (!clean) return minH;

  const approxCharsPerLine = Math.max(18, Math.floor(cardW / 5.8));
  const explicitLines = clean.split("\n");
  const lineCount = Math.max(
    2,
    explicitLines.reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(line.length / approxCharsPerLine)),
      0,
    ),
  );
  const lineHeight = 8;
  const contentH = Math.round(lineCount * lineHeight + 22);
  const maxH = Math.round(cardW * 3.2);
  return Math.max(minH, Math.min(maxH, contentH));
}

export function mapById(list) {
  const out = new Map();
  for (const item of list) out.set(item.id, item);
  return out;
}

export function buildColumnSnakeTraversal(list, layout) {
  if (!list.length) return [];
  const ids = list.map((item) => item.id).filter((id) => layout.map.has(id));
  if (!ids.length) return [];
  const columns = new Map();

  for (const id of ids) {
    const entry = layout.map.get(id);
    if (!entry) continue;
    const key = entry.x.toFixed(4);
    if (!columns.has(key)) columns.set(key, { x: entry.x, ids: [] });
    columns.get(key).ids.push(id);
  }

  const orderedColumns = [...columns.values()].sort((a, b) => a.x - b.x);
  const path = [];
  for (let colIndex = 0; colIndex < orderedColumns.length; colIndex += 1) {
    const col = orderedColumns[colIndex];
    col.ids.sort((a, b) => {
      const pa = layout.map.get(a);
      const pb = layout.map.get(b);
      if (!pa || !pb) return 0;
      const byY = pa.y - pb.y;
      if (byY !== 0) return byY;
      return pa.x - pb.x;
    });
    if (colIndex % 2 === 1) col.ids.reverse();
    path.push(...col.ids);
  }

  return path;
}

export function normalizeNote(raw, index) {
  const normalizedTargetId = normalizeText(raw.targetId || "");
  const normalizedMode =
    raw.mode === "target" || (normalizedTargetId && raw.mode !== "time")
      ? "target"
      : "time";

  return {
    id: raw.id || `note-${index + 1}`,
    order: index,
    phase: raw.phase || "any",
    mode: normalizedMode,
    active: raw.active !== false && String(raw.active) !== "0",
    text: normalizeMultilineText(raw.text || ""),
    targetId: normalizedTargetId,
    targetStep: normalizeText(raw.targetStep || "any") || "any",
    durationSec: Number.isFinite(Number(raw.durationSec))
      ? Math.max(0.5, Number(raw.durationSec))
      : 10,
  };
}

export function sequenceNoteByDuration(notes, elapsedSec, options = {}) {
  if (!notes.length) return null;
  const {
    loop = false,
    restartPauseSec = 0,
    returnNullDuringPause = false,
  } = options;
  const totalSec = notes.reduce(
    (sum, note) => sum + Math.max(0.5, Number(note.durationSec) || 0.5),
    0,
  );
  if (totalSec <= 0) return notes[notes.length - 1];

  let remaining = Math.max(0, elapsedSec);
  if (loop) {
    const cycleSec = totalSec + Math.max(0, restartPauseSec);
    if (cycleSec > 0) remaining %= cycleSec;
    if (remaining >= totalSec) {
      return returnNullDuringPause ? null : notes[notes.length - 1];
    }
  } else if (remaining >= totalSec) {
    return notes[notes.length - 1];
  }

  for (const note of notes) {
    const duration = Math.max(0.5, Number(note.durationSec) || 0.5);
    if (remaining < duration) return note;
    remaining -= duration;
  }
  return notes[notes.length - 1];
}

export function excerpt(text, limit = 360) {
  const clean = normalizeText(text);
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 3)}...`;
}
