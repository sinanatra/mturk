import {
  NOTE_RESTART_PAUSE_SEC,
  TIMELINE,
  normalizeMultilineText,
  normalizeText,
  phaseDurationMsFromNotes,
  sequenceNoteByDuration,
} from "./cables-utils";

function sortedByOrder(list) {
  return [...list].sort((a, b) => a.order - b.order);
}

export function buildEditorialRuntime(editorialNotes) {
  const timeNotesByPhase = new Map();
  const targetNotesByPhase = new Map();

  const pushByPhase = (map, phase, note) => {
    if (!map.has(phase)) map.set(phase, []);
    map.get(phase).push(note);
  };

  for (const note of editorialNotes) {
    if (!note?.active) continue;
    const phase = note.phase || "any";
    if (note.mode === "target") {
      pushByPhase(targetNotesByPhase, phase, note);
    } else {
      pushByPhase(timeNotesByPhase, phase, note);
    }
  }

  for (const [phase, notes] of timeNotesByPhase.entries()) {
    timeNotesByPhase.set(phase, sortedByOrder(notes));
  }
  for (const [phase, notes] of targetNotesByPhase.entries()) {
    targetNotesByPhase.set(phase, sortedByOrder(notes));
  }

  const timeNotesFor = (phase) => timeNotesByPhase.get(phase) || [];
  const targetNotesFor = (phase) => targetNotesByPhase.get(phase) || [];

  return {
    phaseSectionDurationMs(phaseId, viewState, fallbackMs) {
      const notes = timeNotesFor(`${phaseId}-${viewState}`);
      return phaseDurationMsFromNotes(notes, fallbackMs);
    },

    editorialTimelineFor(phaseId, viewState) {
      const stateAlias = `${phaseId}-${viewState}`;
      const stateNotes = timeNotesFor(stateAlias);
      if (stateNotes.length) {
        return {
          key: `state:${stateAlias}`,
          notes: stateNotes,
          elapsedMode: "view",
          loop: true,
          restartPauseSec: NOTE_RESTART_PAUSE_SEC,
        };
      }

      const phaseNotes = timeNotesFor(phaseId);
      if (phaseNotes.length) {
        return {
          key: `phase:${phaseId}`,
          notes: phaseNotes,
          elapsedMode: "phase",
          loop: false,
          restartPauseSec: 0,
        };
      }

      const anyNotes = timeNotesFor("any");
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
    },

    chapterSkimDescriptors(phaseId, phaseMode) {
      const focusState = phaseMode === "broken" ? "broken-seq" : "focus";
      const states = ["grid", focusState];
      return states
        .map((viewState) => {
          const notes = timeNotesFor(`${phaseId}-${viewState}`);
          return {
            viewState,
            notes,
            key: `state:${phaseId}-${viewState}`,
          };
        })
        .filter((item) => item.notes.length > 0);
    },

    resolveActiveNote(
      phaseId,
      phaseElapsedSec,
      viewState,
      focusTarget = null,
      viewElapsedSec = phaseElapsedSec,
    ) {
      const stateAlias = `${phaseId}-${viewState}`;

      const targetCandidates = sortedByOrder([
        ...targetNotesFor(phaseId),
        ...targetNotesFor(stateAlias),
        ...targetNotesFor("any"),
      ]);
      for (let i = targetCandidates.length - 1; i >= 0; i -= 1) {
        const note = targetCandidates[i];
        if (!note.targetId || !focusTarget?.id) continue;
        if (note.targetId !== focusTarget.id) continue;
        if (note.targetStep === "any" || note.targetStep === focusTarget.step) {
          return note;
        }
      }

      const stateNotes = timeNotesFor(stateAlias);
      if (stateNotes.length) {
        return sequenceNoteByDuration(stateNotes, viewElapsedSec, {
          loop: true,
          restartPauseSec: NOTE_RESTART_PAUSE_SEC,
          returnNullDuringPause: true,
        });
      }

      const phaseNotes = timeNotesFor(phaseId);
      if (phaseNotes.length) return sequenceNoteByDuration(phaseNotes, phaseElapsedSec);

      const anyNotes = timeNotesFor("any");
      if (anyNotes.length) return sequenceNoteByDuration(anyNotes, phaseElapsedSec);

      return null;
    },
  };
}

export function parseEditorialPayload(payload, normalizeNote) {
  let notes = [];
  let chapterTitles = {
    windows: "",
    screens: "",
    opinions: "",
    broken: "",
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

  return { notes, chapterTitles };
}

export function phaseSectionDurationMs(editorialNotes, phaseId, viewState, fallbackMs) {
  return buildEditorialRuntime(editorialNotes).phaseSectionDurationMs(
    phaseId,
    viewState,
    fallbackMs,
  );
}

export function resolveActiveNote(
  editorialNotes,
  phaseId,
  phaseElapsedSec,
  viewState,
  focusTarget = null,
  viewElapsedSec = phaseElapsedSec,
) {
  return buildEditorialRuntime(editorialNotes).resolveActiveNote(
    phaseId,
    phaseElapsedSec,
    viewState,
    focusTarget,
    viewElapsedSec,
  );
}

export function editorialTimelineFor(editorialNotes, phaseId, viewState) {
  return buildEditorialRuntime(editorialNotes).editorialTimelineFor(
    phaseId,
    viewState,
  );
}

export function chapterSkimDescriptors(editorialNotes, phaseId, phaseMode) {
  return buildEditorialRuntime(editorialNotes).chapterSkimDescriptors(
    phaseId,
    phaseMode,
  );
}

export function chapterMetaForPhase(chapterTitles, phaseId) {
  const idx = TIMELINE.findIndex((item) => item.id === phaseId);
  if (idx < 0) return { step: "", title: "" };
  const fallbackTitle = TIMELINE[idx].label || "";
  const overrideTitle = chapterTitles[phaseId] || "";
  return {
    step: `${idx + 1}/${TIMELINE.length}`,
    title: overrideTitle || fallbackTitle,
  };
}

export function legendDescriptionForPhase(sharedLegendText) {
  return normalizeMultilineText(sharedLegendText);
}
