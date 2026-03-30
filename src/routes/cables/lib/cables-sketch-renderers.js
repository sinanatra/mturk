import {
  BROKEN_TEXT_STYLE,
  OPINIONS_TEXT_STYLE,
  VIEWS_PALETTE,
  excerpt,
  normalizeMultilineText,
} from "./cables-utils";

export function setCameraTarget(camera, target, now) {
  if (!camera.initialized) {
    camera.initialized = true;
    camera.x = target.x;
    camera.y = target.y;
    camera.scale = target.scale;
    camera.toX = target.x;
    camera.toY = target.y;
    camera.toScale = target.scale;
    camera.lastMs = now;
    return;
  }
  camera.toX = target.x;
  camera.toY = target.y;
  camera.toScale = target.scale;
}

export function tickCamera(camera, now, viewState = "focus", focusAdvanceMs = 9800) {
  if (!camera.initialized) return;
  const dt = Math.max(1, now - camera.lastMs);
  camera.lastMs = now;

  const dx = camera.toX - camera.x;
  const dy = camera.toY - camera.y;
  const ds = camera.toScale - camera.scale;

  // Exponential decay for all states — grid floats back to overview,
  // focus/broken-seq follow at a pace tied to advance timing.
  const followMs =
    viewState === "broken-seq"
      ? Math.max(900, Math.min(5200, focusAdvanceMs * 0.85))
      : viewState === "grid"
        ? 1800
        : Math.max(120, Math.min(1200, focusAdvanceMs * 0.22));

  const posBlend = Math.min(1, dt / followMs);
  const scaleBlend = Math.min(1, dt / Math.max(90, followMs * 0.72));
  camera.x += dx * posBlend;
  camera.y += dy * posBlend;
  camera.scale += ds * scaleBlend;
}

export function createSketchRenderers({ s, ensureImage, visualState }) {
  const wrapLinesCache = new Map();

  const drawImage = (url, entry, alpha = 1, desaturate = false) => {
    const image = ensureImage(s, url);
    if (!image) {
      s.noStroke();
      s.fill(...VIEWS_PALETTE.missing, alpha);
      s.rect(entry.x, entry.y, entry.w, entry.h);
      return;
    }

    const scale = Math.min(entry.w / image.width, entry.h / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const x = entry.x - drawW / 2;
    const y = entry.y - drawH / 2;

    const ctx = s.drawingContext;
    ctx.save();
    if (desaturate) ctx.filter = "grayscale(1)";
    if (alpha < 1) s.tint(255, 255 * alpha);
    s.image(image, x, y, drawW, drawH);
    if (alpha < 1) s.noTint();
    ctx.restore();
  };

  const drawStageImageCover = (image, stageX, stageY, stageSize, alpha = 1) => {
    if (!image) return;
    const fit = Math.max(stageSize / image.width, stageSize / image.height);
    const drawW = image.width * fit;
    const drawH = image.height * fit;
    const x = stageX + (stageSize - drawW) / 2;
    const y = stageY + (stageSize - drawH) / 2;

    const ctx = s.drawingContext;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    s.image(image, x, y, drawW, drawH);
    ctx.restore();
  };

  const drawStageImageContained = (
    image,
    stageX,
    stageY,
    stageSize,
    widthRatio = 0.6,
    heightRatio = 1,
    alpha = 1,
  ) => {
    if (!image) return;
    const maxW = stageSize * Math.max(0.05, Math.min(1, widthRatio));
    const maxH = stageSize * Math.max(0.05, Math.min(1, heightRatio));
    const fit = Math.min(maxW / image.width, maxH / image.height);
    const drawW = image.width * fit;
    const drawH = image.height * fit;
    const x = stageX + (stageSize - drawW) / 2;
    const y = stageY + (stageSize - drawH) / 2;

    const ctx = s.drawingContext;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    s.image(image, x, y, drawW, drawH);
    ctx.restore();
  };

  const drawNoteVisual = (note, elapsedInNoteSec, noteDurationSec, stageX, stageY, stageSize) => {
    const visual = note?.visual;
    if (!visual || typeof visual !== "object") return { drawn: false, hideGrid: false };

    const mode = String(visual.mode || "").trim().toLowerCase();
    const shouldHideGrid = visual.hideGrid !== false;
    if (!mode) return { drawn: false, hideGrid: shouldHideGrid };
    const noteId = String(note?.id || "");
    const visualSignature =
      mode === "image" || mode === "single-image"
        ? `${mode}|${(visual.images || []).join(",")}|${visual.widthRatio}|${visual.heightRatio}`
        : mode === "collage"
          ? `${mode}|${(visual.collage || [])
              .map((item) => `${item.src}:${item.x}:${item.y}:${item.w}:${item.h}:${item.rotateDeg}`)
              .join(";")}`
          : `${mode}|${(visual.images || []).join(",")}`;

    if (mode === "blackout" || mode === "black") {
      s.push();
      s.rectMode(s.CORNER);
      s.noStroke();
      s.fill(0, 0, 0, 1);
      s.rect(stageX, stageY, stageSize, stageSize);
      s.pop();
      return { drawn: true, hideGrid: shouldHideGrid };
    }

    const totalMs = Math.max(1, Math.round(Math.max(0.5, noteDurationSec || 0.5) * 1000));
    const elapsedMs = Math.max(
      0,
      Math.min(totalMs - 1, Math.round(Math.max(0, elapsedInNoteSec || 0) * 1000)),
    );
    const sameVisualAsPreviousNote =
      noteId &&
      noteId !== visualState.lastVisualNoteId &&
      visualSignature &&
      visualSignature === visualState.lastVisualSignature;
    const fadeInMs = sameVisualAsPreviousNote ? 0 : Math.max(0, Number(visual.fadeInMs) || 0);
    const fadeInAlpha = fadeInMs > 0 ? Math.max(0, Math.min(1, elapsedMs / fadeInMs)) : 1;

    if (mode === "image" || mode === "single-image") {
      const src = Array.isArray(visual.images) ? visual.images[0] : "";
      const image = ensureImage(s, src);
      drawStageImageContained(
        image,
        stageX,
        stageY,
        stageSize,
        Number(visual.widthRatio) || 0.6,
        Number(visual.heightRatio) || 1,
        fadeInAlpha,
      );
      visualState.lastVisualNoteId = noteId;
      visualState.lastVisualSignature = visualSignature;
      return { drawn: true, hideGrid: shouldHideGrid };
    }

    if (mode === "collage") {
      const items = Array.isArray(visual.collage) ? visual.collage : [];
      for (const item of items) {
        const image = ensureImage(s, item.src);
        if (!image) continue;
        const maxW = stageSize * (Number(item.w) || 0.35);
        const maxH = stageSize * (Number(item.h) > 0 ? Number(item.h) : 0.42);
        const fit = Math.min(maxW / image.width, maxH / image.height);
        const drawW = image.width * fit;
        const drawH = image.height * fit;
        const cx = stageX + stageSize * (Number(item.x) || 0.5);
        const cy = stageY + stageSize * (Number(item.y) || 0.5);
        s.push();
        s.translate(cx, cy);
        s.rotate(s.radians(Number(item.rotateDeg) || 0));
        const ctx = s.drawingContext;
        ctx.save();
        ctx.globalAlpha = fadeInAlpha;
        s.image(image, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        s.pop();
      }
      visualState.lastVisualNoteId = noteId;
      visualState.lastVisualSignature = visualSignature;
      return { drawn: true, hideGrid: shouldHideGrid };
    }

    if (mode !== "images" && mode !== "stage-images") {
      return { drawn: true, hideGrid: shouldHideGrid };
    }

    const frames = Array.isArray(visual.images) ? visual.images : [];
    if (!frames.length) return { drawn: true, hideGrid: shouldHideGrid };

    const segmentMs = Math.max(1, totalMs / frames.length);
    const index = Math.min(frames.length - 1, Math.floor(elapsedMs / segmentMs));
    const localMs = elapsedMs - index * segmentMs;
    const useFade = visual.crossfade !== false;
    const fadeMs = Math.max(120, Math.min(400, segmentMs * 0.28));
    const alpha = useFade ? Math.max(0, Math.min(1, localMs / fadeMs)) : 1;

    if (useFade && index > 0 && alpha < 1) {
      const prev = ensureImage(s, frames[index - 1]);
      drawStageImageCover(prev, stageX, stageY, stageSize, 1 - alpha);
    }
    const current = ensureImage(s, frames[index]);
    drawStageImageCover(current, stageX, stageY, stageSize, alpha);
    visualState.lastVisualNoteId = noteId;
    visualState.lastVisualSignature = visualSignature;
    return { drawn: true, hideGrid: shouldHideGrid };
  };

  const drawCardMeta = (record, entry, alpha = 1) => {
    if (!record) return;

    const location = record.location || "Unknown";
    const country = record.country ? `, ${String(record.country).toUpperCase()}` : "";
    const line1 = `${location}${country}`;

    s.push();
    s.rectMode(s.CORNER);
    s.textAlign(s.LEFT, s.TOP);
    const fontSize = Math.max(3.8, Math.min(5.4, entry.w * 0.018));
    s.textSize(fontSize);

    const textWidth = s.textWidth(line1);
    const padX = 2;
    const padY = 1;
    const boxW = textWidth + padX * 2;
    const boxH = fontSize + padY * 2;
    const boxX = entry.x - entry.w / 2;
    const boxY = entry.y - entry.h / 2;

    s.noStroke();
    s.fill(0, 0, 0, 1);
    s.rect(boxX, boxY, boxW, boxH);
    s.fill(...VIEWS_PALETTE.textPrimary, 1 * alpha);
    s.text(line1, boxX + padX, boxY + padY);
    s.pop();
  };

  const drawText = (
    text,
    entry,
    focused = false,
    alpha = 1,
    mode = "top-left",
    sizeScale = 1,
    excerptLimit = null,
    leadingRatio = null,
    textColor = VIEWS_PALETTE.textPrimary,
  ) => {
    const boxX = entry.x - entry.w / 2;
    const boxY = entry.y - entry.h / 2;
    const padX = 2;
    const padY = 1;
    const textBody = excerpt(text, excerptLimit ?? (focused ? 900 : 360));

    const fitLineWithEllipsis = (line, widthLimit) => {
      const suffix = "...";
      if (s.textWidth(line) <= widthLimit) return line;
      let out = line;
      while (out.length > 1 && s.textWidth(`${out}${suffix}`) > widthLimit) {
        out = out.slice(0, -1);
      }
      return `${out}${suffix}`;
    };

    const wrapLines = (raw, widthLimit) => {
      const lines = [];
      const sourceLines = normalizeMultilineText(raw).split("\n");
      for (const source of sourceLines) {
        const words = source.split(" ").filter(Boolean);
        if (!words.length) {
          lines.push("");
          continue;
        }
        let current = "";
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (s.textWidth(candidate) <= widthLimit) {
            current = candidate;
            continue;
          }
          if (current) lines.push(current);
          current = word;
          while (s.textWidth(current) > widthLimit && current.length > 1) {
            let cut = current.length;
            while (cut > 1 && s.textWidth(current.slice(0, cut)) > widthLimit) {
              cut -= 1;
            }
            lines.push(current.slice(0, cut));
            current = current.slice(cut);
          }
        }
        if (current) lines.push(current);
      }
      return lines.length ? lines : [""];
    };

    s.push();
    s.rectMode(s.CORNER);
    s.fill(...textColor, alpha);
    s.textAlign(
      mode === "center" ? s.CENTER : s.LEFT,
      mode === "center" ? s.CENTER : s.TOP,
    );
    const regularSize = 7 * sizeScale;
    const focusSize = 10 * sizeScale;
    const appliedSize = focused ? focusSize : regularSize;
    const defaultLeadingRatio = mode === "center" ? 0.6 : 0.74;
    const rawLeading = appliedSize * (leadingRatio ?? defaultLeadingRatio);
    const leading = mode === "center" ? Math.max(rawLeading, appliedSize * 1.02) : rawLeading;
    s.textSize(appliedSize);
    s.textLeading(leading);

    if (mode === "center") {
      const blockW = Math.max(1, entry.w * 0.88);
      const maxLines = Math.max(1, Math.floor((entry.h * 0.88) / leading));
      const cacheKey = `${textBody}|${Math.round(appliedSize * 10)}|${Math.round(blockW)}`;
      let lines = wrapLinesCache.get(cacheKey);
      if (!lines) {
        lines = wrapLines(textBody, blockW);
        if (wrapLinesCache.size > 300) wrapLinesCache.clear();
        wrapLinesCache.set(cacheKey, lines);
      }
      lines = lines.slice();
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = fitLineWithEllipsis(lines[maxLines - 1], blockW);
      }

      const totalH = Math.max(leading, lines.length * leading);
      const startY = entry.y - totalH / 2 + leading / 2;

      s.noStroke();
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        const lineY = startY + lineIndex * leading;
        const lineW = Math.min(blockW, s.textWidth(line) + 8);
        const lineX = entry.x - lineW / 2;
        const lineTop = lineY - leading / 2;

        s.fill(0, 0, 0, 1);
        s.rect(lineX, lineTop, lineW, leading);
        s.fill(...textColor, alpha);
        s.text(line, entry.x, lineY);
      }
      s.pop();
      return;
    }

    const blockW = Math.max(1, entry.w - padX * 2);
    const approxLines = Math.max(1, Math.ceil(s.textWidth(textBody) / Math.max(1, blockW)));
    const blockH = Math.max(appliedSize + 2, Math.min(entry.h, approxLines * leading + 2));

    s.noStroke();
    s.fill(0, 0, 0, 1);
    s.rect(boxX, boxY, blockW, blockH);

    const ctx = s.drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(boxX, boxY, blockW, blockH);
    ctx.clip();

    s.fill(...textColor, alpha);
    s.text(textBody, boxX + padX, boxY + padY, Math.max(1, blockW - padX * 2), Math.max(1, blockH - padY * 2));
    ctx.restore();
    s.pop();
  };

  const drawBrokenState = (chain, entry, _state = "image", alpha = 1, desaturate = false) => {
    // Pyramid/tessellated layout:
    // top = original image, bottom-left = text, bottom-right = drawing.
    const padX = Math.max(2, entry.w * 0.018);
    const padY = Math.max(2, entry.h * 0.022);
    const innerW = Math.max(1, entry.w - padX * 2);
    const innerH = Math.max(1, entry.h - padY * 2);
    const gap = Math.max(2, entry.w * 0.01);
    const topH = Math.max(1, innerH * 0.4);
    const bottomH = Math.max(1, innerH - topH - gap);
    const topW = innerW;
    const textW = Math.max(1, innerW * 0.42);
    const drawingW = Math.max(1, innerW - gap - textW);
    const topY = entry.y - innerH / 2 + topH / 2;
    const bottomY = entry.y + innerH / 2 - bottomH / 2;
    const imagePanel = {
      x: entry.x,
      y: topY,
      w: topW,
      h: topH,
    };
    const drawingPanel = {
      x: entry.x - innerW / 2 + textW + gap + drawingW / 2,
      y: bottomY,
      w: drawingW,
      h: bottomH,
    };
    const textPanel = {
      x: entry.x - innerW / 2 + textW / 2,
      y: bottomY,
      w: textW,
      h: bottomH,
    };

    if (chain.image?.imageUrl) drawImage(chain.image.imageUrl, imagePanel, alpha, desaturate);
    else {
      s.noStroke();
      s.fill(...VIEWS_PALETTE.missing, alpha);
      s.rect(imagePanel.x, imagePanel.y, imagePanel.w, imagePanel.h);
    }

    if (chain.text?.text) {
      const textClipX = textPanel.x - textPanel.w / 2;
      const textClipY = textPanel.y - textPanel.h / 2;
      const textCtx = s.drawingContext;
      textCtx.save();
      textCtx.beginPath();
      textCtx.rect(textClipX, textClipY, textPanel.w, textPanel.h);
      textCtx.clip();
      drawText(
        chain.text.text,
        textPanel,
        false,
        alpha,
        "center",
        BROKEN_TEXT_STYLE.sizeScale * 0.66,
        BROKEN_TEXT_STYLE.excerpt,
        BROKEN_TEXT_STYLE.leadingRatio,
        desaturate ? [0, 0, 72] : [0, 0, 100],
      );
      textCtx.restore();
    } else {
      s.noStroke();
      s.fill(...VIEWS_PALETTE.missing, alpha);
      s.rect(textPanel.x, textPanel.y, textPanel.w, textPanel.h);
    }

    if (chain.drawing?.imageUrl) drawImage(chain.drawing.imageUrl, drawingPanel, alpha, desaturate);
    else {
      s.noStroke();
      s.fill(...VIEWS_PALETTE.missing, alpha);
      s.rect(drawingPanel.x, drawingPanel.y, drawingPanel.w, drawingPanel.h);
    }
  };

  const brokenMetaForState = (chain, state = "image") => {
    if (state === "image" && chain.image) return chain.image;
    if (state === "text" && chain.text) return chain.text;
    if (state === "drawing" && chain.drawing) return chain.drawing;
    return chain.image || chain.text || chain.drawing || null;
  };

  return {
    drawImage,
    drawNoteVisual,
    drawCardMeta,
    drawText,
    drawBrokenState,
    brokenMetaForState,
  };
}
