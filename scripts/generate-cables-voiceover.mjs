#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_INPUT = "static/cables_editorial.json";
const DEFAULT_OUTPUT = "static/audio/cables-voiceover.wav";
const DEFAULT_VOICE = "Samantha";
const DEFAULT_RATE = 180;
const DEFAULT_SAMPLE_RATE = 48_000;

function printHelp() {
  console.log(`Generate a timed voiceover from cables editorial notes (macOS 'say' + ffmpeg).

Usage:
  node scripts/generate-cables-voiceover.mjs [options]

Options:
  --input <path>           Editorial JSON file (default: ${DEFAULT_INPUT})
  --output <path>          Output WAV path (default: ${DEFAULT_OUTPUT})
  --voice <name>           macOS voice name (default: ${DEFAULT_VOICE})
  --rate <wpm>             Base speech rate for 'say' (default: ${DEFAULT_RATE})
  --phase <phase-id>       Keep only a specific phase (repeatable)
  --limit <n>              Process only first n notes
  --include-inactive       Include notes with active=false
  --allow-empty-speech     Do not fail if 'say' returns empty speech clips
  --keep-temp              Keep intermediate temp files
  --dry-run                Print planned notes without generating audio
  -h, --help               Show this help
`);
}

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    voice: DEFAULT_VOICE,
    rate: DEFAULT_RATE,
    phaseFilters: [],
    limit: 0,
    includeInactive: false,
    allowEmptySpeech: false,
    keepTemp: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--include-inactive") {
      options.includeInactive = true;
      continue;
    }
    if (arg === "--allow-empty-speech") {
      options.allowEmptySpeech = true;
      continue;
    }
    if (arg === "--keep-temp") {
      options.keepTemp = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--input") {
      options.input = argv[++i];
      continue;
    }
    if (arg === "--output") {
      options.output = argv[++i];
      continue;
    }
    if (arg === "--voice") {
      options.voice = argv[++i];
      continue;
    }
    if (arg === "--rate") {
      options.rate = Number.parseFloat(argv[++i]);
      continue;
    }
    if (arg === "--phase") {
      options.phaseFilters.push(argv[++i]);
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number.parseInt(argv[++i], 10);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.rate) || options.rate <= 0) {
    throw new Error(`Invalid --rate value: ${options.rate}`);
  }
  if (!Number.isInteger(options.limit) || options.limit < 0) {
    throw new Error(`Invalid --limit value: ${options.limit}`);
  }

  return options;
}

function run(cmd, args, { quiet = false } = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const message = [`Command failed: ${cmd} ${args.join(" ")}`];
    if (!quiet && result.stderr?.trim()) message.push(result.stderr.trim());
    throw new Error(message.join("\n"));
  }
  return result.stdout.trim();
}

function commandExists(cmd) {
  const check = spawnSync("which", [cmd], { encoding: "utf8" });
  return check.status === 0;
}

function quoteConcatPath(filePath) {
  return `'${filePath.replace(/'/g, `'\\''`)}'`;
}

function cleanNarrationText(raw) {
  return String(raw ?? "")
    .replace(/\[\[id:[A-Za-z0-9_-]{3,}\]\]/g, "")
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function probeDurationSec(filePath) {
  const output = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number.parseFloat(output);
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error(`Could not parse duration for file: ${filePath}`);
  }
  return duration;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!commandExists("say")) {
    throw new Error("Missing required command: say");
  }
  if (!commandExists("ffmpeg")) {
    throw new Error("Missing required command: ffmpeg");
  }
  if (!commandExists("ffprobe")) {
    throw new Error("Missing required command: ffprobe");
  }

  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  const payloadRaw = await fs.readFile(inputPath, "utf8");
  const payload = JSON.parse(payloadRaw);
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];

  let selected = notes
    .filter((note) => (options.includeInactive ? true : note?.active !== false))
    .filter((note) => String(note?.mode || "") === "time")
    .map((note, index) => ({
      index,
      id: String(note?.id || `note-${index + 1}`),
      phase: String(note?.phase || ""),
      durationSec: Math.max(0, Number(note?.durationSec) || 0),
      text: cleanNarrationText(note?.text),
    }))
    .filter((note) => note.durationSec > 0);

  if (options.phaseFilters.length > 0) {
    const phaseSet = new Set(options.phaseFilters);
    selected = selected.filter((note) => phaseSet.has(note.phase));
  }

  if (options.limit > 0) {
    selected = selected.slice(0, options.limit);
  }

  if (selected.length === 0) {
    throw new Error("No timed notes selected. Nothing to generate.");
  }

  const totalTargetSec = selected.reduce((sum, note) => sum + note.durationSec, 0);
  console.log(
    `Selected ${selected.length} notes, target total ${totalTargetSec.toFixed(2)}s`,
  );

  if (options.dryRun) {
    selected.forEach((note, i) => {
      const preview = note.text ? note.text.slice(0, 70) : "[PAUSE]";
      console.log(
        `${String(i + 1).padStart(3, "0")} ${note.phase} ${note.durationSec.toFixed(2)}s ${preview}`,
      );
    });
    return;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "turks-voiceover-"));
  const segments = [];
  let emptySpeechWarnings = 0;

  try {
    for (let i = 0; i < selected.length; i += 1) {
      const note = selected[i];
      const indexLabel = String(i + 1).padStart(3, "0");
      const segmentPath = path.join(tmpDir, `${indexLabel}-${note.id}.wav`);

      if (!note.text) {
        run("ffmpeg", [
          "-y",
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          `anullsrc=channel_layout=mono:sample_rate=${DEFAULT_SAMPLE_RATE}`,
          "-t",
          note.durationSec.toFixed(3),
          "-c:a",
          "pcm_s16le",
          segmentPath,
        ]);
        segments.push({ ...note, segmentPath, sourceSec: 0, truncated: false });
        console.log(`${indexLabel} [pause] ${note.durationSec.toFixed(2)}s`);
        continue;
      }

      const rawSpeechPath = path.join(tmpDir, `${indexLabel}-${note.id}.aiff`);
      run("say", [
        "-v",
        options.voice,
        "-r",
        String(Math.round(options.rate)),
        "-o",
        rawSpeechPath,
        note.text,
      ]);

      let sourceSec = 0;
      try {
        sourceSec = probeDurationSec(rawSpeechPath);
      } catch (error) {
        if (!options.allowEmptySpeech) throw error;
        sourceSec = 0;
      }

      if (sourceSec < 0.01) {
        emptySpeechWarnings += 1;
        if (!options.allowEmptySpeech) {
          throw new Error(
            `Voice clip is empty for note '${note.id}'.\nTry another --voice, or rerun with --allow-empty-speech to continue.`,
          );
        }
      }

      const truncated = sourceSec > note.durationSec + 0.001;
      const filters = [
        `apad=pad_dur=${note.durationSec.toFixed(3)}`,
        `atrim=0:${note.durationSec.toFixed(3)}`,
      ];

      run("ffmpeg", [
        "-y",
        "-v",
        "error",
        "-i",
        rawSpeechPath,
        "-af",
        filters.join(","),
        "-ar",
        String(DEFAULT_SAMPLE_RATE),
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        segmentPath,
      ]);

      const finalSec = probeDurationSec(segmentPath);
      segments.push({ ...note, segmentPath, sourceSec, finalSec, truncated });
      console.log(
        `${indexLabel} ${note.durationSec.toFixed(2)}s <- ${sourceSec.toFixed(2)}s ${truncated ? "[trimmed]" : "[padded/unchanged]"} ${note.id}`,
      );
    }

    const concatListPath = path.join(tmpDir, "concat.txt");
    const concatData = segments
      .map((segment) => `file ${quoteConcatPath(segment.segmentPath)}`)
      .join("\n");
    await fs.writeFile(concatListPath, `${concatData}\n`, "utf8");

    run("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-ar",
      String(DEFAULT_SAMPLE_RATE),
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ]);

    const finalDurationSec = probeDurationSec(outputPath);
    const delta = finalDurationSec - totalTargetSec;
    console.log(`\nGenerated: ${outputPath}`);
    console.log(
      `Duration: ${finalDurationSec.toFixed(3)}s (target ${totalTargetSec.toFixed(3)}s, delta ${delta >= 0 ? "+" : ""}${delta.toFixed(3)}s)`,
    );
    if (emptySpeechWarnings > 0) {
      console.log(
        `Warning: ${emptySpeechWarnings} note(s) had empty speech and were turned into silence.`,
      );
    }
    const truncatedCount = segments.filter((segment) => segment.truncated).length;
    if (truncatedCount > 0) {
      console.log(
        `Warning: ${truncatedCount} note(s) were longer than their slot and were trimmed (no speed change applied).`,
      );
    }
  } finally {
    if (!options.keepTemp) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } else {
      console.log(`Kept temp files at: ${tmpDir}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
