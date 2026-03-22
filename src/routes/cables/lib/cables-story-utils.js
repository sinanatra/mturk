import {
  NOTE_RESTART_PAUSE_SEC,
  TIMELINE,
  normalizeMultilineText,
  normalizeText,
  phaseDurationMsFromNotes,
  selectActiveTimeNotes,
  sequenceNoteByDuration,
} from "./cables-utils";

export function phaseSectionDurationMs(editorialNotes, phaseId, viewState, fallbackMs) {
  const notes = selectActiveTimeNotes(editorialNotes, `${phaseId}-${viewState}`);
  return phaseDurationMsFromNotes(notes, fallbackMs);
}

export function parseEditorialPayload(payload, normalizeNote) {
  let notes = [];
  let chapterTitles = {
    windows: "",
    screens: "",
    opinions: "",
    broken: "",
    "worker-attempt": "",
  };

  if (Array.isArray(payload)) {
    notes = payload.map((note, index) => normalizeNote(note, index));
    return { notes, chapterTitles };
  }
  if (!payload || typeof payload !== "object") {
    return { notes, chapterTitles };
  }

  if (Array.isArray(payload.notes)) {
    notes = payload.notes.map((note, index) => normalizeNote(note, index));
  }

  const intro = payload.intro;
  if (!intro || typeof intro !== "object") {
    return { notes, chapterTitles };
  }

  if (intro.chapterTitles && typeof intro.chapterTitles === "object") {
    if (typeof intro.chapterTitles.windows === "string") {
      chapterTitles.windows = normalizeText(intro.chapterTitles.windows);
    }
    if (typeof intro.chapterTitles.screens === "string") {
      chapterTitles.screens = normalizeText(intro.chapterTitles.screens);
    }
    if (typeof intro.chapterTitles.opinions === "string") {
      chapterTitles.opinions = normalizeText(intro.chapterTitles.opinions);
    }
    if (typeof intro.chapterTitles.broken === "string") {
      chapterTitles.broken = normalizeText(intro.chapterTitles.broken);
    }
    if (typeof intro.chapterTitles["worker-attempt"] === "string") {
      chapterTitles["worker-attempt"] = normalizeText(
        intro.chapterTitles["worker-attempt"],
      );
    }
    if (typeof intro.chapterTitles.conclusion === "string") {
      chapterTitles["worker-attempt"] = normalizeText(
        intro.chapterTitles.conclusion,
      );
    }
  }

  if (typeof intro.windowsTitle === "string") {
    chapterTitles.windows = normalizeText(intro.windowsTitle);
  }
  if (typeof intro.screensTitle === "string") {
    chapterTitles.screens = normalizeText(intro.screensTitle);
  }
  if (typeof intro.opinionsTitle === "string") {
    chapterTitles.opinions = normalizeText(intro.opinionsTitle);
  }
  if (typeof intro.brokenTitle === "string") {
    chapterTitles.broken = normalizeText(intro.brokenTitle);
  }
  if (typeof intro.workerAttemptTitle === "string") {
    chapterTitles["worker-attempt"] = normalizeText(intro.workerAttemptTitle);
  }
  if (typeof intro.conclusionTitle === "string") {
    chapterTitles["worker-attempt"] = normalizeText(intro.conclusionTitle);
  }

  return { notes, chapterTitles };
}

export function resolveActiveNote(
  editorialNotes,
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
        (note.phase === phaseId || note.phase === stateAlias || note.phase === "any"),
    )
    .sort((a, b) => a.order - b.order);
  if (candidates.length === 0) return null;

  const byTarget = candidates.filter((note) => {
    if (note.mode !== "target" || !note.targetId || !focusTarget?.id) return false;
    if (note.targetId !== focusTarget.id) return false;
    if (note.targetStep === "any") return true;
    return note.targetStep === focusTarget.step;
  });
  if (byTarget.length) return byTarget[byTarget.length - 1];

  const stateNotes = candidates.filter(
    (note) => note.mode !== "target" && note.phase === stateAlias,
  );
  if (stateNotes.length) {
    return sequenceNoteByDuration(stateNotes, viewElapsedSec, {
      loop: true,
      restartPauseSec: NOTE_RESTART_PAUSE_SEC,
      returnNullDuringPause: true,
    });
  }

  const phaseNotes = candidates.filter(
    (note) => note.mode !== "target" && note.phase === phaseId,
  );
  if (phaseNotes.length) return sequenceNoteByDuration(phaseNotes, phaseElapsedSec);

  const anyNotes = candidates.filter(
    (note) => note.mode !== "target" && note.phase === "any",
  );
  if (anyNotes.length) return sequenceNoteByDuration(anyNotes, phaseElapsedSec);

  return null;
}

export function editorialTimelineFor(editorialNotes, phaseId, viewState) {
  const stateAlias = `${phaseId}-${viewState}`;
  const stateNotes = selectActiveTimeNotes(editorialNotes, stateAlias);
  if (stateNotes.length) {
    return {
      key: `state:${stateAlias}`,
      notes: stateNotes,
      elapsedMode: "view",
      loop: true,
      restartPauseSec: NOTE_RESTART_PAUSE_SEC,
    };
  }

  const phaseNotes = selectActiveTimeNotes(editorialNotes, phaseId);
  if (phaseNotes.length) {
    return {
      key: `phase:${phaseId}`,
      notes: phaseNotes,
      elapsedMode: "phase",
      loop: false,
      restartPauseSec: 0,
    };
  }

  const anyNotes = selectActiveTimeNotes(editorialNotes, "any");
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

export function chapterSkimDescriptors(editorialNotes, phaseId, phaseMode) {
  const focusState = phaseMode === "broken" ? "broken-seq" : "focus";
  const states = ["grid", focusState];
  return states
    .map((viewState) => {
      const notes = selectActiveTimeNotes(editorialNotes, `${phaseId}-${viewState}`);
      return {
        viewState,
        notes,
        key: `state:${phaseId}-${viewState}`,
      };
    })
    .filter((item) => item.notes.length > 0);
}

export function chapterMetaForPhase(chapterTitles, phaseId) {
  const phase = TIMELINE.find((item) => item.id === phaseId);
  if (!phase) return { step: "", title: "" };
  const overrideTitle = chapterTitles[phaseId] || "";

  if (phase.mode === "conclusion") {
    return {
      step: "",
      title: overrideTitle || "Outro",
    };
  }

  const chapterPhases = TIMELINE.filter((item) => item.mode !== "conclusion");
  const idx = chapterPhases.findIndex((item) => item.id === phaseId);
  if (idx < 0) return { step: "", title: phase.label || "" };

  const fallbackTitle = phase.label || "";
  return {
    step: `${idx + 1}/${chapterPhases.length}`,
    title: overrideTitle || fallbackTitle,
  };
}

export function legendDescriptionForPhase(sharedLegendText) {
  return normalizeMultilineText(sharedLegendText);
}
