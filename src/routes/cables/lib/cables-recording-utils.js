import { normalizeMultilineText } from "./cables-utils";

export function buildStageProgressPath(ratio) {
  const r = Math.max(0, Math.min(1, Number(ratio) || 0));
  const total = 400;
  let remaining = total * r;
  const points = [[0, 0]];

  const pushPoint = (x, y) => {
    const last = points[points.length - 1];
    if (!last || last[0] !== x || last[1] !== y) points.push([x, y]);
  };

  if (remaining <= 0) return "M 0 0";

  if (remaining <= 100) {
    pushPoint(remaining, 0);
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }
  pushPoint(100, 0);
  remaining -= 100;

  if (remaining <= 100) {
    pushPoint(100, remaining);
    return `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ");
  }
  pushPoint(100, 100);
  remaining -= 100;

  if (remaining <= 100) {
    pushPoint(100 - remaining, 100);
    return `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ");
  }
  pushPoint(0, 100);
  remaining -= 100;

  pushPoint(0, Math.max(0, 100 - remaining));
  return `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ");
}

export function drawRecordingStageProgress(ctx, ratio, sizePx) {
  const r = Math.max(0, Math.min(1, Number(ratio) || 0));
  if (r <= 0) return;

  const lineWidth = 10;
  const inset = lineWidth / 2;
  const span = Math.max(1, sizePx - inset * 2);
  const perimeter = span * 4;
  let remaining = perimeter * r;

  const left = inset;
  const top = inset;
  const right = inset + span;
  const bottom = inset + span;

  ctx.save();
  ctx.strokeStyle = "#838B85";
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(left, top);

  const topStep = Math.min(span, remaining);
  ctx.lineTo(left + topStep, top);
  remaining -= topStep;
  if (remaining > 0) {
    const rightStep = Math.min(span, remaining);
    ctx.lineTo(right, top + rightStep);
    remaining -= rightStep;
  }
  if (remaining > 0) {
    const bottomStep = Math.min(span, remaining);
    ctx.lineTo(right - bottomStep, bottom);
    remaining -= bottomStep;
  }
  if (remaining > 0) {
    const leftStep = Math.min(span, remaining);
    ctx.lineTo(left, bottom - leftStep);
  }

  ctx.stroke();
  ctx.restore();
}

function wrapRecordingLines(ctx, text, widthLimit) {
  const lines = [];
  const sourceLines = normalizeMultilineText(text).split("\n");
  for (const source of sourceLines) {
    const words = source.split(" ").filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= widthLimit) {
        current = candidate;
      } else if (current) {
        lines.push(current);
        current = word;
      } else {
        lines.push(word);
        current = "";
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export function drawRecordingOverlayText(
  ctx,
  text,
  {
    centerX,
    anchorY,
    width,
    fontPx,
    lineHeight,
    anchor = "top",
    textColor = "#FFF9D2",
    secondaryTextColor = textColor,
    secondaryTextColorFromLine = Number.POSITIVE_INFINITY,
    bgColor = "#000000",
  },
) {
  const clean = normalizeMultilineText(text);
  if (!clean) return;
  ctx.save();
  ctx.font = `${Math.round(fontPx)}px "terminal-grotesque", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapRecordingLines(ctx, clean, width);
  if (!lines.length) {
    ctx.restore();
    return;
  }
  const totalH = lines.length * lineHeight;
  const startY = anchor === "bottom" ? anchorY - totalH : anchorY;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineW = ctx.measureText(line).width;
    const y = startY + i * lineHeight;
    ctx.fillStyle = bgColor;
    ctx.fillRect(centerX - lineW / 2 - 6, y, lineW + 12, lineHeight);
    ctx.fillStyle = i >= secondaryTextColorFromLine ? secondaryTextColor : textColor;
    ctx.fillText(line, centerX, y + lineHeight / 2);
  }
  ctx.restore();
}

function pxNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getRecordingOverlayMetrics({
  browser,
  stageSizePx,
  recordSizePx,
  textSelector,
  boxSelector,
  fallbackFontPx,
  fallbackLineHeight,
  fallbackWidthPx,
}) {
  const stageRef = Math.max(1, stageSizePx || 1);
  const stageToRecord = recordSizePx / stageRef;
  let fontPx = fallbackFontPx;
  let lineHeight = fallbackLineHeight;
  let widthPx = fallbackWidthPx;

  if (browser) {
    const textEl = document.querySelector(textSelector);
    if (textEl) {
      const style = window.getComputedStyle(textEl);
      fontPx = pxNumber(style.fontSize, fallbackFontPx) * stageToRecord;
      lineHeight = pxNumber(style.lineHeight, fallbackLineHeight) * stageToRecord;
    }

    const boxEl = document.querySelector(boxSelector);
    if (boxEl) {
      const rect = boxEl.getBoundingClientRect();
      widthPx = rect.width * stageToRecord;
    }
  }

  return {
    fontPx: Math.max(10, fontPx),
    lineHeight: Math.max(10, lineHeight),
    widthPx: Math.max(240, widthPx),
  };
}
