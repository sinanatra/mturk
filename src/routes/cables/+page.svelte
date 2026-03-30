<script>
  import { tsv } from "d3";
  import { onDestroy, onMount } from "svelte";
  import { browser } from "$app/environment";
  import { base } from "$app/paths";
  import CablesOverlay from "./components/CablesOverlay.svelte";
  import CablesControls from "./components/CablesControls.svelte";
  import {
    OPINIONS_TEXT_STYLE,
    TIMELINE,
    VIEWS_PALETTE,
    buildColumnSnakeTraversal,
    buildMasonryLayout,
    collectEditorialVisualImageUrls,
    emptyLayout,
    estimateOpinionCardHeight,
    imageAspectFromMeta,
    isTypingElementFocused,
    mapById,
    normalizeNote,
    normalizeRecord,
    noteDurSec,
    noteIndexAtElapsed,
    noteStartSec,
    resolveNoteAnchorRecordId,
    stripInlineImageIds,
    sortRecords,
  } from "./lib/cables-utils";
  import {
    buildStageProgressPath,
    drawRecordingOverlayText,
    drawRecordingStageProgress,
    getRecordingOverlayMetrics,
  } from "./lib/cables-recording-utils";
  import {
    chapterSkimDescriptors,
    chapterMetaForPhase,
    editorialTimelineFor,
    legendDescriptionForPhase,
    parseEditorialPayload,
    phaseSectionDurationMs,
    resolveActiveNote,
  } from "./lib/cables-story-utils";
  import {
    createSketchRenderers,
    setCameraTarget,
    tickCamera,
  } from "./lib/cables-sketch-renderers";
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
  let recordingRestartToken = 0;
  let recordingResetPending = false;

  let phaseLabelForUi = "Windows Atlas";
  let activeChapterStep = "";
  let activeChapterTitle = "";
  let activeChapterDescription = "";
  let activeEditorialText = "";
  let stageSizePx = 0;
  let stageLeftPx = 0;
  let stageTopPx = 0;
  let stageTitleYPx = 0;
  let editorialWidthPx = 0;
  let stageCenterXPx = 0;
  let stageSubtitleYPx = 0;
  let stageProgressRatio = 0;
  let stageProgressPath = "M 0 0";

  let editorialNotes = [];
  let editorialVisualImageUrls = [];
  let chapterTitleWindows = "";
  let chapterTitleScreens = "";
  let chapterTitleOpinions = "";
  let chapterTitleBroken = "";
  let chapterTitleWorkerAttempt = "";

  const RECORD_SIZE_PX = 1920; //3840;
  const RECORD_FPS = 30;
  const RECORD_FINAL_HOLD_MS = 180;
  const RECORD_BLACKOUT_MS = 3000;
  const RECORD_CHAPTER_END_HOLD_MS = Math.max(
    80,
    Math.round((1000 / RECORD_FPS) * 3),
  );
  const GRID_FADE_MULTIPLIER = 200;
  const GRID_REVEAL_SPEED_MULTIPLIER = 3;
  const FOCUS_PADDING_RATIO = 0.5;
  const NOTE_ZOOMOUT_LEAD_SEC = 2.8;
  const SHARED_CHAPTER_LEGEND_TEXT = "Who is working for Amazon Mechanical Turk?";

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

  let authoringHint = "";
  let syncFocusToEditorial = true;

  function stopRecordingStream() {
    if (recordingRaf) {
      cancelAnimationFrame(recordingRaf);
      recordingRaf = 0;
    }
    if (recordingStream) {
      try {
        recordingStream.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore teardown errors from ended/invalid tracks.
      }
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

  function abortRecording(message = "Recording failed.", { save = false } = {}) {
    recordingError = message;
    saveRecordingOnStop = save;
    isRecording4K = false;
    recordingResetPending = false;
    recordingFinalizing = false;
    recordingFinalizeHoldUntilMs = 0;
    recordingBlackoutUntilMs = 0;
    freezeBrokenOnDrawing = false;

    const recorder = recordingMediaRecorder;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
        return;
      } catch {
        // Fall through to stream teardown.
      }
    }
    stopRecordingStream();
  }


  function drawRecordingFrame() {
    if (!isRecording4K || !recordingCtx || !recordingCanvas || !p5CanvasEl)
      return;
    if (recordingResetPending) {
      recordingRaf = requestAnimationFrame(drawRecordingFrame);
      return;
    }

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

    try {
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
        browser,
        stageSizePx,
        recordSizePx: RECORD_SIZE_PX,
        textSelector: ".chapterLegendDesc",
        boxSelector: ".chapterLegend",
        fallbackFontPx: RECORD_SIZE_PX * 0.02,
        fallbackLineHeight: RECORD_SIZE_PX * 0.023,
        fallbackWidthPx: RECORD_SIZE_PX * 0.78,
      });
      const editorialMetrics = getRecordingOverlayMetrics({
        browser,
        stageSizePx,
        recordSizePx: RECORD_SIZE_PX,
        textSelector: ".editorialText",
        boxSelector: ".editorialTape",
        fallbackFontPx: RECORD_SIZE_PX * 0.019,
        fallbackLineHeight: RECORD_SIZE_PX * 0.023,
        fallbackWidthPx: RECORD_SIZE_PX * 0.78,
      });

      const legendHeader =
        activeChapterStep && activeChapterTitle
          ? `${activeChapterTitle} : ${activeChapterStep}`
          : activeChapterTitle || activeChapterStep || "";
      const legendText =
        activeChapterDescription && legendHeader
          ? `${activeChapterDescription}\n${legendHeader}`
          : activeChapterDescription || legendHeader;

      drawRecordingOverlayText(recordingCtx, legendText, {
        centerX: RECORD_SIZE_PX / 2,
        anchorY: introY,
        width: introMetrics.widthPx,
        fontPx: introMetrics.fontPx,
        lineHeight: introMetrics.lineHeight,
        anchor: "top",
        textColor: "#FFFFFF",
        secondaryTextColor: "rgba(255,255,255,0.68)",
        secondaryTextColorFromLine: 1,
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
    } catch {
      abortRecording("Recording crashed in this browser.", { save: false });
      return;
    }

    recordingRaf = requestAnimationFrame(drawRecordingFrame);
  }

  function stop4KRecording({ save = true } = {}) {
    if (!recordingMediaRecorder) {
      isRecording4K = false;
      recordingResetPending = false;
      stopRecordingStream();
      return;
    }
    saveRecordingOnStop = save;
    isRecording4K = false;
    recordingResetPending = false;
    recordingFinalizing = false;
    recordingFinalizeHoldUntilMs = 0;
    recordingBlackoutUntilMs = 0;
    freezeBrokenOnDrawing = false;
    try {
      if (recordingMediaRecorder.state !== "inactive") {
        recordingMediaRecorder.stop();
      } else {
        stopRecordingStream();
      }
    } catch {
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
    const ua = navigator?.userAgent || "";
    const isSafari =
      /safari/i.test(ua) &&
      !/chrome|chromium|android|crios|fxios|edg/i.test(ua);
    if (isSafari) {
      recordingError =
        "Recording is unstable in Safari. Please use Chrome/Edge.";
      return;
    }
    if (isRecording4K) return;

    paused = false;
    recordingResetPending = true;
    recordingRestartToken += 1;

    recordingCanvas = document.createElement("canvas");
    recordingCanvas.width = RECORD_SIZE_PX;
    recordingCanvas.height = RECORD_SIZE_PX;
    recordingCtx = recordingCanvas.getContext("2d", { alpha: false });
    if (!recordingCtx) {
      recordingError = "Could not initialize recording context.";
      return;
    }

    let stream = null;
    let streamTrack = null;
    try {
      stream = recordingCanvas.captureStream(RECORD_FPS);
      streamTrack = stream?.getVideoTracks?.()[0] || null;
    } catch {
      recordingError = "Recording stream is not supported in this browser.";
      stopRecordingStream();
      return;
    }
    if (!stream || !streamTrack) {
      recordingError = "Recording stream is not available.";
      stopRecordingStream();
      return;
    }
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
        mimeType ? { mimeType, videoBitsPerSecond: 12_000_000 } : undefined,
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
      try {
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
      } catch {
        recordingError = "Recording stopped, but export failed.";
      } finally {
        recordingChunks = [];
        stopRecordingStream();
        isRecording4K = false;
      }
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
    const beginCaptureAfterReset = () => {
      if (!isRecording4K || !recordingMediaRecorder) return;
      if (recordingResetPending) {
        requestAnimationFrame(beginCaptureAfterReset);
        return;
      }
      drawRecordingFrame();
      try {
        recordingMediaRecorder.start(1000);
      } catch {
        abortRecording("Could not start the recorder stream.", { save: false });
      }
    };
    beginCaptureAfterReset();
  }

  function toggle4KRecording() {
    if (isRecording4K) {
      stop4KRecording();
      return;
    }
    start4KRecording();
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
      (item) => imageAspectFromMeta(imageMeta, item.imageUrl),
      windowsCols,
      baseW,
      0,
    );
    screensLayout = buildMasonryLayout(
      screensItems,
      (item) => imageAspectFromMeta(imageMeta, item.imageUrl),
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
        imageAspectFromMeta(
          imageMeta,
          chain.image?.imageUrl || chain.drawing?.imageUrl || "",
        ),
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
    stageTitleYPx = stageTopPx + 8;
    stageCenterXPx = stageLeftPx + stageSizePx / 2;
    stageSubtitleYPx = stageTopPx + stageSizePx - 8;
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

    (async () => {
      const mod = await import("p5-svelte");
      P5 = mod.default;
      rows = await tsv("/cables.tsv");
      const editorial = await fetch("/cables_editorial.json")
        .then((res) => res.json())
        .catch(() => null);
      const parsed = parseEditorialPayload(editorial, normalizeNote);
      editorialNotes = parsed.notes;
      editorialVisualImageUrls = collectEditorialVisualImageUrls(editorialNotes);
      chapterTitleWindows = parsed.chapterTitles.windows;
      chapterTitleScreens = parsed.chapterTitles.screens;
      chapterTitleOpinions = parsed.chapterTitles.opinions;
      chapterTitleBroken = parsed.chapterTitles.broken;
      chapterTitleWorkerAttempt = parsed.chapterTitles["worker-attempt"] || "";
    })();
  });

  onDestroy(() => {
    if (isRecording4K) stop4KRecording({ save: false });
    stopRecordingStream();
  });

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
    let recordingRestartSeen = recordingRestartToken;
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
    let zoomToSettledNoteId = "";
    let zoomToReleasingNoteId = "";
    let zoomToReleasedNoteId = "";
    let zoomToHoldOffsetSec = 0;
    let font;
    let phasePreloadCursor = 0;
    let editorialPreloadCursor = 0;
    const PRELOAD_BATCH_SIZE = 28;
    const visualState = {
      lastVisualNoteId: "",
      lastVisualSignature: "",
    };

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
      visualState.lastVisualNoteId = "";
      visualState.lastVisualSignature = "";
      zoomToSettledNoteId = "";
      zoomToReleasingNoteId = "";
      zoomToReleasedNoteId = "";
      zoomToHoldOffsetSec = 0;
      phasePreloadCursor = 0;
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
      if (phase.mode === "conclusion") {
        return {
          ordered: [],
          byId: new Map(),
          layout: emptyLayout(),
          traversal: [],
          type: "conclusion",
        };
      }
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

    function preloadPhaseBatch(type, ordered) {
      if (!ordered.length) return;
      const batchCount = Math.min(PRELOAD_BATCH_SIZE, ordered.length);
      if (type === "image") {
        for (let i = 0; i < batchCount; i += 1) {
          const idx = (phasePreloadCursor + i) % ordered.length;
          const record = ordered[idx];
          if (record?.imageUrl) ensureImage(s, record.imageUrl);
        }
      } else if (type === "broken") {
        for (let i = 0; i < batchCount; i += 1) {
          const idx = (phasePreloadCursor + i) % ordered.length;
          const chain = ordered[idx];
          if (chain?.image?.imageUrl) ensureImage(s, chain.image.imageUrl);
          if (chain?.drawing?.imageUrl) ensureImage(s, chain.drawing.imageUrl);
        }
      }
      phasePreloadCursor = (phasePreloadCursor + batchCount) % ordered.length;
    }

    function preloadEditorialBatch() {
      if (!editorialVisualImageUrls.length) return;
      const batchCount = Math.min(PRELOAD_BATCH_SIZE, editorialVisualImageUrls.length);
      for (let i = 0; i < batchCount; i += 1) {
        const idx = (editorialPreloadCursor + i) % editorialVisualImageUrls.length;
        const imageUrl = editorialVisualImageUrls[idx];
        if (imageUrl) ensureImage(s, imageUrl);
      }
      editorialPreloadCursor =
        (editorialPreloadCursor + batchCount) % editorialVisualImageUrls.length;
    }

    const {
      drawImage,
      drawNoteVisual,
      drawCardMeta,
      drawText,
      drawBrokenState,
      brokenMetaForState,
    } = createSketchRenderers({
      s,
      ensureImage,
      visualState,
    });

    const setCameraTargetForSketch = (target, now) => {
      setCameraTarget(camera, target, now);
    };

    const tickCameraForSketch = (now, viewState = "focus", focusAdvanceMs = 9800) => {
      tickCamera(camera, now, viewState, focusAdvanceMs);
    };

    s.preload = () => {
      font = s.loadFont(
        `${base}/terminal-grotesque.woff`,
        () => {},
        () => {
          font = null;
          console.warn("[cables] font load failed, using fallback font");
        },
      );
    };

    s.setup = () => {
      const renderer = s.createCanvas(1, 1);
      p5CanvasEl = renderer?.elt || null;
      // s.pixelDensity(1);
      s.colorMode(s.HSL, 360, 100, 100, 1);
      s.rectMode(s.CENTER);
      s.imageMode(s.CORNER);
      if (font) s.textFont(font);
      s.frameRate(30);

      s.keyPressed = () => {
        if (isTypingElementFocused(browser)) return true;

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

        if (s.key === "c" || s.key === "C") {
          const stageSize = Math.min(s.width, s.height);
          const stageX = (s.width - stageSize) / 2;
          const stageY = (s.height - stageSize) / 2;
          if (
            s.mouseX < stageX ||
            s.mouseX > stageX + stageSize ||
            s.mouseY < stageY ||
            s.mouseY > stageY + stageSize
          ) {
            authoringHint = "Move cursor inside stage, then press C";
            return false;
          }
          if (!camera.initialized || !Number.isFinite(camera.scale) || camera.scale === 0) {
            authoringHint = "Camera not ready yet";
            return false;
          }

          const worldX = camera.x + (s.mouseX - (stageX + stageSize / 2)) / camera.scale;
          const worldY = camera.y + (s.mouseY - (stageY + stageSize / 2)) / camera.scale;
          const roundedX = Number(worldX.toFixed(2));
          const roundedY = Number(worldY.toFixed(2));
          const zoomSnippet = `"zoomTo": { "x": ${roundedX}, "y": ${roundedY} }`;

          const phase = activePhase();
          const { ordered, layout } = phaseCollection(phase);
          let nearestId = "";
          let nearestDist = Infinity;
          for (const record of ordered) {
            const entry = layout.map.get(record.id);
            if (!entry) continue;
            const dist = Math.hypot(entry.x - worldX, entry.y - worldY);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestId = record.id;
            }
          }

          const nearestSuffix = nearestId ? ` nearest=${nearestId}` : "";
          authoringHint = `${zoomSnippet}${nearestSuffix}`;
          if (browser && navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(zoomSnippet).catch(() => {});
          }
          console.info("[cables] zoom authoring", {
            x: roundedX,
            y: roundedY,
            nearestAnchorId: nearestId || null,
            snippet: zoomSnippet,
          });
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
      if (recordingRestartSeen !== recordingRestartToken) {
        resetPhaseProgress(now);
        camera.initialized = false;
        camera.x = 0;
        camera.y = 0;
        camera.scale = 1;
        camera.toX = 0;
        camera.toY = 0;
        camera.toScale = 1;
        camera.lastMs = now;
        storyTokenSeen = storyAdvanceToken;
        noteSkimSeen = noteSkimToken;
        recordingRestartSeen = recordingRestartToken;
        recordingResetPending = false;
      }
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
      const isConclusionPhase = phase.mode === "conclusion";
      if (!isConclusionPhase && (!ordered.length || !traversal.length)) {
        stageProgressRatio = 0;
        lastFrameMs = now;
        return;
      }
      if (!isConclusionPhase) preloadPhaseBatch(type, ordered);
      preloadEditorialBatch();

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

      if (isConclusionPhase) {
        const timeline = editorialTimelineFor(editorialNotes, phase.id, "grid");
        const timelineTotalSec = timeline.notes.length
          ? timeline.notes.reduce((sum, note) => sum + noteDurSec(note), 0)
          : 1;

        if (
          noteSkimSeen !== noteSkimToken &&
          timeline.notes.length &&
          timeline.key
        ) {
          const direction = noteSkimDirection >= 0 ? 1 : -1;
          const currentOffset = noteSkimOffsetByTimeline.get(timeline.key) || 0;
          const effectiveElapsed = Math.max(0, elapsed / 1000 + currentOffset);
          const current = noteIndexAtElapsed(timeline.notes, effectiveElapsed, {
            loop: false,
            restartPauseSec: 0,
          });
          const targetIndex = Math.max(
            0,
            Math.min(
              timeline.notes.length - 1,
              (current.index >= 0 ? current.index : 0) + direction,
            ),
          );
          const targetStartSec = noteStartSec(timeline.notes, targetIndex);
          noteSkimOffsetByTimeline.set(
            timeline.key,
            targetStartSec - elapsed / 1000,
          );
        }
        noteSkimSeen = noteSkimToken;

        const elapsedOffsetSec = timeline.key
          ? noteSkimOffsetByTimeline.get(timeline.key) || 0
          : 0;
        const effectiveElapsedSec = Math.max(0, elapsed / 1000 + elapsedOffsetSec);
        const timelineInfo = noteIndexAtElapsed(timeline.notes, effectiveElapsedSec, {
          loop: false,
          restartPauseSec: 0,
        });
        const activeConclusionNote =
          timelineInfo.index >= 0 ? timeline.notes[timelineInfo.index] : null;
        const activeConclusionNoteDurSec = activeConclusionNote
          ? noteDurSec(activeConclusionNote)
          : 0;
        const elapsedInConclusionNoteSec =
          timelineInfo.index >= 0
            ? Math.max(
                0,
                effectiveElapsedSec - noteStartSec(timeline.notes, timelineInfo.index),
              )
            : 0;

        s.push();
        s.rectMode(s.CORNER);
        s.noStroke();
        s.fill(0, 0, 0, 1);
        s.rect(stageX, stageY, stageSize, stageSize);
        drawNoteVisual(
          activeConclusionNote,
          elapsedInConclusionNoteSec,
          activeConclusionNoteDurSec,
          stageX,
          stageY,
          stageSize,
        );
        s.pop();

        stageProgressRatio = Math.max(
          0,
          Math.min(1, (effectiveElapsedSec * 1000) / Math.max(1, timelineTotalSec * 1000)),
        );
        const conclusionTotalMs = Math.max(1, Math.round(timelineTotalSec * 1000));
        const reachedConclusionEnd = effectiveElapsedSec * 1000 >= conclusionTotalMs;

        if (!paused && reachedConclusionEnd) {
          paused = true;
          if (isRecording4K) {
            if (!recordingFinalizing) {
              const t = performance.now();
              recordingFinalizing = true;
              recordingFinalizeHoldUntilMs = t + RECORD_FINAL_HOLD_MS;
              recordingBlackoutUntilMs = recordingFinalizeHoldUntilMs + RECORD_BLACKOUT_MS;
            }
          } else {
            resetPhaseProgress(now);
            return;
          }
        }

        const chapterMeta = chapterMetaForPhase(
          {
            windows: chapterTitleWindows,
            screens: chapterTitleScreens,
            opinions: chapterTitleOpinions,
            broken: chapterTitleBroken,
            "worker-attempt": chapterTitleWorkerAttempt,
          },
          phase.id,
        );
        activeChapterStep = chapterMeta.step;
        activeChapterTitle = chapterMeta.title;
        activeChapterDescription = "";
        activeEditorialText = stripInlineImageIds(activeConclusionNote?.text || "");
        phaseLabelForUi = `${phase.label} - slides`;
        return;
      }

      const overviewMs = phaseSectionDurationMs(editorialNotes, 
        phase.id,
        "grid",
        phase.overviewMs || 0,
      );
      const zoomInMs = Math.max(0, phase.zoomInMs || 0);
      const gridRevealStartMs = 0;
      const gridRevealMs = Math.max(1, overviewMs);

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
          const focusTimeline = editorialTimelineFor(editorialNotes, 
            phase.id,
            focusState,
          );
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
      const preTimeline = editorialTimelineFor(editorialNotes, 
        phase.id,
        preNoteViewState,
      );
      const preBaseElapsedSec =
        preTimeline.elapsedMode === "view" ? preViewElapsedSec : elapsed / 1000;
      const preElapsedOffset =
        noteSkimOffsetByTimeline.get(preTimeline.key) || 0;
      const preEffectiveElapsedSec = Math.max(
        0,
        preBaseElapsedSec + preElapsedOffset,
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
      const focusNarrativeMs = phaseSectionDurationMs(editorialNotes, 
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
      const brokenFocusHoldMs = 0;
      const focusElapsedForCompletionMs =
        phase.mode === "broken" && syncFocusToEditorial && focusNarrativeMs > 0
          ? Math.max(0, focusElapsedMs + brokenFocusHoldMs)
          : focusElapsedMs;
      const zoomToCompletionOffsetMs = 0;
      const focusElapsedForCompletionWithZoomMs = Math.max(
        0,
        focusElapsedForCompletionMs + zoomToCompletionOffsetMs,
      );
      const autoplayProgress =
        phase.mode === "broken"
          ? 0
          : Math.min(
              traversal.length - 0.0001,
              focusElapsedMs / Math.max(1, effectiveFocusAdvanceMs),
            );

      const phaseTotalMs = overviewMs + zoomInMs + focusCycleMs;
      const cycleCompleted = focusElapsedForCompletionWithZoomMs >= focusCycleMs;
      const preFocusElapsedMs = Math.min(elapsed, overviewMs + zoomInMs);
      const phaseProgressElapsedMs =
        preFocusElapsedMs +
        (elapsed > overviewMs + zoomInMs
          ? focusElapsedForCompletionWithZoomMs
          : 0);
      const phaseProgressMs = Math.max(0, Math.min(phaseTotalMs, phaseProgressElapsedMs));
      const reachedPhaseEnd = phaseProgressElapsedMs >= phaseTotalMs;
      stageProgressRatio = Math.max(
        0,
        Math.min(
          1,
          phaseProgressMs / Math.max(1, phaseTotalMs),
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
          // Give recorder a few frames on the final chapter frame so it does
          // not cut early, while still ending without blackout.
          if (!recordingFinalizing) {
            const t = performance.now();
            recordingFinalizing = true;
            recordingFinalizeHoldUntilMs = t + RECORD_CHAPTER_END_HOLD_MS;
            recordingBlackoutUntilMs = recordingFinalizeHoldUntilMs;
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
          focusBlend = localProgress;
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
        viewState === "focus" && !paused
          ? focusEntry.w + (nextFocusEntry.w - focusEntry.w) * focusBlend
          : focusEntry.w;
      const focusPaddingRatio =
        phase.mode === "broken" ? 0.08 : FOCUS_PADDING_RATIO;
      const minFocusFactor = 1 / Math.max(0.35, 1 - focusPaddingRatio);
      const minFocusScale = fitScale * minFocusFactor;
      const baseFocusScale =
        (stageSize * (1 - focusPaddingRatio)) / Math.max(blendedFocusW, 1);
      const noteZoomTo =
        anchorDrivenNoteMode &&
        preTimelineNote?.zoomTo &&
        typeof preTimelineNote.zoomTo === "object"
          ? preTimelineNote.zoomTo
          : null;
      const driftXBase =
        viewState === "focus" && !paused
          ? focusEntry.x + (nextFocusEntry.x - focusEntry.x) * focusBlend
          : focusEntry.x;
      const driftYBase =
        viewState === "focus" && !paused
          ? focusEntry.y + (nextFocusEntry.y - focusEntry.y) * focusBlend
          : focusEntry.y;
      const noteZoomKey =
        noteZoomTo && preTimelineNote?.id && focusRecord?.id
          ? `${preTimelineNote.id}|${focusRecord.id}`
          : "";
      const baseFocusScaleNoZoom = Math.max(minFocusScale, baseFocusScale);
      const noteRemainingSec = Math.max(0, preActiveNoteDurSec - preElapsedInNoteSec);

      if (!noteZoomTo || !noteZoomKey) {
        zoomToSettledNoteId = "";
        zoomToReleasingNoteId = "";
        zoomToReleasedNoteId = "";
      } else {
        if (zoomToReleasingNoteId && zoomToReleasingNoteId !== noteZoomKey) {
          zoomToReleasingNoteId = "";
        }
        if (zoomToReleasedNoteId && zoomToReleasedNoteId !== noteZoomKey) {
          zoomToReleasedNoteId = "";
        }
      }

      if (
        noteZoomTo &&
        noteZoomKey &&
        zoomToSettledNoteId !== noteZoomKey &&
        zoomToReleasingNoteId !== noteZoomKey &&
        zoomToReleasedNoteId !== noteZoomKey
      ) {
        const pxDistToBase =
          Math.hypot(camera.x - driftXBase, camera.y - driftYBase) *
          Math.max(camera.scale, 0.0001);
        const scaleDistToBase = Math.abs(camera.scale - baseFocusScaleNoZoom);
        const arrivedToBase = pxDistToBase <= 90 && scaleDistToBase <= 0.07;
        if (arrivedToBase && noteZoomKey) zoomToSettledNoteId = noteZoomKey;
      }
      const hasReleasedZoomTo =
        Boolean(noteZoomKey) && zoomToReleasedNoteId === noteZoomKey;
      let isReleasingZoomTo =
        Boolean(noteZoomKey) && zoomToReleasingNoteId === noteZoomKey;
      const isSettledZoomTo =
        Boolean(noteZoomKey) && zoomToSettledNoteId === noteZoomKey;
      if (
        noteZoomTo &&
        noteZoomKey &&
        isSettledZoomTo &&
        !isReleasingZoomTo &&
        !hasReleasedZoomTo &&
        noteRemainingSec <= NOTE_ZOOMOUT_LEAD_SEC
      ) {
        zoomToReleasingNoteId = noteZoomKey;
        isReleasingZoomTo = true;
      }
      const applyNoteZoom =
        Boolean(noteZoomTo) &&
        noteZoomKey &&
        isSettledZoomTo &&
        !isReleasingZoomTo &&
        !hasReleasedZoomTo;
      const noteZoomScaleRaw = Number(noteZoomTo?.scale);
      const noteZoomScale =
        Number.isFinite(noteZoomScaleRaw) && noteZoomScaleRaw > 0
          ? noteZoomScaleRaw
          : 1;
      const focusScale = Math.max(
        minFocusScale,
        baseFocusScale * (applyNoteZoom ? noteZoomScale : 1),
      );
      const noteZoomXRaw = Number(noteZoomTo?.x);
      const noteZoomYRaw = Number(noteZoomTo?.y);
      const driftX =
        applyNoteZoom && Number.isFinite(noteZoomXRaw) ? noteZoomXRaw : driftXBase;
      const driftY =
        applyNoteZoom && Number.isFinite(noteZoomYRaw) ? noteZoomYRaw : driftYBase;

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
        setCameraTargetForSketch(target, now);
        const cameraFollowMs =
          isReleasingZoomTo
            ? Math.min(effectiveFocusAdvanceMs, 1800)
            : forcedFocusRecordId && viewState === "focus"
              ? Math.max(2200, effectiveFocusAdvanceMs * 3.2)
              : phase.mode === "broken" &&
                  viewState === "broken-seq" &&
                  anchorDrivenNoteMode
                ? Math.max(900, Math.min(2200, effectiveFocusAdvanceMs * 0.28))
              : effectiveFocusAdvanceMs;
        tickCameraForSketch(now, viewState, cameraFollowMs);
      }

      if (isReleasingZoomTo && noteZoomKey) {
        const pxDistToBase =
          Math.hypot(camera.x - driftXBase, camera.y - driftYBase) *
          Math.max(camera.scale, 0.0001);
        const scaleDistToBase = Math.abs(camera.scale - baseFocusScaleNoZoom);
        const returnedToBase = pxDistToBase <= 90 && scaleDistToBase <= 0.07;
        if (!returnedToBase && !paused) {
          // keep timing deterministic; no clock offsets while camera recenters
        }
        if (returnedToBase) {
          zoomToReleasingNoteId = "";
          zoomToReleasedNoteId = noteZoomKey;
          zoomToSettledNoteId = "";
        }
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

        // keep timing deterministic; no note-clock freeze while camera travels
        if (!arrived && !paused) {
          // no-op
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

      const gridVisualState =
        viewState === "grid"
          ? drawNoteVisual(
              preTimelineNote,
              preElapsedInNoteSec,
              preActiveNoteDurSec,
              stageX,
              stageY,
              stageSize,
            )
          : { drawn: false, hideGrid: false };
      const showGridCards = !(
        viewState === "grid" &&
        gridVisualState.drawn &&
        gridVisualState.hideGrid
      );

      if (showGridCards) {
        const gridRevealProgressFromNotes = (notes, elapsedSec) => {
          if (!Array.isArray(notes) || !notes.length) return null;
          let totalVisibleSec = 0;
          let visibleElapsedSec = 0;
          let remaining = Math.max(0, elapsedSec);
          for (const note of notes) {
            const dur = noteDurSec(note);
            const visible = !(note?.visual && note.visual.hideGrid);
            if (visible) totalVisibleSec += dur;
            if (remaining <= 0) continue;
            const segment = Math.min(dur, remaining);
            if (visible) visibleElapsedSec += segment;
            remaining -= segment;
          }
          if (totalVisibleSec <= 0) return 0;
          return Math.max(0, Math.min(1, visibleElapsedSec / totalVisibleSec));
        };

        const noteDrivenReveal =
          viewState === "grid"
            ? gridRevealProgressFromNotes(
                preTimeline.notes,
                preEffectiveElapsedSec,
              )
            : null;
        const revealProgressRaw =
          viewState === "grid"
            ? noteDrivenReveal ??
              Math.max(
                0,
                Math.min(1, (elapsed - gridRevealStartMs) / gridRevealMs),
              )
            : 1;
        const revealProgress =
          viewState === "grid"
            ? Math.max(
                0,
                Math.min(1, revealProgressRaw * GRID_REVEAL_SPEED_MULTIPLIER),
              )
            : 1;
        const revealCount =
          viewState === "grid"
            ? Math.max(
                0,
                Math.min(
                  ordered.length,
                  Math.ceil(revealProgress * ordered.length),
                ),
              )
            : ordered.length;
        const revealOrder = traversal.length
          ? traversal
          : ordered.map((item) => item.id);
        const revealRank = new Map(
          revealOrder.map((id, index) => [id, index]),
        );
        const revealFloat = revealProgress * ordered.length;

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
          if (viewState === "grid") {
            const rank = revealRank.get(record.id);
            if (!Number.isFinite(rank) || rank >= revealCount) continue;
          }
          const revealRankValue = revealRank.get(record.id);
          const gridAppearAlpha =
            viewState === "grid" && Number.isFinite(revealRankValue)
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    (revealFloat - revealRankValue) * GRID_FADE_MULTIPLIER,
                  ),
                )
              : 1;

          if (type === "image") {
            const inFocusedMode =
              viewState === "focus" || viewState === "zoom-in";
            const focused = inFocusedMode ? record.id === renderedFocusId : false;
            const alpha = (inFocusedMode && !focused ? 0.2 : 1) * gridAppearAlpha;
            const desaturate = !focused;
            drawImage(record.imageUrl, entry, alpha, desaturate);
            drawCardMeta(record, entry, alpha);
          } else if (type === "text") {
            const inFocusedMode =
              viewState === "focus" || viewState === "zoom-in";
            const focused = inFocusedMode ? record.id === renderedFocusId : false;
            const alpha =
              (inFocusedMode && !focused ? 0.86 : 1) * gridAppearAlpha;
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
            drawCardMeta(
              record,
              entry,
              inFocusedMode && !focused ? 0.52 : alpha,
            );
          } else if (viewState === "broken-seq") {
            const focused = record.id === focusId;
            const completed = brokenCompletedIds.has(record.id);
            if (focused) {
              drawBrokenState(record, entry, "triptych", 1, false);
            } else if (completed) {
              const isLatestCompleted = record.id === brokenLastCompletedId;
              drawBrokenState(
                record,
                entry,
                "triptych",
                isLatestCompleted ? 0.26 : 0.2,
                true,
              );
            } else {
              drawBrokenState(record, entry, "triptych", 0.16, true);
            }
          } else {
            drawBrokenState(record, entry, "triptych", 1, true);
          }
        }

        s.drawingContext.restore();
        s.pop();
      }

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
      const timeline = editorialTimelineFor(editorialNotes, 
        phase.id,
        noteViewState,
      );
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
          const descriptors = chapterSkimDescriptors(editorialNotes, 
            phase.id,
            phase.mode,
          );
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
            const targetOverviewMs = phaseSectionDurationMs(editorialNotes, 
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
            timelineForResolve = editorialTimelineFor(editorialNotes, 
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
      const effectiveElapsedSec = Math.max(
        0,
        baseElapsedForResolve + elapsedOffset,
      );
      const skimAdjustedPhaseElapsedMs = Math.max(
        0,
        phaseElapsedForResolve * 1000 + elapsedOffset * 1000,
      );
      stageProgressRatio = Math.max(
        0,
        Math.min(
          1,
          skimAdjustedPhaseElapsedMs / Math.max(1, phaseTotalMs),
        ),
      );
      const phaseElapsedForNote =
        timelineForResolve.elapsedMode === "phase"
          ? effectiveElapsedSec
          : phaseElapsedForResolve;
      const viewElapsedForNote =
        timelineForResolve.elapsedMode === "view"
          ? effectiveElapsedSec
          : viewElapsedForResolve;
      const activeNote = resolveActiveNote(editorialNotes, 
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
      const chapterMeta = chapterMetaForPhase(
        {
          windows: chapterTitleWindows,
          screens: chapterTitleScreens,
          opinions: chapterTitleOpinions,
          broken: chapterTitleBroken,
          "worker-attempt": chapterTitleWorkerAttempt,
        },
        phase.id,
      );
      activeChapterStep = chapterMeta.step;
      activeChapterTitle = chapterMeta.title;
      activeChapterDescription = legendDescriptionForPhase(SHARED_CHAPTER_LEGEND_TEXT);
      activeEditorialText = stripInlineImageIds(rawEditorialText);

      phaseLabelForUi = `${phase.label} - ${noteStateForResolve}`;
    };
  };
</script>

{#if P5}
  <article bind:clientWidth={width} bind:clientHeight={height}>
    <CablesOverlay
      {activeChapterStep}
      {activeChapterTitle}
      {activeChapterDescription}
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
      {authoringHint}
      on:togglePause={() => (paused = !paused)}
      on:nextStory={nextStory}
      on:prevText={prevText}
      on:nextText={nextText}
      on:toggleSyncFocus={() => (syncFocusToEditorial = !syncFocusToEditorial)}
      on:toggleRecording={toggle4KRecording}
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
