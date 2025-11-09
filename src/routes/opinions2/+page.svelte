<script>
  import { tsv } from "d3";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  let P5 = null;
  let width;
  let height;
  let data = [];
  let comments = [];
  let showIntro = true;

  function closeIntro() {
    showIntro = false;
  }

  onMount(async () => {
    if (browser) {
      const mod = await import("p5-svelte");
      P5 = mod.default;
      const d = await tsv("opinions_out.tsv");
      data = d;
      comments = d
        .flatMap((x) => x.text.split(". ").map((text) => ({ text, id: x.id })))
        .flatMap((x) =>
          x.text.length > 200
            ? x.text.split(",").map((text) => ({ text, id: x.id }))
            : x
        )
        .filter((x) => x.text && x.text.length > 2);
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") showIntro = false;
      });
    }
  });

  let nr = 0;
  let idx = 0;
  let textSize = 14;
  let speed = 5;
  let xPrev;
  let yPrev;
  let idPrev;
  let color = [0, 100, 0];
  let font;
  const sketch = (s) => {
    s.preload = () => {
      font = s.loadFont("terminal-grotesque.woff");
    };
    s.setup = () => {
      s.createCanvas(1, 1);
      s.colorMode(s.HSL);
      s.textFont(font);
    };
    s.draw = () => {
      if (width && height && (s.width !== width || s.height !== height))
        s.resizeCanvas(width, height);
      s.background(0, 0, 0, 0.03);
      s.frameRate(speed);
      s.textSize(textSize);
      if (comments.length === 0) return;
      idx = (idx + 1) % comments.length;
      let y = s.height - 10;
      let x = (s.width / 4) * s.sin(s.frameCount * 0.2) + s.width / 4;
      nr = (nr + textSize + 4) % s.height;
      if (nr <= 20) x = -x;
      if (idPrev == comments[idx].id) {
        s.stroke(...color, 0.6);
        if (yPrev >= 5) {
          s.strokeWeight(1);
          s.line(xPrev, yPrev, x, y - nr, 0);
        }
      } else {
        color = [idx + (10 % 360), 20, 50];
        nr = nr + textSize + 14;
      }
      s.fill(...color);
      s.stroke(0);
      s.strokeWeight(textSize / 3);
      s.text(comments[idx].text, x + 20, y - nr);
      xPrev = x;
      yPrev = y - nr;
      idPrev = comments[idx].id;
    };
  };
</script>

{#if P5}
  <article bind:clientWidth={width} bind:clientHeight={height}>
    {#if showIntro}
      <div class="overlay" role="dialog" aria-modal="true">
        <div class="overlayCard">
          <button class="closeBtn" on:click={closeIntro} aria-label="Close"
            >×</button
          >
          <h1 class="overlayTitle">Opinions Of The Workers</h1>
          <p class="overlayText">
            What do workers like and detest about Amazon Mechanical Turk, and
            why do they do it? This study asked twice: once open to all workers,
            then limited to Masters. The first filled in under an hour; the
            Masters round closed after three days with seventeen higher-quality
            entries. Themes include vital income alongside instability, scarce
            well-paid tasks, and unexplained rejections with little
            accountability.
          </p>
          <button class="actionBtn" on:click={closeIntro}>Enter</button>
        </div>
      </div>
    {/if}
    <P5 {sketch} />
  </article>
{:else}
  <article>Loading…</article>
{/if}

<style>
  :global(body) {
    padding: 0;
    margin: 0;
  }
  article {
    font-family: sans-serif;
    background-color: black;
    color: white;
    min-height: 100vh;
    font-size: 12px;
    padding: 8px 10px 0 10px;
    position: relative;
    display: flow-root;
  }
  :global(canvas) {
    position: fixed;
    inset: 0;
    display: block;
  }
  .overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: saturate(140%) blur(2px);
    z-index: 2;
  }
  .overlayCard {
    position: relative;
    max-width: 80ch;
    width: min(92vw, 1100px);
    padding: clamp(16px, 3vw, 28px);
    background: rgba(10, 10, 10, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.12);
    /* border-radius: 12px; */
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }
  .overlayTitle {
    margin: 0 0 0.6em 0;
    font-size: clamp(32px, 7vw, 72px);
    line-height: 1.05;
    /* font-weight: 800; */
    text-align: center;
  }
  .overlayText {
    margin: 0 auto 1.2em auto;
    max-width: 60ch;
    font-size: clamp(16px, 2.2vw, 22px);
    line-height: 1.4;
    text-align: center;
    opacity: 0.95;
  }
  .actionBtn {
    display: block;
    margin: 0 auto;
    padding: 0.7em 1.1em;
    font-size: clamp(14px, 1.8vw, 18px);
    font-weight: 700;
    background: white;
    color: black;
    border: none;
    /* border-radius: 999px; */
    cursor: pointer;
  }
  .actionBtn:focus {
    outline: 2px solid white;
    outline-offset: 2px;
  }
  .closeBtn {
    position: absolute;
    top: 8px;
    right: 10px;
    width: 40px;
    height: 40px;
    border: none;
    /* border-radius: 999px; */
    background: transparent;
    color: white;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
  }
  .closeBtn:hover {
    background: rgba(255, 255, 255, 0.08);
  }
</style>
