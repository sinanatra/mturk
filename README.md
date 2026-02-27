# Views of Mechanical Turks

Install dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Timed Voiceover (macOS)

Generate a voiceover from `static/cables_editorial.json` using the built-in macOS `say` voices:

```bash
npm run voiceover:cables -- --voice "Samantha" --rate 180
```

Output:
- `static/audio/cables-voiceover.wav`

Useful options:
- `--phase windows-grid` (repeatable)
- `--limit 12`
- `--dry-run`

Behavior:
- No speed change is applied.
- If a spoken clip is shorter than `durationSec`, silence is added.
- If a spoken clip is longer than `durationSec`, it is trimmed to fit.
