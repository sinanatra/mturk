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
    zoomInMs: 4200,
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
  excerpt: 2200,
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

export function imageAspectFromMeta(imageMeta, url, fallback = 1.4) {
  const meta = imageMeta.get(url);
  if (!meta || !meta.w || !meta.h) return fallback;
  const aspect = meta.w / meta.h;
  return aspect > 0 ? aspect : fallback;
}

export function isTypingElementFocused(isBrowser = true) {
  if (!isBrowser) return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
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
  const normalizedAnchorId = normalizeText(raw.anchorId || "");
  const normalizedAnchorImageId = normalizeText(raw.anchorImageId || "");
  const normalizeImagePath = (value) => {
    const rawPath = String(value || "").trim();
    if (!rawPath) return "";
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    if (rawPath.startsWith("/")) return rawPath;
    return `/${rawPath}`;
  };
  const numberOr = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const numberOrNull = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const zoomToRaw = raw.zoomTo && typeof raw.zoomTo === "object" ? raw.zoomTo : null;
  const zoomX = numberOrNull(zoomToRaw?.x ?? raw.zoomX);
  const zoomY = numberOrNull(zoomToRaw?.y ?? raw.zoomY);
  const zoomScale = numberOrNull(zoomToRaw?.scale ?? raw.zoomScale);
  const zoomTo =
    zoomX !== null || zoomY !== null || zoomScale !== null
      ? {
          x: zoomX,
          y: zoomY,
          scale: zoomScale,
        }
      : null;
  const visualRaw = raw.visual && typeof raw.visual === "object" ? raw.visual : null;
  const visual = visualRaw
    ? {
        mode: normalizeText(visualRaw.mode || ""),
        images: Array.isArray(visualRaw.images)
          ? visualRaw.images.map(normalizeImagePath).filter(Boolean)
          : [],
        widthRatio: clamp(numberOr(visualRaw.widthRatio, 1), 0.05, 1),
        heightRatio: clamp(numberOr(visualRaw.heightRatio, 1), 0.05, 1),
        fadeInMs: Math.max(0, numberOr(visualRaw.fadeInMs, 220)),
        hideGrid: visualRaw.hideGrid !== false,
        crossfade: visualRaw.crossfade !== false,
        collage: Array.isArray(visualRaw.collage)
          ? visualRaw.collage
              .map((entry) => ({
                src: normalizeImagePath(entry?.src || ""),
                x: clamp(numberOr(entry?.x, 0.5), 0, 1),
                y: clamp(numberOr(entry?.y, 0.5), 0, 1),
                w: clamp(numberOr(entry?.w, 0.4), 0.05, 1),
                h: clamp(numberOr(entry?.h, 0), 0, 1),
                rotateDeg: clamp(numberOr(entry?.rotateDeg, 0), -45, 45),
              }))
              .filter((entry) => entry.src)
          : [],
      }
    : null;
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
    anchorId: normalizedAnchorId,
    anchorImageId: normalizedAnchorImageId,
    zoomTo,
    visual,
    durationSec: Number.isFinite(Number(raw.durationSec))
      ? Math.max(0.5, Number(raw.durationSec))
      : 10,
  };
}

export function selectActiveTimeNotes(editorialNotes, phase) {
  return editorialNotes
    .filter(
      (note) => note.active && note.mode !== "target" && note.phase === phase,
    )
    .sort((a, b) => a.order - b.order);
}

export function phaseDurationMsFromNotes(notes, fallbackMs) {
  if (!notes.length) return fallbackMs;
  const totalSec = notes.reduce(
    (sum, note) => sum + Math.max(0.5, Number(note.durationSec) || 0.5),
    0,
  );
  return Math.max(1000, Math.round(totalSec * 1000));
}

export function collectEditorialVisualImageUrls(notes) {
  const urls = new Set();
  for (const note of notes) {
    const images = note?.visual?.images;
    if (Array.isArray(images)) {
      for (const url of images) {
        if (url) urls.add(url);
      }
    }

    const collage = note?.visual?.collage;
    if (Array.isArray(collage)) {
      for (const item of collage) {
        if (item?.src) urls.add(item.src);
      }
    }
  }
  return [...urls];
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

export function extractInlineImageIds(value) {
  const raw = String(value || "");
  if (!raw) return [];
  const matches = raw.match(/\b[A-Za-z0-9_-]{20,}\b/g) || [];
  return [...new Set(matches)];
}

export function extractInlineRecordIds(value) {
  const raw = String(value || "");
  if (!raw) return [];
  const matches = [...raw.matchAll(/\[\[id:([A-Za-z0-9_-]{3,})\]\]/g)];
  return [...new Set(matches.map((match) => match[1]).filter(Boolean))];
}

export function stripInlineImageIds(value) {
  const raw = normalizeMultilineText(value);
  if (!raw) return "";
  const lines = raw
    .split("\n")
    .map((line) =>
      line
        .replace(/\[\[id:[A-Za-z0-9_-]{3,}\]\]/g, "")
        .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .filter((line) => line.length > 0);
  return lines.join("\n");
}

function imageIdFromUrl(url) {
  const raw = String(url || "");
  if (!raw) return "";
  const match = raw.match(/\/([A-Za-z0-9_-]{20,})\.[A-Za-z0-9]+(?:$|\?)/);
  return match?.[1] || "";
}

function recordMatchesImageId(record, imageId) {
  if (!record || !imageId) return false;
  if (record.imageUrl && imageIdFromUrl(record.imageUrl) === imageId)
    return true;
  if (
    record.image?.imageUrl &&
    imageIdFromUrl(record.image.imageUrl) === imageId
  )
    return true;
  if (
    record.drawing?.imageUrl &&
    imageIdFromUrl(record.drawing.imageUrl) === imageId
  )
    return true;
  return false;
}

export function resolveNoteAnchorRecordId(note, orderedRecords) {
  if (!note || !orderedRecords.length) return "";

  const explicitRecordId = normalizeText(note.anchorId || "");
  if (explicitRecordId) {
    const direct = orderedRecords.find((item) => item.id === explicitRecordId);
    if (direct?.id) return direct.id;
    const viaAlias = orderedRecords.find(
      (item) =>
        Array.isArray(item.aliasIds) && item.aliasIds.includes(explicitRecordId),
    );
    if (viaAlias?.id) return viaAlias.id;
  }

  const explicitImageId = normalizeText(note.anchorImageId || "");
  if (explicitImageId) {
    const record = orderedRecords.find((item) =>
      recordMatchesImageId(item, explicitImageId),
    );
    if (record?.id) return record.id;
  }

  const noteText = note.text || "";
  const recordIds = extractInlineRecordIds(noteText);
  if (recordIds.length && orderedRecords.length) {
    const recordIdSet = new Set(orderedRecords.map((item) => item.id));
    for (const recordId of recordIds) {
      if (recordIdSet.has(recordId)) return recordId;
      const viaAlias = orderedRecords.find(
        (item) => Array.isArray(item.aliasIds) && item.aliasIds.includes(recordId),
      );
      if (viaAlias?.id) return viaAlias.id;
    }
  }

  const imageIds = extractInlineImageIds(noteText);
  if (!imageIds.length || !orderedRecords.length) return "";
  for (const imageId of imageIds) {
    const record = orderedRecords.find((item) =>
      recordMatchesImageId(item, imageId),
    );
    if (record?.id) return record.id;
  }
  return "";
}

export function excerpt(text, limit = 360) {
  const clean = normalizeText(text);
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 3)}...`;
}
