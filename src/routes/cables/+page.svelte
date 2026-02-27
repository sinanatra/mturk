<script>
  import { tsv } from "d3";
  import { onDestroy, onMount } from "svelte";
  import { browser } from "$app/environment";
  import CablesOverlay from "./components/CablesOverlay.svelte";
  import CablesControls from "./components/CablesControls.svelte";
  import {
    BROKEN_TEXT_STYLE,
    NOTE_RESTART_PAUSE_SEC,
    OPINIONS_TEXT_STYLE,
    TIMELINE,
    VIEWS_PALETTE,
    buildColumnSnakeTraversal,
    buildMasonryLayout,
    emptyLayout,
    estimateOpinionCardHeight,
    excerpt,
    mapById,
    normalizeMultilineText,
    normalizeNote,
    normalizeRecord,
    normalizeText,
    noteDurSec,
    noteIndexAtElapsed,
    noteStartSec,
    sequenceNoteByDuration,
    sortRecords,
  } from "./lib/cables-utils";

  let P5 = null;
  let width;
  let height;

  let rows = [];
  let records = [];

  let windowsItems = [];
  let screensItems = [];
  let opinionsItems = [];
  let brokenChains = [];

  let windowsLayout = emptyLayout();
  let screensLayout = emptyLayout();
  let opinionsLayout = emptyLayout();
  let brokenLayout = emptyLayout();
  let windowsTraversal = [];
  let screensTraversal = [];
  let opinionsTraversal = [];
  let brokenTraversal = [];
  let windowsById = new Map();
  let screensById = new Map();
  let opinionsById = new Map();
  let brokenById = new Map();

  let paused = false;
  let storyAdvanceToken = 0;
  let noteSkimToken = 0;
  let noteSkimDirection = 1;

  let phaseLabelForUi = "Windows Atlas";
  let activeIntroText = "";
  let activeEditorialText = "";
  let activeNoteIdForVoiceover = "";
  let stageSizePx = 0;
  let stageLeftPx = 0;
  let stageTopPx = 0;
  let stageBottomPx = 0;
  let stageTitleYPx = 0;
  let editorialWidthPx = 0;
  let stageCenterXPx = 0;
  let stageCenterYPx = 0;
  let stageSubtitleYPx = 0;
  let stageProgressRatio = 0;
  let stageProgressPath = "M 0 0";

  let editorialNotes = [];
  let introWindows = "";
  let introScreens = "";
  let introOpinions = "";
  let introBroken = "";

  const RECORD_SIZE_PX = 1920; //3840;
  const RECORD_FPS = 30;
  const RECORD_FINAL_HOLD_MS = 180;
  const RECORD_BLACKOUT_MS = 3000;

  let p5CanvasEl = null;
  let isRecording4K = false;
  let recordingError = "";
  let recordingCanvas = null;
  let recordingCtx = null;
  let recordingStream = null;
  let recordingMediaRecorder = null;
  let recordingChunks = [];
  let recordingRaf = 0;
  let saveRecordingOnStop = true;
  let recordingFinalizing = false;
  let recordingFinalizeHoldUntilMs = 0;
  let recordingBlackoutUntilMs = 0;
  let freezeBrokenOnDrawing = false;

  const imageCache = new Map();
  const imageMeta = new Map();
  let imageMetaVersion = 0;

  let focusPaddingRatio = 0.50;
  let syncFocusToEditorial = true;

  let voiceoverEnabled = false;
  let voiceoverSupported = false;
  let voiceoverError = "";
  let lastVoiceoverCueKey = "";
  let voiceoverVoices = [];
  let voiceoverVoiceNames = [];
  let voiceoverVoiceName = "";
  let voiceoverRate = 0.92;
  let detachVoiceoverVoicesListener = () => {};

  function buildStageProgressPath(ratio) {
    const r = Math.max(0, Math.min(1, Number(ratio) || 0));
    const total = 400;
    let remaining = total * r;
    const points = [[0, 0]];

    const pushPoint = (x, y) => {
      const last = points[points.length - 1];
      if (!last || last[0] !== x || last[1] !== y) points.push([x, y]);
    };

    if (remaining <= 0) return "M 0 0";

    // top edge
    if (remaining <= 100) {
      pushPoint(remaining, 0);
      return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
    }
    pushPoint(100, 0);
    remaining -= 100;

    // right edge
    if (remaining <= 100) {
      pushPoint(100, remaining);
      return `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ");
    }
    pushPoint(100, 100);
    remaining -= 100;

    // bottom edge
    if (remaining <= 100) {
      pushPoint(100 - remaining, 100);
      return `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ");
    }
    pushPoint(0, 100);
    remaining -= 100;

    // left edge
    pushPoint(0, Math.max(0, 100 - remaining));
    return `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ");
  }

  function drawRecordingStageProgress(ctx, ratio, sizePx) {
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

  function stopRecordingStream() {
    if (recordingRaf) {
      cancelAnimationFrame(recordingRaf);
      recordingRaf = 0;
    }
    if (recordingStream) {
      recordingStream.getTracks().forEach((track) => track.stop());
    }
    recordingStream = null;
    recordingMediaRecorder = null;
    recordingCanvas = null;
    recordingCtx = null;
    recordingFinalizing = false;
    recordingFinalizeHoldUntilMs = 0;
    recordingBlackoutUntilMs = 0;
    freezeBrokenOnDrawing = false;
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

  function drawRecordingOverlayText(
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
      ctx.fillStyle = textColor;
      ctx.fillText(line, centerX, y + lineHeight / 2);
    }
    ctx.restore();
  }

  function pxNumber(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getRecordingOverlayMetrics({
    textSelector,
    boxSelector,
    fallbackFontPx,
    fallbackLineHeight,
    fallbackWidthPx,
  }) {
    const stageRef = Math.max(1, stageSizePx || 1);
    const stageToRecord = RECORD_SIZE_PX / stageRef;
    let fontPx = fallbackFontPx;
    let lineHeight = fallbackLineHeight;
    let widthPx = fallbackWidthPx;

    if (browser) {
      const textEl = document.querySelector(textSelector);
      if (textEl) {
        const style = window.getComputedStyle(textEl);
        fontPx = pxNumber(style.fontSize, fallbackFontPx) * stageToRecord;
        lineHeight =
          pxNumber(style.lineHeight, fallbackLineHeight) * stageToRecord;
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

  function drawRecordingFrame() {
    if (!isRecording4K || !recordingCtx || !recordingCanvas || !p5CanvasEl)
      return;

    if (recordingFinalizing) {
      const nowMs = performance.now();
      if (nowMs >= recordingBlackoutUntilMs) {
        stop4KRecording();
        return;
      }
      if (nowMs >= recordingFinalizeHoldUntilMs) {
        recordingCtx.fillStyle = "#000";
        recordingCtx.fillRect(0, 0, RECORD_SIZE_PX, RECORD_SIZE_PX);
        recordingRaf = requestAnimationFrame(drawRecordingFrame);
        return;
      }
    }

    const canvasCssW = Math.max(1, p5CanvasEl.clientWidth || 1);
    const canvasCssH = Math.max(1, p5CanvasEl.clientHeight || 1);
    const ratioX = p5CanvasEl.width / canvasCssW;
    const ratioY = p5CanvasEl.height / canvasCssH;

    const srcW = Math.max(1, Math.round(stageSizePx * ratioX));
    const srcH = Math.max(1, Math.round(stageSizePx * ratioY));
    const sx = Math.max(0, Math.round(stageLeftPx * ratioX));
    const sy = Math.max(0, Math.round(stageTopPx * ratioY));

    recordingCtx.fillStyle = "#000";
    recordingCtx.fillRect(0, 0, RECORD_SIZE_PX, RECORD_SIZE_PX);
    recordingCtx.drawImage(
      p5CanvasEl,
      sx,
      sy,
      srcW,
      srcH,
      0,
      0,
      RECORD_SIZE_PX,
      RECORD_SIZE_PX,
    );

    const stageToRecord = RECORD_SIZE_PX / Math.max(1, stageSizePx || 1);
    const introY = Math.max(
      12,
      Math.round((stageTitleYPx - stageTopPx) * stageToRecord),
    );
    const subtitleY = Math.max(
      12,
      Math.round((stageSubtitleYPx - stageTopPx) * stageToRecord),
    );
    const introMetrics = getRecordingOverlayMetrics({
      textSelector: ".editorialCornerText",
      boxSelector: ".editorialCorner",
      fallbackFontPx: RECORD_SIZE_PX * 0.02,
      fallbackLineHeight: RECORD_SIZE_PX * 0.023,
      fallbackWidthPx: RECORD_SIZE_PX * 0.78,
    });
    const editorialMetrics = getRecordingOverlayMetrics({
      textSelector: ".editorialText",
      boxSelector: ".editorialTape",
      fallbackFontPx: RECORD_SIZE_PX * 0.019,
      fallbackLineHeight: RECORD_SIZE_PX * 0.023,
      fallbackWidthPx: RECORD_SIZE_PX * 0.78,
    });

    drawRecordingOverlayText(recordingCtx, activeIntroText, {
      centerX: RECORD_SIZE_PX / 2,
      anchorY: introY,
      width: introMetrics.widthPx,
      fontPx: introMetrics.fontPx,
      lineHeight: introMetrics.lineHeight,
      anchor: "top",
      textColor: "#FFFFFF",
    });
    drawRecordingOverlayText(recordingCtx, activeEditorialText, {
      centerX: RECORD_SIZE_PX / 2,
      anchorY: subtitleY,
      width: editorialMetrics.widthPx,
      fontPx: editorialMetrics.fontPx,
      lineHeight: editorialMetrics.lineHeight,
      anchor: "bottom",
    });

    recordingCtx.strokeStyle = "rgba(255,255,255,0.1)";
    recordingCtx.lineWidth = 1;
    recordingCtx.strokeRect(0.5, 0.5, RECORD_SIZE_PX - 1, RECORD_SIZE_PX - 1);
    drawRecordingStageProgress(recordingCtx, stageProgressRatio, RECORD_SIZE_PX);

    recordingRaf = requestAnimationFrame(drawRecordingFrame);
  }

  function stop4KRecording({ save = true } = {}) {
    if (!recordingMediaRecorder) return;
    saveRecordingOnStop = save;
    isRecording4K = false;
    recordingFinalizing = false;
    recordingFinalizeHoldUntilMs = 0;
    recordingBlackoutUntilMs = 0;
    freezeBrokenOnDrawing = false;
    if (recordingMediaRecorder.state !== "inactive") {
      recordingMediaRecorder.stop();
    } else {
      stopRecordingStream();
    }
  }

  function start4KRecording() {
    if (!browser) return;
    recordingError = "";
    if (!p5CanvasEl || stageSizePx < 2) {
      recordingError = "Canvas not ready yet.";
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      recordingError = "MediaRecorder is not available in this browser.";
      return;
    }
    if (isRecording4K) return;

    recordingCanvas = document.createElement("canvas");
    recordingCanvas.width = RECORD_SIZE_PX;
    recordingCanvas.height = RECORD_SIZE_PX;
    recordingCtx = recordingCanvas.getContext("2d", { alpha: false });
    if (!recordingCtx) {
      recordingError = "Could not initialize recording context.";
      return;
    }

    const stream = recordingCanvas.captureStream(RECORD_FPS);
    const mimeTypeCandidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType =
      mimeTypeCandidates.find((candidate) =>
        MediaRecorder.isTypeSupported(candidate),
      ) || "";

    try {
      recordingStream = stream;
      recordingChunks = [];
      recordingMediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, videoBitsPerSecond: 50_000_000 } : undefined,
      );
    } catch (error) {
      recordingError = "Could not start the 4K recorder.";
      stopRecordingStream();
      return;
    }

    recordingMediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordingChunks.push(event.data);
    };
    recordingMediaRecorder.onstop = () => {
      if (saveRecordingOnStop && recordingChunks.length) {
        const blob = new Blob(recordingChunks, {
          type: recordingMediaRecorder?.mimeType || "video/webm",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `cables-4k-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      recordingChunks = [];
      stopRecordingStream();
      isRecording4K = false;
    };
    recordingMediaRecorder.onerror = () => {
      recordingError = "Recording failed.";
      stop4KRecording({ save: false });
    };

    saveRecordingOnStop = true;
    recordingFinalizing = false;
    recordingFinalizeHoldUntilMs = 0;
    recordingBlackoutUntilMs = 0;
    freezeBrokenOnDrawing = false;
    isRecording4K = true;
    drawRecordingFrame();
    recordingMediaRecorder.start();
  }

  function toggle4KRecording() {
    if (isRecording4K) {
      stop4KRecording();
      return;
    }
    start4KRecording();
  }

  function stopVoiceoverPreview() {
    if (!browser) return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }

  function preferredVoiceFrom(voices) {
    const preferredNames = [
      "Samantha",
      "Karen",
      "Moira",
      "Ava (Enhanced)",
      "Ava",
      "Daniel (Enhanced)",
      "Daniel",
      "Google UK English Female",
      "Google US English",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Alex",
    ];
    for (const name of preferredNames) {
      const hit = voices.find((voice) => voice.name === name);
      if (hit) return hit;
    }
    const english = voices.find((voice) =>
      String(voice.lang || "")
        .toLowerCase()
        .startsWith("en"),
    );
    return english || voices[0] || null;
  }

  function refreshVoiceoverVoices() {
    if (!browser) return;
    if (!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices() || [];
    voiceoverVoices = voices;
    voiceoverVoiceNames = voices.map((voice) => voice.name);
    if (!voices.length) return;
    if (voices.some((voice) => voice.name === voiceoverVoiceName)) return;
    const preferred = preferredVoiceFrom(voices);
    voiceoverVoiceName = preferred?.name || voices[0]?.name || "";
  }

  function voiceoverNarrationText(value) {
    return normalizeMultilineText(value).replace(/\s+/g, " ").trim();
  }

  function speakVoiceoverText(value) {
    if (!browser || !voiceoverEnabled) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      voiceoverError = "Voice preview unavailable in this browser.";
      return;
    }

    const text = voiceoverNarrationText(value);
    window.speechSynthesis.cancel();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voiceoverVoices.find(
      (voice) => voice.name === voiceoverVoiceName,
    );
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || "en-US";
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = voiceoverRate;
    utterance.pitch = 1;
    utterance.onerror = () => {
      voiceoverError = "Could not speak this note.";
    };
    window.speechSynthesis.speak(utterance);
  }

  function setVoiceoverVoice(name) {
    voiceoverVoiceName = String(name || "");
    if (!voiceoverEnabled) return;
    const cueKey = `${activeNoteIdForVoiceover}|${activeEditorialText}`;
    lastVoiceoverCueKey = cueKey;
    speakVoiceoverText(activeEditorialText);
  }

  function setVoiceoverRate(value) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return;
    voiceoverRate = Math.max(0.75, Math.min(1.1, parsed));
    if (!voiceoverEnabled) return;
    const cueKey = `${activeNoteIdForVoiceover}|${activeEditorialText}`;
    lastVoiceoverCueKey = cueKey;
    speakVoiceoverText(activeEditorialText);
  }

  function toggleVoiceoverPreview() {
    if (!voiceoverSupported) return;
    voiceoverEnabled = !voiceoverEnabled;
    voiceoverError = "";
    if (!voiceoverEnabled) {
      stopVoiceoverPreview();
      return;
    }
    lastVoiceoverCueKey = "";
  }

  function nextStory() {
    paused = false;
    storyAdvanceToken += 1;
  }

  function nextText() {
    noteSkimDirection = 1;
    noteSkimToken += 1;
  }

  function prevText() {
    noteSkimDirection = -1;
    noteSkimToken += 1;
  }

  function getImageAspect(url) {
    const meta = imageMeta.get(url);
    if (!meta || !meta.w || !meta.h) return 1.4;
    const aspect = meta.w / meta.h;
    return aspect > 0 ? aspect : 1.4;
  }

  function phaseSectionDurationMs(phaseId, viewState, fallbackMs) {
    const key = `${phaseId}-${viewState}`;
    const notes = editorialNotes
      .filter(
        (note) => note.active && note.mode !== "target" && note.phase === key,
      )
      .sort((a, b) => a.order - b.order);
    if (!notes.length) return fallbackMs;
    const totalSec = notes.reduce(
      (sum, note) => sum + Math.max(0.5, Number(note.durationSec) || 0.5),
      0,
    );
    return Math.max(1000, Math.round(totalSec * 1000));
  }

  function applyEditorialPayload(payload) {
    if (Array.isArray(payload)) {
      editorialNotes = payload.map((note, index) => normalizeNote(note, index));
      return;
    }
    if (!payload || typeof payload !== "object") return;

    if (Array.isArray(payload.notes)) {
      editorialNotes = payload.notes.map((note, index) =>
        normalizeNote(note, index),
      );
    }

    const intro = payload.intro;
    if (!intro || typeof intro !== "object") return;

    if (typeof intro.windows === "string") {
      introWindows = normalizeMultilineText(intro.windows);
    }
    if (typeof intro.screens === "string") {
      introScreens = normalizeMultilineText(intro.screens);
    }
    if (typeof intro.opinions === "string") {
      introOpinions = normalizeMultilineText(intro.opinions);
    }
    if (typeof intro.broken === "string") {
      introBroken = normalizeMultilineText(intro.broken);
    }

    if (typeof intro.text === "string") {
      const legacyIntro = normalizeMultilineText(intro.text);
      introWindows = legacyIntro;
      introScreens = legacyIntro;
      introOpinions = legacyIntro;
      introBroken = legacyIntro;
    }
  }

  function resolveActiveNote(
    phaseId,
    phaseElapsedSec,
    viewState,
    focusTarget = null,
    viewElapsedSec = phaseElapsedSec,
  ) {
    const stateAlias = `${phaseId}-${viewState}`;
    const candidates = editorialNotes
      .filter(
        (note) =>
          note.active &&
          (note.phase === phaseId ||
            note.phase === stateAlias ||
            note.phase === "any"),
      )
      .sort((a, b) => a.order - b.order);
    if (candidates.length === 0) return null;

    const byTarget = candidates.filter((note) => {
      if (note.mode !== "target" || !note.targetId || !focusTarget?.id)
        return false;
      if (note.targetId !== focusTarget.id) return false;
      if (note.targetStep === "any") return true;
      return note.targetStep === focusTarget.step;
    });
    if (byTarget.length) return byTarget[byTarget.length - 1];

    const stateNotes = candidates.filter(
      (note) => note.mode !== "target" && note.phase === stateAlias,
    );
    if (stateNotes.length)
      return sequenceNoteByDuration(stateNotes, viewElapsedSec, {
        loop: true,
        restartPauseSec: NOTE_RESTART_PAUSE_SEC,
        returnNullDuringPause: true,
      });

    const phaseNotes = candidates.filter(
      (note) => note.mode !== "target" && note.phase === phaseId,
    );
    if (phaseNotes.length)
      return sequenceNoteByDuration(phaseNotes, phaseElapsedSec);

    const anyNotes = candidates.filter(
      (note) => note.mode !== "target" && note.phase === "any",
    );
    if (anyNotes.length)
      return sequenceNoteByDuration(anyNotes, phaseElapsedSec);

    return null;
  }

  function editorialTimelineFor(phaseId, viewState) {
    const stateAlias = `${phaseId}-${viewState}`;
    const stateNotes = editorialNotes
      .filter(
        (note) =>
          note.active && note.mode !== "target" && note.phase === stateAlias,
      )
      .sort((a, b) => a.order - b.order);
    if (stateNotes.length) {
      return {
        key: `state:${stateAlias}`,
        notes: stateNotes,
        elapsedMode: "view",
        loop: true,
        restartPauseSec: NOTE_RESTART_PAUSE_SEC,
      };
    }

    const phaseNotes = editorialNotes
      .filter(
        (note) =>
          note.active && note.mode !== "target" && note.phase === phaseId,
      )
      .sort((a, b) => a.order - b.order);
    if (phaseNotes.length) {
      return {
        key: `phase:${phaseId}`,
        notes: phaseNotes,
        elapsedMode: "phase",
        loop: false,
        restartPauseSec: 0,
      };
    }

    const anyNotes = editorialNotes
      .filter(
        (note) => note.active && note.mode !== "target" && note.phase === "any",
      )
      .sort((a, b) => a.order - b.order);
    if (anyNotes.length) {
      return {
        key: "any",
        notes: anyNotes,
        elapsedMode: "phase",
        loop: false,
        restartPauseSec: 0,
      };
    }

    return {
      key: "",
      notes: [],
      elapsedMode: "phase",
      loop: false,
      restartPauseSec: 0,
    };
  }

  function stateNotesForSkim(phaseId, viewState) {
    const stateAlias = `${phaseId}-${viewState}`;
    return editorialNotes
      .filter(
        (note) =>
          note.active && note.mode !== "target" && note.phase === stateAlias,
      )
      .sort((a, b) => a.order - b.order);
  }

  function chapterSkimDescriptors(phaseId, phaseMode) {
    const focusState = phaseMode === "broken" ? "broken-seq" : "focus";
    const states = ["grid", focusState];
    return states
      .map((viewState) => {
        const notes = stateNotesForSkim(phaseId, viewState);
        return {
          viewState,
          notes,
          key: `state:${phaseId}-${viewState}`,
        };
      })
      .filter((item) => item.notes.length > 0);
  }

  function introForPhase(phaseId) {
    if (phaseId === "windows") return introWindows;
    if (phaseId === "screens") return introScreens;
    if (phaseId === "opinions") return introOpinions;
    if (phaseId === "broken") return introBroken;
    return "";
  }

  $: records = rows.map(normalizeRecord);
  $: windowsItems = sortRecords(
    records.filter((row) => row.mode === "windows" && row.imageUrl),
  );
  $: screensItems = sortRecords(
    records.filter((row) => row.mode === "screens" && row.imageUrl),
  );
  $: opinionsItems = sortRecords(
    records.filter((row) => row.mode === "opinions" && row.text),
  );
  $: windowsById = mapById(windowsItems);
  $: screensById = mapById(screensItems);
  $: opinionsById = mapById(opinionsItems);

  $: {
    const chainMap = new Map();
    records
      .filter((row) => row.mode === "broken")
      .forEach((row) => {
        if (!chainMap.has(row.chainId)) {
          chainMap.set(row.chainId, {
            id: row.chainId,
            orderHint: row.orderHint,
            image: null,
            text: null,
            drawing: null,
          });
        }

        const chain = chainMap.get(row.chainId);
        if (row.step === "image") chain.image = row;
        if (row.step === "text") chain.text = row;
        if (row.step === "drawing") chain.drawing = row;
      });

    const completeChains = [...chainMap.values()]
      .filter(
        (chain) =>
          Boolean(chain.image?.imageUrl) &&
          Boolean(chain.text?.text) &&
          Boolean(chain.drawing?.imageUrl),
      )
      .sort((a, b) => a.orderHint - b.orderHint);

    // Keep one record per original chain (like /exausting): image -> text -> drawing.
    // Do not collapse by source image, so editorial anchors can target exact chain IDs.
    brokenChains = completeChains
      .map((chain) => ({
        id: `merged-${chain.id}`,
        aliasIds: [`merged-${chain.id}`],
        orderHint: chain.orderHint || 0,
        image: chain.image,
        text: chain.text,
        drawing: chain.drawing,
      }))
      .sort((a, b) => a.orderHint - b.orderHint);
  }

  $: brokenById = mapById(brokenChains);

  $: {
    const sizeRef = Math.max(900, Math.min(width || 1200, height || 1200));
    const baseW = Math.max(90, Math.round(sizeRef / 7));
    const windowsCols = Math.max(6, Math.ceil(Math.sqrt(windowsItems.length)));
    const screensCols = Math.max(6, Math.ceil(Math.sqrt(screensItems.length)));
    const opinionsCardW = Math.round(baseW * 1.55);
    const opinionsCols = Math.max(
      5,
      Math.ceil(Math.sqrt(opinionsItems.length)),
    );
    const brokenCols = Math.max(8, Math.ceil(Math.sqrt(brokenChains.length)));

    windowsLayout = buildMasonryLayout(
      windowsItems,
      (item) => getImageAspect(item.imageUrl),
      windowsCols,
      baseW,
      0,
    );
    screensLayout = buildMasonryLayout(
      screensItems,
      (item) => getImageAspect(item.imageUrl),
      screensCols,
      baseW,
      0,
    );

    opinionsLayout = buildMasonryLayout(
      opinionsItems,
      (item) => {
        const h = estimateOpinionCardHeight(item.text, opinionsCardW);
        return opinionsCardW / Math.max(1, h);
      },
      opinionsCols,
      opinionsCardW,
      0,
    );

    brokenLayout = buildMasonryLayout(
      brokenChains,
      (chain) =>
        getImageAspect(chain.image?.imageUrl || chain.drawing?.imageUrl || ""),
      brokenCols,
      Math.round(baseW * 1.02),
      0,
    );

    imageMetaVersion;
  }
  $: {
    const w = width || 0;
    const h = height || 0;
    stageSizePx = Math.max(0, Math.min(w, h));
    stageLeftPx = Math.max(0, (w - stageSizePx) / 2);
    stageTopPx = Math.max(0, (h - stageSizePx) / 2);
    stageBottomPx = stageTopPx + stageSizePx;
    stageTitleYPx = stageTopPx + 8;
    stageCenterXPx = stageLeftPx + stageSizePx / 2;
    stageCenterYPx = stageTopPx + stageSizePx / 2;
    stageSubtitleYPx = stageBottomPx - 8;
    editorialWidthPx = Math.max(0, Math.round(stageSizePx * 0.62));
    stageProgressPath = buildStageProgressPath(stageProgressRatio);
  }
  $: windowsTraversal = buildColumnSnakeTraversal(windowsItems, windowsLayout);
  $: screensTraversal = buildColumnSnakeTraversal(screensItems, screensLayout);
  $: opinionsTraversal = buildColumnSnakeTraversal(
    opinionsItems,
    opinionsLayout,
  );
  $: brokenTraversal = buildColumnSnakeTraversal(brokenChains, brokenLayout);

  onMount(() => {
    if (!browser) return;
    voiceoverSupported =
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined";
    if (voiceoverSupported) {
      refreshVoiceoverVoices();
      const onVoicesChanged = () => refreshVoiceoverVoices();
      if (typeof window.speechSynthesis.addEventListener === "function") {
        window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
        detachVoiceoverVoicesListener = () => {
          window.speechSynthesis.removeEventListener(
            "voiceschanged",
            onVoicesChanged,
          );
        };
      } else {
        window.speechSynthesis.onvoiceschanged = onVoicesChanged;
        detachVoiceoverVoicesListener = () => {
          if (window.speechSynthesis.onvoiceschanged === onVoicesChanged) {
            window.speechSynthesis.onvoiceschanged = null;
          }
        };
      }
    }

    (async () => {
      const mod = await import("p5-svelte");
      P5 = mod.default;
      rows = await tsv("/cables.tsv");
      const editorial = await fetch("/cables_editorial.json")
        .then((res) => res.json())
        .catch(() => null);
      applyEditorialPayload(editorial);
    })();
  });

  onDestroy(() => {
    detachVoiceoverVoicesListener();
    stopVoiceoverPreview();
    if (isRecording4K) stop4KRecording({ save: false });
    stopRecordingStream();
  });

  $: if (browser && voiceoverEnabled) {
    const cueKey = `${activeNoteIdForVoiceover}|${activeEditorialText}`;
    if (cueKey !== lastVoiceoverCueKey) {
      lastVoiceoverCueKey = cueKey;
      speakVoiceoverText(activeEditorialText);
    }
  }

  function ensureImage(s, url) {
    if (!url) return null;

    const cached = imageCache.get(url);
    if (cached?.status === "loaded") return cached.image;
    if (cached?.status === "loading" || cached?.status === "error") return null;

    imageCache.set(url, { status: "loading", image: null });
    s.loadImage(
      url,
      (image) => {
        imageCache.set(url, { status: "loaded", image });
        if (!imageMeta.has(url)) {
          imageMeta.set(url, { w: image.width, h: image.height });
          imageMetaVersion += 1;
        }
      },
      () => imageCache.set(url, { status: "error", image: null }),
    );

    return null;
  }

  function extractInlineImageIds(value) {
    const raw = String(value || "");
    if (!raw) return [];
    const matches = raw.match(/\b[A-Za-z0-9_-]{20,}\b/g) || [];
    return [...new Set(matches)];
  }

  function extractInlineRecordIds(value) {
    const raw = String(value || "");
    if (!raw) return [];
    const matches = [...raw.matchAll(/\[\[id:([A-Za-z0-9_-]{3,})\]\]/g)];
    return [...new Set(matches.map((match) => match[1]).filter(Boolean))];
  }

  function stripInlineImageIds(value) {
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

  function resolveNoteAnchorRecordId(note, orderedRecords) {
    if (!note || !orderedRecords.length) return "";
    const explicitRecordId = normalizeText(note.anchorId || "");
    if (explicitRecordId) {
      const direct = orderedRecords.find((item) => item.id === explicitRecordId);
      if (direct?.id) return direct.id;
      const viaAlias = orderedRecords.find((item) =>
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
        const viaAlias = orderedRecords.find((item) =>
          Array.isArray(item.aliasIds) && item.aliasIds.includes(recordId),
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

  function isTypingElementFocused() {
    if (!browser) return false;
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

  const sketch = (s) => {
    const camera = {
      initialized: false,
      x: 0,
      y: 0,
      scale: 1,
      toX: 0,
      toY: 0,
      toScale: 1,
      lastMs: 0,
    };

    let phaseIndex = 0;
    let phaseElapsedMs = 0;
    let lastFrameMs = 0;
    let focusIndex = 0;
    let brokenLastCompletedId = null;
    const brokenCompletedIds = new Set();
    let viewStatePrev = "grid";
    let zoomStartCamera = null;
    let storyTokenSeen = storyAdvanceToken;
    let noteSkimSeen = noteSkimToken;
    const noteSkimOffsetByTimeline = new Map();
    let skimZoomRunMs = 0;
    let noteAnchorRecordId = "";
    let noteAnchorHoldMs = 0;
    let zoomAnchorRecordId = "";
    let lastResolvedNoteId = "";
    let traversalOffset = 0;
    let anchorHoldMsRemaining = 0;
    let lockedAnchorRecordId = "";
    let snapCameraToAnchor = false;
    let brokenAnchorSettledNoteId = "";
    let brokenAnchorSettledAtSec = 0;
    let brokenFocusHoldOffsetSec = 0;
    let brokenFocusHoldNoteId = "";
    let font;

    function resetPhaseProgress(nowMs = 0) {
      phaseElapsedMs = 0;
      lastFrameMs = nowMs;
      focusIndex = 0;
      brokenLastCompletedId = null;
      noteSkimOffsetByTimeline.clear();
      brokenCompletedIds.clear();
      freezeBrokenOnDrawing = false;
      viewStatePrev = "grid";
      zoomStartCamera = null;
      traversalOffset = 0;
      noteAnchorRecordId = "";
      noteAnchorHoldMs = 0;
      zoomAnchorRecordId = "";
      lastResolvedNoteId = "";
      anchorHoldMsRemaining = 0;
      lockedAnchorRecordId = "";
      snapCameraToAnchor = false;
      brokenAnchorSettledNoteId = "";
      brokenAnchorSettledAtSec = 0;
      brokenFocusHoldOffsetSec = 0;
      brokenFocusHoldNoteId = "";
    }

    function jumpPhase(offset = 1, nowMs = 0) {
      const len = Math.max(1, TIMELINE.length);
      phaseIndex = (phaseIndex + offset + len * 8) % len;
      resetPhaseProgress(nowMs);
    }

    function activePhase() {
      return TIMELINE[phaseIndex] || TIMELINE[0];
    }

    function phaseCollection(phase) {
      if (phase.mode === "windows") {
        return {
          ordered: windowsItems,
          byId: windowsById,
          layout: windowsLayout,
          traversal: windowsTraversal,
          type: "image",
        };
      }
      if (phase.mode === "screens") {
        return {
          ordered: screensItems,
          byId: screensById,
          layout: screensLayout,
          traversal: screensTraversal,
          type: "image",
        };
      }
      if (phase.mode === "opinions") {
        return {
          ordered: opinionsItems,
          byId: opinionsById,
          layout: opinionsLayout,
          traversal: opinionsTraversal,
          type: "text",
        };
      }
      return {
        ordered: brokenChains,
        byId: brokenById,
        layout: brokenLayout,
        traversal: brokenTraversal,
        type: "broken",
      };
    }

    function setCameraTarget(target, now) {
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

    function tickCamera(now, viewState = "focus", focusAdvanceMs = 9800) {
      if (!camera.initialized) return;
      const dt = Math.max(1, now - camera.lastMs);
      camera.lastMs = now;

      const dx = camera.toX - camera.x;
      const dy = camera.toY - camera.y;
      const distance = Math.hypot(dx, dy);
      const ds = camera.toScale - camera.scale;

      if (viewState === "focus" || viewState === "broken-seq") {
        const followMs =
          viewState === "broken-seq"
            ? Math.max(900, Math.min(5200, focusAdvanceMs * 0.85))
            : Math.max(120, Math.min(1200, focusAdvanceMs * 0.22));
        const posBlend = Math.min(1, dt / followMs);
        const scaleBlend = Math.min(1, dt / Math.max(90, followMs * 0.72));
        camera.x += dx * posBlend;
        camera.y += dy * posBlend;
        camera.scale += ds * scaleBlend;
        return;
      }

      const posSpeed = viewState === "grid" ? 0.09 : 0.045;
      const scaleSpeed = viewState === "grid" ? 0.00018 : 0.0003;
      const maxPosStep = posSpeed * dt;
      if (distance <= maxPosStep || distance === 0) {
        camera.x = camera.toX;
        camera.y = camera.toY;
      } else {
        const t = maxPosStep / distance;
        camera.x += dx * t;
        camera.y += dy * t;
      }
      const maxScaleStep = scaleSpeed * dt;
      if (Math.abs(ds) <= maxScaleStep) {
        camera.scale = camera.toScale;
      } else {
        camera.scale += Math.sign(ds) * maxScaleStep;
      }
    }

    function drawImage(url, entry, alpha = 1, desaturate = false) {
      const image = ensureImage(s, url);
      if (!image) {
        s.noStroke();
        s.fill(...VIEWS_PALETTE.missing, alpha);
        s.rect(entry.x, entry.y, entry.w, entry.h);
        return;
      }

      s.noStroke();
      s.fill(...VIEWS_PALETTE.tile, alpha);
      s.rect(entry.x, entry.y, entry.w, entry.h);

      const scale = Math.min(entry.w / image.width, entry.h / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const x = entry.x - drawW / 2;
      const y = entry.y - drawH / 2;

      const ctx = s.drawingContext;
      ctx.save();
      if (desaturate) ctx.filter = "grayscale(1)";
      s.tint(255, 255 * alpha);
      s.image(image, x, y, drawW, drawH);
      s.noTint();
      ctx.restore();
    }

    function drawCardMeta(record, entry, alpha = 1) {
      if (!record) return;

      const location = record.location || "Unknown";
      const country = record.country
        ? `, ${String(record.country).toUpperCase()}`
        : "";
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
    }

    function drawText(
      text,
      entry,
      focused = false,
      alpha = 1,
      mode = "top-left",
      sizeScale = 1,
      excerptLimit = null,
      leadingRatio = null,
      textColor = VIEWS_PALETTE.textPrimary,
    ) {
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
              while (
                cut > 1 &&
                s.textWidth(current.slice(0, cut)) > widthLimit
              ) {
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
      const leading =
        mode === "center"
          ? Math.max(rawLeading, appliedSize * 1.02)
          : rawLeading;
      s.textSize(appliedSize);
      s.textLeading(leading);

      if (mode === "center") {
        const blockW = Math.max(1, entry.w * 0.88);
        const maxLines = Math.max(1, Math.floor((entry.h * 0.88) / leading));
        let lines = wrapLines(textBody, blockW);
        if (lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          lines[maxLines - 1] = fitLineWithEllipsis(
            lines[maxLines - 1],
            blockW,
          );
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

      const blockW =
        mode === "center"
          ? Math.max(1, entry.w * 0.88)
          : Math.max(1, entry.w - padX * 2);
      const approxLines = Math.max(
        1,
        Math.ceil(s.textWidth(textBody) / Math.max(1, blockW)),
      );
      const blockH = Math.max(
        appliedSize + 2,
        Math.min(entry.h, approxLines * leading + 2),
      );
      const blockX = mode === "center" ? entry.x - blockW / 2 : boxX;
      const blockY = mode === "center" ? entry.y - blockH / 2 : boxY;

      s.noStroke();
      s.fill(0, 0, 0, 1);
      s.rect(blockX, blockY, blockW, blockH);

      const ctx = s.drawingContext;
      ctx.save();
      ctx.beginPath();
      ctx.rect(blockX, blockY, blockW, blockH);
      ctx.clip();

      s.fill(...textColor, alpha);
      s.text(
        textBody,
        mode === "center" ? blockX + blockW / 2 : blockX + padX,
        mode === "center" ? blockY + blockH / 2 : blockY + padY,
        mode === "center" ? blockW : Math.max(1, blockW - padX * 2),
        mode === "center" ? blockH : Math.max(1, blockH - padY * 2),
      );
      ctx.restore();
      s.pop();
    }

    function drawBrokenState(
      chain,
      entry,
      state = "image",
      alpha = 1,
      desaturate = false,
    ) {
      if (state === "image" && chain.image?.imageUrl) {
        drawImage(chain.image.imageUrl, entry, alpha, desaturate);
        return;
      }
      if (state === "drawing" && chain.drawing?.imageUrl) {
        drawImage(chain.drawing.imageUrl, entry, alpha, desaturate);
        return;
      }
      if (state === "text" && chain.text?.text) {
        drawText(
          chain.text.text,
          entry,
          true,
          alpha,
          "center",
          BROKEN_TEXT_STYLE.sizeScale,
          BROKEN_TEXT_STYLE.excerpt,
          BROKEN_TEXT_STYLE.leadingRatio,
        );
        return;
      }
      if (chain.image?.imageUrl) {
        drawImage(chain.image.imageUrl, entry, alpha, desaturate);
        return;
      }
      if (chain.drawing?.imageUrl) {
        drawImage(chain.drawing.imageUrl, entry, alpha, desaturate);
        return;
      }
      if (chain.text?.text) {
        drawText(
          chain.text.text,
          entry,
          false,
          alpha,
          "center",
          BROKEN_TEXT_STYLE.sizeScale,
          BROKEN_TEXT_STYLE.excerpt,
          BROKEN_TEXT_STYLE.leadingRatio,
        );
        return;
      }

      s.noStroke();
      s.fill(...VIEWS_PALETTE.missing, alpha);
      s.rect(entry.x, entry.y, entry.w, entry.h);
    }

    function brokenMetaForState(chain, state = "image") {
      if (state === "image" && chain.image) return chain.image;
      if (state === "text" && chain.text) return chain.text;
      if (state === "drawing" && chain.drawing) return chain.drawing;
      return chain.image || chain.text || chain.drawing || null;
    }

    s.preload = () => {
      font = s.loadFont("terminal-grotesque.woff");
    };

    s.setup = () => {
      const renderer = s.createCanvas(1, 1);
      p5CanvasEl = renderer?.elt || null;
      s.colorMode(s.HSL, 360, 100, 100, 1);
      s.rectMode(s.CENTER);
      s.imageMode(s.CORNER);
      s.textFont(font);
      s.frameRate(30);

      s.keyPressed = () => {
        if (isTypingElementFocused()) return true;

        if (s.key === " ") {
          paused = !paused;
          return false;
        }

        if (paused && s.key === ".") {
          jumpPhase(1, s.millis());
          return false;
        }

        if (paused && s.key === ",") {
          jumpPhase(-1, s.millis());
          return false;
        }

        if (paused && s.keyCode === s.RIGHT_ARROW) {
          const phase = activePhase();
          const { traversal } = phaseCollection(phase);
          if (traversal.length > 0)
            focusIndex = (focusIndex + 1) % traversal.length;
          return false;
        }

        if (paused && s.keyCode === s.LEFT_ARROW) {
          const phase = activePhase();
          const { traversal } = phaseCollection(phase);
          if (traversal.length > 0)
            focusIndex = (focusIndex - 1 + traversal.length) % traversal.length;
          return false;
        }

        return true;
      };
    };

    s.draw = () => {
      if (width && height && (s.width !== width || s.height !== height)) {
        s.resizeCanvas(width, height);
      }

      s.background(...VIEWS_PALETTE.canvas, 1);

      const stageSize = Math.min(s.width, s.height);
      const stageX = (s.width - stageSize) / 2;
      const stageY = (s.height - stageSize) / 2;

      const now = s.millis();
      if (storyTokenSeen !== storyAdvanceToken) {
        const delta = Math.max(1, storyAdvanceToken - storyTokenSeen);
        jumpPhase(delta, now);
        camera.initialized = false;
        camera.x = 0;
        camera.y = 0;
        camera.scale = 1;
        camera.toX = 0;
        camera.toY = 0;
        camera.toScale = 1;
        camera.lastMs = now;
        storyTokenSeen = storyAdvanceToken;
      }

      const phase = activePhase();
      const { ordered, byId, layout, traversal, type } = phaseCollection(phase);
      if (!ordered.length || !traversal.length) {
        stageProgressRatio = 0;
        lastFrameMs = now;
        return;
      }

      if (lastFrameMs === 0) lastFrameMs = now;
      const frameDeltaMs = Math.max(0, Math.min(120, now - lastFrameMs));
      lastFrameMs = now;
      if (!paused) {
        phaseElapsedMs += frameDeltaMs;
        if (anchorHoldMsRemaining > 0) {
          anchorHoldMsRemaining = Math.max(
            0,
            anchorHoldMsRemaining - frameDeltaMs,
          );
          if (anchorHoldMsRemaining <= 0) lockedAnchorRecordId = "";
        }
      } else if (skimZoomRunMs > 0) {
        phaseElapsedMs += frameDeltaMs;
        skimZoomRunMs = Math.max(0, skimZoomRunMs - frameDeltaMs);
      }
      const elapsed = phaseElapsedMs;
      const overviewMs = phaseSectionDurationMs(
        phase.id,
        "grid",
        phase.overviewMs || 0,
      );
      const zoomInMs = Math.max(0, phase.zoomInMs || 0);

      const viewState =
        elapsed < overviewMs
          ? "grid"
          : elapsed < overviewMs + zoomInMs
            ? "zoom-in"
            : phase.mode === "broken"
              ? "broken-seq"
              : "focus";
      if (viewState !== viewStatePrev) {
        if (viewState === "zoom-in") {
          zoomStartCamera = camera.initialized
            ? { x: camera.x, y: camera.y, scale: camera.scale }
            : { x: 0, y: 0, scale: 1 };
          const focusState = phase.mode === "broken" ? "broken-seq" : "focus";
          const focusTimeline = editorialTimelineFor(phase.id, focusState);
          const firstFocusNote = focusTimeline.notes[0] || null;
          if (firstFocusNote) {
            const preAnchorId = resolveNoteAnchorRecordId(
              firstFocusNote,
              ordered,
            );
            if (preAnchorId) {
              zoomAnchorRecordId = preAnchorId;
              noteAnchorRecordId = preAnchorId;
              noteAnchorHoldMs = Math.max(
                0,
                Math.round(noteDurSec(firstFocusNote) * 1000),
              );
            }
          }
        }
        if (viewState === "grid") {
          zoomStartCamera = null;
          zoomAnchorRecordId = "";
        }
        viewStatePrev = viewState;
      }

      const focusElapsedMs = Math.max(0, elapsed - overviewMs - zoomInMs);
      const preNoteViewState =
        viewState === "zoom-in"
          ? phase.mode === "broken"
            ? "broken-seq"
            : "focus"
          : viewState;
      const preViewElapsedSec =
        viewState === "grid"
          ? elapsed / 1000
          : viewState === "zoom-in"
            ? 0
            : focusElapsedMs / 1000;
      const preTimeline = editorialTimelineFor(phase.id, preNoteViewState);
      const preBaseElapsedSec =
        preTimeline.elapsedMode === "view" ? preViewElapsedSec : elapsed / 1000;
      const preElapsedOffset =
        noteSkimOffsetByTimeline.get(preTimeline.key) || 0;
      const preEffectiveElapsedSec = Math.max(
        0,
        preBaseElapsedSec +
          preElapsedOffset +
          (phase.mode === "broken" && preNoteViewState === "broken-seq"
            ? brokenFocusHoldOffsetSec
            : 0),
      );
      let preTimelineNote = null;
      let preTimelineInfo = { index: -1, inPause: false };
      let preElapsedInNoteSec = 0;
      let preActiveNoteDurSec = 0;
      if (preTimeline.notes.length) {
        const preInfo = noteIndexAtElapsed(
          preTimeline.notes,
          preEffectiveElapsedSec,
          {
            loop: preTimeline.loop,
            restartPauseSec: preTimeline.restartPauseSec,
          },
        );
        preTimelineInfo = preInfo;
        if (preInfo.index >= 0) {
          preTimelineNote = preTimeline.notes[preInfo.index];
          preActiveNoteDurSec = noteDurSec(preTimelineNote);
          preElapsedInNoteSec =
            preEffectiveElapsedSec -
            noteStartSec(preTimeline.notes, preInfo.index);
        }
      }
      const focusLikeState =
        preNoteViewState === "focus" ||
        preNoteViewState === "zoom-in" ||
        preNoteViewState === "broken-seq";
      const noteAnchorRecordForState =
        recordingFinalizing || !focusLikeState
          ? ""
          : resolveNoteAnchorRecordId(preTimelineNote, ordered);
      const anchorDrivenNoteMode = Boolean(noteAnchorRecordForState);
      const forcedFocusRecordId = anchorDrivenNoteMode
        ? noteAnchorRecordForState
        : "";
      const brokenAnchoredNoteId =
        phase.mode === "broken" && anchorDrivenNoteMode && preTimelineNote
          ? preTimelineNote.id || ""
          : "";
      const baseFocusAdvanceMs = Math.max(1, phase.focusAdvanceMs || 1);
      const focusNarrativeState =
        phase.mode === "broken" ? "broken-seq" : "focus";
      const focusNarrativeMs = phaseSectionDurationMs(
        phase.id,
        focusNarrativeState,
        0,
      );
      let effectiveFocusAdvanceMs =
        syncFocusToEditorial && focusNarrativeMs > 0
          ? Math.max(280, focusNarrativeMs / Math.max(1, traversal.length))
          : baseFocusAdvanceMs;
      if (anchorDrivenNoteMode && preTimelineNote) {
        effectiveFocusAdvanceMs = Math.max(
          effectiveFocusAdvanceMs,
          noteDurSec(preTimelineNote) * 1000,
        );
      }
      if (phase.mode === "broken") {
        effectiveFocusAdvanceMs = Math.max(effectiveFocusAdvanceMs, 3000);
      }
      const brokenChainMs = Math.max(1, effectiveFocusAdvanceMs);
      const focusCycleMs =
        syncFocusToEditorial && focusNarrativeMs > 0
          ? Math.max(1, focusNarrativeMs)
          : Math.max(1, traversal.length * effectiveFocusAdvanceMs);
      const brokenFocusHoldMs =
        phase.mode === "broken" ? brokenFocusHoldOffsetSec * 1000 : 0;
      const focusElapsedForCompletionMs =
        phase.mode === "broken" && syncFocusToEditorial && focusNarrativeMs > 0
          ? Math.max(0, focusElapsedMs + brokenFocusHoldMs)
          : focusElapsedMs;
      const autoplayProgress =
        phase.mode === "broken"
          ? 0
          : Math.min(
              traversal.length - 0.0001,
              focusElapsedMs / Math.max(1, effectiveFocusAdvanceMs),
            );

      const phaseTotalMs = overviewMs + zoomInMs + focusCycleMs;
      const cycleCompleted = focusElapsedForCompletionMs >= focusCycleMs;
      const preFocusElapsedMs = Math.min(elapsed, overviewMs + zoomInMs);
      const phaseProgressElapsedMs =
        preFocusElapsedMs +
        (elapsed > overviewMs + zoomInMs ? focusElapsedForCompletionMs : 0);
      const holdAwareBrokenCompletion =
        phase.mode === "broken" && syncFocusToEditorial && focusNarrativeMs > 0;
      const brokenCompletionOverrunMs = holdAwareBrokenCompletion
        ? Math.max(90_000, Math.round(focusNarrativeMs * 0.8))
        : 0;
      const phaseHardStopMs = phaseTotalMs + brokenCompletionOverrunMs;
      const reachedPhaseEnd = cycleCompleted || elapsed >= phaseHardStopMs;
      stageProgressRatio = Math.max(
        0,
        Math.min(
          1,
          phaseProgressElapsedMs / Math.max(1, phaseTotalMs),
        ),
      );

      if (!paused && reachedPhaseEnd) {
        paused = true;
        if (isRecording4K) {
          const safeFocusIndex = Math.max(
            0,
            Math.min(traversal.length - 1, focusIndex),
          );
          const holdId =
            forcedFocusRecordId ||
            lockedAnchorRecordId ||
            traversal[safeFocusIndex] ||
            traversal[traversal.length - 1] ||
            "";
          if (holdId) {
            focusIndex = Math.max(0, traversal.indexOf(holdId));
            lockedAnchorRecordId = holdId;
            anchorHoldMsRemaining = 3_600_000;
            snapCameraToAnchor = true;
            if (phase.mode === "broken") {
              freezeBrokenOnDrawing = true;
              brokenCompletedIds.add(holdId);
              brokenLastCompletedId = holdId;
            }
          }
          if (!recordingFinalizing) {
            const t = performance.now();
            recordingFinalizing = true;
            recordingFinalizeHoldUntilMs = t + RECORD_FINAL_HOLD_MS;
            recordingBlackoutUntilMs =
              recordingFinalizeHoldUntilMs + RECORD_BLACKOUT_MS;
          }
        } else {
          resetPhaseProgress(now);
          return;
        }
      }

      if (focusIndex >= traversal.length) focusIndex = 0;
      let focusBaseIndex = focusIndex;
      let focusBlend = 0;
      let focusSequenceRawIndex = 0;
      let brokenFocusState = freezeBrokenOnDrawing ? "drawing" : "image";

      if (viewState === "zoom-in") {
        const zoomAnchorIndex = zoomAnchorRecordId
          ? traversal.indexOf(zoomAnchorRecordId)
          : -1;
        if (zoomAnchorIndex >= 0) {
          focusBaseIndex = zoomAnchorIndex;
          focusIndex = zoomAnchorIndex;
        } else {
          focusBaseIndex = 0;
          focusIndex = 0;
        }
      } else if (!paused && viewState === "broken-seq") {
        if (phase.mode === "broken" && anchorDrivenNoteMode && forcedFocusRecordId) {
          const forcedIndex = traversal.indexOf(forcedFocusRecordId);
          if (forcedIndex >= 0) {
            focusSequenceRawIndex = forcedIndex;
            focusBaseIndex = forcedIndex;
            focusIndex = forcedIndex;
            brokenLastCompletedId = null;
            brokenFocusState = freezeBrokenOnDrawing ? "drawing" : "image";
          }
        } else {
          const seqMs = Math.max(0, focusElapsedMs);
          const rawIndex = Math.floor(seqMs / brokenChainMs) % traversal.length;
          focusSequenceRawIndex = rawIndex;
          focusBaseIndex =
            (rawIndex + traversalOffset + traversal.length * 16) %
            traversal.length;
          if (seqMs >= brokenChainMs && traversal.length > 1) {
            brokenLastCompletedId =
              traversal[
                (focusBaseIndex - 1 + traversal.length) % traversal.length
              ];
          } else {
            brokenLastCompletedId = null;
          }
          const withinChain = seqMs % brokenChainMs;
          const stepIndex = Math.min(
            2,
            Math.floor((withinChain / brokenChainMs) * 3),
          );
          brokenFocusState = ["image", "text", "drawing"][stepIndex];
          focusIndex = focusBaseIndex;
        }
      } else if (
        !paused &&
        viewState === "focus" &&
        effectiveFocusAdvanceMs > 0
      ) {
        brokenLastCompletedId = null;
        const rawIndex = Math.floor(autoplayProgress) % traversal.length;
        focusSequenceRawIndex = rawIndex;
        focusBaseIndex =
          (rawIndex + traversalOffset + traversal.length * 16) %
          traversal.length;
        const atLastTraversalItem = rawIndex >= traversal.length - 1;
        if (atLastTraversalItem) {
          // Prevent wrap-around drift from last card back to first card.
          focusBlend = 0;
        } else {
          const localProgress = autoplayProgress - Math.floor(autoplayProgress);
          const holdRatio = 0.54;
          const holdHalf = holdRatio / 2;
          if (localProgress <= holdHalf) {
            focusBlend = 0;
          } else if (localProgress >= 1 - holdHalf) {
            focusBlend = 1;
          } else {
            const moveT = (localProgress - holdHalf) / (1 - holdRatio);
            focusBlend = moveT;
          }
        }
        focusIndex = focusBaseIndex;
      } else if (viewState !== "broken-seq") {
        brokenLastCompletedId = null;
      }

      if (
        noteAnchorRecordId &&
        (viewState === "focus" ||
          viewState === "zoom-in" ||
          viewState === "broken-seq") &&
        !anchorDrivenNoteMode &&
        !recordingFinalizing
      ) {
        const anchorIndex = traversal.indexOf(noteAnchorRecordId);
        if (anchorIndex >= 0) {
          const len = traversal.length;
          traversalOffset = (anchorIndex + len * 16) % len;
          focusBaseIndex = anchorIndex;
          focusIndex = anchorIndex;
          focusBlend = 0;
          if (viewState === "zoom-in") {
            zoomAnchorRecordId = noteAnchorRecordId;
            snapCameraToAnchor = false;
          } else {
            lockedAnchorRecordId = noteAnchorRecordId;
            anchorHoldMsRemaining = Math.max(0, Math.round(noteAnchorHoldMs));
            snapCameraToAnchor = true;
          }
          if (viewState === "broken-seq") {
            brokenFocusState = freezeBrokenOnDrawing ? "drawing" : "image";
            if (!freezeBrokenOnDrawing) brokenLastCompletedId = null;
          }
        }
        noteAnchorRecordId = "";
        noteAnchorHoldMs = 0;
      }

      if (
        lockedAnchorRecordId &&
        anchorHoldMsRemaining > 0 &&
        (viewState === "focus" || viewState === "broken-seq") &&
        viewState !== "zoom-in" &&
        !recordingFinalizing
      ) {
        const lockedIndex = traversal.indexOf(lockedAnchorRecordId);
        if (lockedIndex >= 0) {
          focusBaseIndex = lockedIndex;
          focusIndex = lockedIndex;
          focusBlend = 0;
          if (viewState === "broken-seq") {
            brokenFocusState = freezeBrokenOnDrawing ? "drawing" : "image";
            if (!freezeBrokenOnDrawing) brokenLastCompletedId = null;
          }
        } else {
          lockedAnchorRecordId = "";
          anchorHoldMsRemaining = 0;
        }
      }

      if (forcedFocusRecordId) {
        const forcedIndex = traversal.indexOf(forcedFocusRecordId);
        if (forcedIndex >= 0) {
          if (viewState === "focus" && traversal.length > 0) {
            traversalOffset =
              (forcedIndex - focusSequenceRawIndex + traversal.length * 16) %
              traversal.length;
          }
          focusBaseIndex = forcedIndex;
          focusIndex = forcedIndex;
          focusBlend = 0;
          if (viewState === "zoom-in") zoomAnchorRecordId = forcedFocusRecordId;
        }
      }

      const focusId = traversal[focusBaseIndex];
      const nextFocusId = traversal[(focusBaseIndex + 1) % traversal.length];
      const renderedFocusId =
        viewState === "focus" && focusBlend >= 0.999 ? nextFocusId : focusId;
      const focusRecord = byId.get(focusId) || ordered[0];
      const nextFocusRecord = byId.get(nextFocusId) || focusRecord;
      const focusEntry = layout.map.get(focusRecord.id) || {
        x: 0,
        y: 0,
        w: 200,
        h: 200,
      };
      const nextFocusEntry = layout.map.get(nextFocusRecord.id) || focusEntry;
      const focusStepForNotes =
        phase.mode === "broken" ? brokenFocusState : "any";

      const fitScale = Math.min(
        stageSize / layout.worldWidth,
        stageSize / layout.worldHeight,
      );
      const blendedFocusW =
        focusEntry.w +
        (nextFocusEntry.w - focusEntry.w) *
          (viewState === "focus" ? focusBlend : 0);
      const blendedFocusH =
        focusEntry.h +
        (nextFocusEntry.h - focusEntry.h) *
          (viewState === "focus" ? focusBlend : 0);
      const minFocusFactor = 1 / Math.max(0.35, 1 - focusPaddingRatio);
      const minFocusScale = fitScale * minFocusFactor;
      const rawFocusScale =
        type === "text"
          ? (stageSize * (1 - focusPaddingRatio)) / Math.max(focusEntry.w, 1)
          : Math.min(
              (stageSize * (1 - focusPaddingRatio)) /
                Math.max(blendedFocusW, 1),
              (stageSize * (1 - focusPaddingRatio)) /
                Math.max(blendedFocusH, 1),
            );
      const focusScale = Math.max(minFocusScale, rawFocusScale);

      const driftX =
        viewState === "focus" && !paused
          ? focusEntry.x + (nextFocusEntry.x - focusEntry.x) * focusBlend
          : focusEntry.x;
      const driftY =
        viewState === "focus" && !paused
          ? focusEntry.y + (nextFocusEntry.y - focusEntry.y) * focusBlend
          : focusEntry.y;

      const target = {
        x: viewState === "grid" ? 0 : driftX,
        y: viewState === "grid" ? 0 : driftY,
        scale: viewState === "grid" ? fitScale * 0.94 : focusScale,
      };

      if (viewState === "zoom-in" && zoomInMs > 0 && zoomStartCamera) {
        const zoomProgress = Math.max(
          0,
          Math.min(1, (elapsed - overviewMs) / zoomInMs),
        );
        camera.initialized = true;
        camera.x =
          zoomStartCamera.x + (target.x - zoomStartCamera.x) * zoomProgress;
        camera.y =
          zoomStartCamera.y + (target.y - zoomStartCamera.y) * zoomProgress;
        camera.scale =
          zoomStartCamera.scale +
          (target.scale - zoomStartCamera.scale) * zoomProgress;
        camera.toX = target.x;
        camera.toY = target.y;
        camera.toScale = target.scale;
        camera.lastMs = now;
      } else if (snapCameraToAnchor) {
        camera.initialized = true;
        camera.x = target.x;
        camera.y = target.y;
        camera.scale = target.scale;
        camera.toX = target.x;
        camera.toY = target.y;
        camera.toScale = target.scale;
        camera.lastMs = now;
        snapCameraToAnchor = false;
      } else {
        setCameraTarget(target, now);
        const cameraFollowMs =
          forcedFocusRecordId && viewState === "focus"
            ? Math.max(2200, effectiveFocusAdvanceMs * 3.2)
            : phase.mode === "broken" &&
                viewState === "broken-seq" &&
                anchorDrivenNoteMode
              ? Math.max(900, Math.min(2200, effectiveFocusAdvanceMs * 0.28))
            : effectiveFocusAdvanceMs;
        tickCamera(now, viewState, cameraFollowMs);
      }

      // In anchored broken mode, do not advance image->text->drawing until
      // camera is actually settled on the target card.
      if (
        phase.mode === "broken" &&
        viewState === "broken-seq" &&
        anchorDrivenNoteMode &&
        preTimelineInfo.index >= 0 &&
        preTimelineNote &&
        !freezeBrokenOnDrawing
      ) {
        const anchoredNoteId = preTimelineNote.id || "";
        const noteText = (preTimelineNote.text || "").trim();
        if (brokenFocusHoldNoteId !== anchoredNoteId) {
          brokenFocusHoldNoteId = anchoredNoteId;
        }
        if (brokenAnchorSettledNoteId !== anchoredNoteId) {
          brokenAnchorSettledNoteId = anchoredNoteId;
          brokenAnchorSettledAtSec = -1;
        }
        const pxDist =
          Math.hypot(camera.x - target.x, camera.y - target.y) *
          Math.max(camera.scale, 0.0001);
        const scaleDist = Math.abs(camera.scale - target.scale);
        const arrived = pxDist <= 90 && scaleDist <= 0.07;

        // Freeze note-clock while camera is still traveling to anchor.
        if (!arrived && !paused) {
          brokenFocusHoldOffsetSec -= frameDeltaMs / 1000;
        }

        if (!noteText) {
          brokenFocusState = "drawing";
        } else if (brokenAnchorSettledAtSec < 0) {
          if (arrived) brokenAnchorSettledAtSec = preElapsedInNoteSec;
          brokenFocusState = "image";
        } else {
          const elapsedAfterSettle = Math.max(
            0,
            preElapsedInNoteSec - brokenAnchorSettledAtSec,
          );
          const remainingAfterSettle = Math.max(
            0.001,
            preActiveNoteDurSec - brokenAnchorSettledAtSec,
          );
          const imageHoldSec = Math.max(
            0.4,
            Math.min(0.9, remainingAfterSettle * 0.1),
          );
          const drawingReserveSec = Math.max(
            1.8,
            remainingAfterSettle * 0.34,
          );
          const textEndSec = Math.max(
            imageHoldSec + 1.6,
            remainingAfterSettle - drawingReserveSec,
          );
          if (elapsedAfterSettle < imageHoldSec) brokenFocusState = "image";
          else if (elapsedAfterSettle < textEndSec) brokenFocusState = "text";
          else brokenFocusState = "drawing";
        }
      } else {
        brokenAnchorSettledNoteId = "";
        brokenAnchorSettledAtSec = 0;
        brokenFocusHoldNoteId = "";
        if (phase.mode !== "broken" || viewState !== "broken-seq") {
          brokenFocusHoldOffsetSec = 0;
        }
      }

      if (viewState === "broken-seq" && brokenFocusState === "drawing") {
        const activeBrokenId = traversal[focusBaseIndex];
        if (activeBrokenId) brokenCompletedIds.add(activeBrokenId);
      }

      s.push();
      s.drawingContext.save();
      s.drawingContext.beginPath();
      s.drawingContext.rect(stageX, stageY, stageSize, stageSize);
      s.drawingContext.clip();

      s.translate(
        stageX + stageSize / 2 - camera.x * camera.scale,
        stageY + stageSize / 2 - camera.y * camera.scale,
      );
      s.scale(camera.scale);

      const halfVisible = stageSize / (2 * camera.scale);
      const minX = camera.x - halfVisible - layout.maxW;
      const maxX = camera.x + halfVisible + layout.maxW;
      const minY = camera.y - halfVisible - layout.maxH;
      const maxY = camera.y + halfVisible + layout.maxH;

      for (let i = 0; i < ordered.length; i += 1) {
        const record = ordered[i];
        const entry = layout.map.get(record.id);
        if (!entry) continue;
        if (
          entry.x < minX ||
          entry.x > maxX ||
          entry.y < minY ||
          entry.y > maxY
        )
          continue;

        if (type === "image") {
          const inFocusedMode =
            viewState === "focus" || viewState === "zoom-in";
          const focused = inFocusedMode ? record.id === renderedFocusId : false;
          const alpha = inFocusedMode && !focused ? 0.2 : 1;
          const desaturate = !focused;
          drawImage(record.imageUrl, entry, alpha, desaturate);
          drawCardMeta(record, entry, alpha);
        } else if (type === "text") {
          const inFocusedMode =
            viewState === "focus" || viewState === "zoom-in";
          const focused = inFocusedMode ? record.id === renderedFocusId : false;
          const alpha = inFocusedMode && !focused ? 0.86 : 1;
          const textColor =
            inFocusedMode && !focused ? [0, 0, 56] : [0, 0, 100];
          drawText(
            record.text,
            entry,
            false,
            alpha,
            "center",
            OPINIONS_TEXT_STYLE.sizeScale,
            OPINIONS_TEXT_STYLE.excerpt,
            OPINIONS_TEXT_STYLE.leadingRatio,
            textColor,
          );
          drawCardMeta(record, entry, inFocusedMode && !focused ? 0.52 : alpha);
        } else if (viewState === "broken-seq") {
          const focused = record.id === focusId;
          const completed = brokenCompletedIds.has(record.id);
          if (focused) {
            drawBrokenState(record, entry, brokenFocusState, 1, false);
            drawCardMeta(
              brokenMetaForState(record, brokenFocusState),
              entry,
              1,
            );
          } else if (completed) {
            const isLatestCompleted = record.id === brokenLastCompletedId;
            drawBrokenState(
              record,
              entry,
              "drawing",
              isLatestCompleted ? 0.26 : 0.2,
              true,
            );
            drawCardMeta(
              brokenMetaForState(record, "drawing"),
              entry,
              isLatestCompleted ? 0.38 : 0.3,
            );
          } else {
            drawBrokenState(record, entry, "image", 0.16, true);
            drawCardMeta(brokenMetaForState(record, "image"), entry, 0.24);
          }
        } else {
          drawBrokenState(record, entry, "image", 1, true);
          drawCardMeta(brokenMetaForState(record, "image"), entry, 1);
        }
      }

      s.drawingContext.restore();
      s.pop();

      const noteViewState =
        viewState === "zoom-in"
          ? phase.mode === "broken"
            ? "broken-seq"
            : "focus"
          : viewState;
      const viewElapsedSec =
        viewState === "grid"
          ? elapsed / 1000
          : viewState === "zoom-in"
            ? 0
            : focusElapsedMs / 1000;
      const timeline = editorialTimelineFor(phase.id, noteViewState);
      const baseElapsedSec =
        timeline.elapsedMode === "view" ? viewElapsedSec : elapsed / 1000;

      let noteStateForResolve = noteViewState;
      let timelineForResolve = timeline;
      let phaseElapsedForResolve = elapsed / 1000;
      let viewElapsedForResolve = viewElapsedSec;
      let baseElapsedForResolve = baseElapsedSec;

      if (
        noteSkimSeen !== noteSkimToken &&
        timeline.notes.length &&
        timeline.key
      ) {
        const direction = noteSkimDirection >= 0 ? 1 : -1;
        const currentOffset = noteSkimOffsetByTimeline.get(timeline.key) || 0;
        const effectiveElapsed = Math.max(0, baseElapsedSec + currentOffset);
        const current = noteIndexAtElapsed(timeline.notes, effectiveElapsed, {
          loop: timeline.loop,
          restartPauseSec: timeline.restartPauseSec,
        });

        const canStepInsideCurrent =
          (current.index >= 0 &&
            current.index + direction >= 0 &&
            current.index + direction < timeline.notes.length) ||
          (current.index < 0 && current.inPause && direction < 0);

        if (canStepInsideCurrent) {
          const targetIndex =
            current.index >= 0
              ? current.index + direction
              : timeline.notes.length - 1;
          const targetStartSec = noteStartSec(timeline.notes, targetIndex);
          noteSkimOffsetByTimeline.set(
            timeline.key,
            targetStartSec - baseElapsedSec,
          );
        } else {
          const descriptors = chapterSkimDescriptors(phase.id, phase.mode);
          const descriptorIndex = descriptors.findIndex(
            (item) => item.viewState === noteViewState,
          );
          if (descriptors.length > 1 && descriptorIndex >= 0) {
            const targetDescriptor =
              descriptors[
                (descriptorIndex + direction + descriptors.length * 8) %
                  descriptors.length
              ];

            resetPhaseProgress(now);
            const targetOverviewMs = phaseSectionDurationMs(
              phase.id,
              "grid",
              phase.overviewMs || 0,
            );
            phaseElapsedMs =
              targetDescriptor.viewState === "grid" ? 0 : targetOverviewMs;
            if (targetDescriptor.viewState === "grid") {
              skimZoomRunMs = 0;
            } else {
              skimZoomRunMs = Math.max(800, phase.zoomInMs || 0);
            }
            lastFrameMs = now;

            noteStateForResolve = targetDescriptor.viewState;
            timelineForResolve = editorialTimelineFor(
              phase.id,
              noteStateForResolve,
            );
            phaseElapsedForResolve = phaseElapsedMs / 1000;
            viewElapsedForResolve = noteStateForResolve === "grid" ? 0 : 0;
            baseElapsedForResolve =
              timelineForResolve.elapsedMode === "view"
                ? viewElapsedForResolve
                : phaseElapsedForResolve;

            const targetNoteIndex =
              direction > 0 ? 0 : targetDescriptor.notes.length - 1;
            const targetStartSec = noteStartSec(
              targetDescriptor.notes,
              targetNoteIndex,
            );
            if (timelineForResolve.key) {
              noteSkimOffsetByTimeline.set(
                timelineForResolve.key,
                targetStartSec - baseElapsedForResolve,
              );
            }
          } else {
            const targetIndex = direction > 0 ? 0 : timeline.notes.length - 1;
            const targetStartSec = noteStartSec(timeline.notes, targetIndex);
            noteSkimOffsetByTimeline.set(
              timeline.key,
              targetStartSec - baseElapsedSec,
            );
          }
        }
      }
      noteSkimSeen = noteSkimToken;

      const elapsedOffset =
        noteSkimOffsetByTimeline.get(timelineForResolve.key) || 0;
      const brokenHoldOffsetForResolve =
        phase.mode === "broken" && noteStateForResolve === "broken-seq"
          ? brokenFocusHoldOffsetSec
          : 0;
      const effectiveElapsedSec = Math.max(
        0,
        baseElapsedForResolve + elapsedOffset + brokenHoldOffsetForResolve,
      );
      const phaseElapsedForNote =
        timelineForResolve.elapsedMode === "phase"
          ? effectiveElapsedSec
          : phaseElapsedForResolve;
      const viewElapsedForNote =
        timelineForResolve.elapsedMode === "view"
          ? effectiveElapsedSec
          : viewElapsedForResolve;
      const activeNote = resolveActiveNote(
        phase.id,
        phaseElapsedForNote,
        noteStateForResolve,
        {
          id: renderedFocusId,
          step: focusStepForNotes,
        },
        viewElapsedForNote,
      );
      const rawEditorialText = activeNote?.text || "";
      activeNoteIdForVoiceover = activeNote?.id || "";
      if (anchorDrivenNoteMode) {
        noteAnchorRecordId = "";
        noteAnchorHoldMs = 0;
        lastResolvedNoteId = "";
      } else {
        const activeNoteId = activeNote?.id || "";
        if (activeNoteId !== lastResolvedNoteId) {
          const nextAnchorRecordId = resolveNoteAnchorRecordId(
            activeNote,
            ordered,
          );
          if (nextAnchorRecordId) {
            noteAnchorRecordId = nextAnchorRecordId;
            noteAnchorHoldMs = Math.max(
              0,
              Math.round(noteDurSec(activeNote) * 1000),
            );
          }
          lastResolvedNoteId = activeNoteId;
        }
      }
      activeEditorialText = stripInlineImageIds(rawEditorialText);
      activeIntroText = introForPhase(phase.id);

      phaseLabelForUi = `${phase.label} - ${noteStateForResolve}`;
    };
  };
</script>

{#if P5}
  <article bind:clientWidth={width} bind:clientHeight={height}>
    <CablesOverlay
      {activeIntroText}
      {activeEditorialText}
      {stageCenterXPx}
      {stageTitleYPx}
      {stageSizePx}
      {stageSubtitleYPx}
      {editorialWidthPx}
    />

    <section
      class="stageFrame"
      style={`left:${stageLeftPx}px; top:${stageTopPx}px; width:${stageSizePx}px; height:${stageSizePx}px;`}
    />

    <section
      class="stageProgress"
      style={`left:${stageLeftPx}px; top:${stageTopPx}px; width:${stageSizePx}px; height:${stageSizePx}px;`}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={stageProgressPath} fill="none" class="stageProgressLine" />
      </svg>
    </section>

    <CablesControls
      {phaseLabelForUi}
      {paused}
      {syncFocusToEditorial}
      {isRecording4K}
      {recordingError}
      {focusPaddingRatio}
      {voiceoverEnabled}
      {voiceoverSupported}
      {voiceoverError}
      {voiceoverVoiceNames}
      {voiceoverVoiceName}
      {voiceoverRate}
      on:togglePause={() => (paused = !paused)}
      on:nextStory={nextStory}
      on:prevText={prevText}
      on:nextText={nextText}
      on:toggleSyncFocus={() => (syncFocusToEditorial = !syncFocusToEditorial)}
      on:toggleRecording={toggle4KRecording}
      on:toggleVoiceover={toggleVoiceoverPreview}
      on:voiceoverVoiceChange={(event) => setVoiceoverVoice(event.detail)}
      on:voiceoverRateChange={(event) => setVoiceoverRate(event.detail)}
      on:focusPaddingChange={(event) => {
        const next = Number(event.detail);
        if (Number.isFinite(next)) focusPaddingRatio = next;
      }}
    />

    <svelte:component this={P5} {sketch} />
  </article>
{:else}
  <article>Loading...</article>
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #000;
  }

  article {
    min-height: 100vh;
    position: relative;
    color: #d7dfd8;
    font-family: "terminal-grotesque", sans-serif;
    overflow: hidden;
  }

  :global(canvas) {
    position: fixed;
    inset: 0;
    display: block;
  }

  .stageFrame {
    position: fixed;
    box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, 0.1);
    pointer-events: none;
    z-index: 11;
  }

  .stageProgress {
    position: fixed;
    pointer-events: none;
    z-index: 12;
  }

  .stageProgressLine {
    stroke: rgba(255, 249, 210, 1);
    stroke: #838B85;
    stroke-width: 10;
    vector-effect: non-scaling-stroke;
  }
</style>
