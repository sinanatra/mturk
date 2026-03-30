<script>
  import { tsv } from "d3";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { base } from "$app/paths";

  let P5 = null;
  let width;
  let height;
  let cards = [];
  let showIntro = true;
  let isDragging = false;

  function closeIntro() {
    showIntro = false;
  }

  onMount(async () => {
    if (browser) {
      const mod = await import("p5-svelte");
      P5 = mod.default;
      const d = await tsv(`${base}/opinions_out.tsv`);
      cards = d.filter((x) => x.text && x.text.length > 2);
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") showIntro = false;
      });
    }
  });

  const GAP = 14;

  const FONT_SIZE = 7;
  const LEADING = FONT_SIZE * 1.48;
  const ID_FONT_SIZE = 4.5;
  const PAD_Y = 7;
  const PAD_X = 8;
  const GAP_2EM = FONT_SIZE * 0.8;

  function estimateCardHeight(text, cardW) {
    const charsPerLine = Math.floor(cardW / 5.8);
    const words = text.split(" ");
    let lines = 1,
      len = 0;
    for (const w of words) {
      if (len + w.length + 1 > charsPerLine) {
        lines++;
        len = 0;
      }
      len += w.length + 1;
    }
    return lines * LEADING + GAP_2EM + ID_FONT_SIZE;
  }

  function buildLayout(items, cardW, cols) {
    if (!items.length) return [];
    const colHeights = new Array(cols).fill(0);
    const entries = [];
    for (const item of items) {
      const h = estimateCardHeight(item.text, cardW);
      let bestCol = 0;
      for (let i = 1; i < cols; i++) {
        if (colHeights[i] < colHeights[bestCol]) bestCol = i;
      }
      const x = bestCol * (cardW + GAP) + cardW / 2;
      const y = colHeights[bestCol] + h / 2;
      entries.push({ ...item, x, y, w: cardW, h });
      colHeights[bestCol] += h + GAP;
    }
    const totalW = cols * (cardW + GAP) - GAP;
    const totalH = Math.max(...colHeights);
    return entries.map((e) => ({
      ...e,
      x: e.x - totalW / 2,
      y: e.y - totalH / 2,
    }));
  }

  let font;
  let fontMono;

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

  let layout = [];
  let layoutCardW = 0;
  let dragStartX = 0,
    dragStartY = 0;
  let camDragStartX = 0,
    camDragStartY = 0;
  let touchStartDist = 0;
  let touchStartScale = 1;

  const sketch = (s) => {
    s.preload = () => {
      font = s.loadFont(`${base}/TimesDotRom.woff`);
      fontMono = s.loadFont(`${base}/terminal-grotesque.woff`);
    };

    s.setup = () => {
      s.createCanvas(1, 1);
      s.colorMode(s.HSL, 360, 100, 100, 1);
      s.rectMode(s.CENTER);
      if (font) s.textFont(font);
      s.frameRate(30);

      // Touch handlers
      if (browser && s.canvas) {
        s.canvas.addEventListener("touchstart", (e) => {
          if (showIntro) return;
          e.preventDefault();
          if (e.touches.length === 1) {
            isDragging = true;
            dragStartX = e.touches[0].clientX;
            dragStartY = e.touches[0].clientY;
            camDragStartX = camera.x;
            camDragStartY = camera.y;
          } else if (e.touches.length === 2) {
            isDragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.sqrt(dx * dx + dy * dy);
            touchStartScale = camera.toScale;
          }
        });

        s.canvas.addEventListener("touchmove", (e) => {
          if (showIntro) return;
          e.preventDefault();
          if (e.touches.length === 1 && isDragging) {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            camera.x = camDragStartX - (currentX - dragStartX) / camera.scale;
            camera.y = camDragStartY - (currentY - dragStartY) / camera.scale;
            camera.toX = camera.x;
            camera.toY = camera.y;
          } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDist = Math.sqrt(dx * dx + dy * dy);
            const factor = currentDist / touchStartDist;
            const newScale = Math.max(1.2, Math.min(8, touchStartScale * factor));
            
            const touchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const touchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            
            const wx = (touchCenterX - s.width / 2) / camera.scale + camera.x;
            const wy = (touchCenterY - s.height / 2) / camera.scale + camera.y;
            camera.toScale = newScale;
            camera.toX = wx - (touchCenterX - s.width / 2) / newScale;
            camera.toY = wy - (touchCenterY - s.height / 2) / newScale;
          }
        });

        s.canvas.addEventListener("touchend", (e) => {
          isDragging = false;
        });
      }
    };

    s.mousePressed = () => {
      if (showIntro) return;
      isDragging = true;
      dragStartX = s.mouseX;
      dragStartY = s.mouseY;
      camDragStartX = camera.x;
      camDragStartY = camera.y;
    };

    s.mouseReleased = () => {
      isDragging = false;
    };

    s.mouseDragged = () => {
      if (!isDragging || showIntro) return;
      camera.x = camDragStartX - (s.mouseX - dragStartX) / camera.scale;
      camera.y = camDragStartY - (s.mouseY - dragStartY) / camera.scale;
      camera.toX = camera.x;
      camera.toY = camera.y;
    };

    s.mouseWheel = (e) => {
      if (showIntro) return;
      const factor = e.delta > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.06, Math.min(12, camera.toScale * factor));
      const wx = (s.mouseX - s.width / 2) / camera.scale + camera.x;
      const wy = (s.mouseY - s.height / 2) / camera.scale + camera.y;
      camera.toScale = newScale;
      camera.toX = wx - (s.mouseX - s.width / 2) / newScale;
      camera.toY = wy - (s.mouseY - s.height / 2) / newScale;
      return false;
    };

    s.draw = () => {
      if (width && height && (s.width !== width || s.height !== height)) {
        s.resizeCanvas(width, height);
      }

      // Rebuild layout when data arrives or canvas resizes
      const cardW = Math.round(Math.max(160, Math.min(260, s.width * 0.14)));
      const cols = Math.max(4, Math.ceil(Math.sqrt(cards.length)));
      if (
        cards.length > 0 &&
        (layout.length !== cards.length || layoutCardW !== cardW)
      ) {
        layout = buildLayout(cards, cardW, cols);
        layoutCardW = cardW;
        // Start zoomed into a random card
        const seed = layout[Math.floor(Math.random() * layout.length)];
        const startScale = Math.min(3.5, (s.width * 0.7) / cardW);
        camera.scale = startScale;
        camera.toScale = startScale;
        camera.x = seed.x;
        camera.y = seed.y;
        camera.toX = seed.x;
        camera.toY = seed.y;
        camera.initialized = true;
        camera.lastMs = s.millis();
      }

      // Tick camera
      const now = s.millis();
      if (camera.initialized) {
        const dt = Math.max(1, now - camera.lastMs);
        camera.lastMs = now;
        camera.x += (camera.toX - camera.x) * Math.min(1, dt / 320);
        camera.y += (camera.toY - camera.y) * Math.min(1, dt / 320);
        camera.scale += (camera.toScale - camera.scale) * Math.min(1, dt / 220);
      }

      s.background(0, 0, 4);

      if (!layout.length) return;

      s.push();
      s.translate(
        s.width / 2 - camera.x * camera.scale,
        s.height / 2 - camera.y * camera.scale,
      );
      s.scale(camera.scale);

      // Frustum culling bounds
      const halfW = s.width / (2 * camera.scale);
      const halfH = s.height / (2 * camera.scale);
      const maxCardH = layout.reduce((m, e) => Math.max(m, e.h), 0);
      const visMinX = camera.x - halfW - cardW;
      const visMaxX = camera.x + halfW + cardW;
      const visMinY = camera.y - halfH - maxCardH;
      const visMaxY = camera.y + halfH + maxCardH;

      for (const entry of layout) {
        if (
          entry.x < visMinX ||
          entry.x > visMaxX ||
          entry.y < visMinY ||
          entry.y > visMaxY
        )
          continue;
        drawCard(entry);
      }

      s.pop();
    };

    function drawCard(entry) {
      const { x, y, w, h, text, id } = entry;

      // Background
      s.noStroke();
      s.fill(0, 0, 8);
      s.rect(x, y, w, h);

      // Border
      s.noFill();
      s.stroke("blue");
      s.strokeWeight(0.4);
      s.rect(x, y, w, h);

      // Text
      s.noStroke();
      s.textSize(FONT_SIZE);
      s.textAlign(s.LEFT, s.TOP);
      const maxTextW = w - PAD_X * 2;
      const startX = x - w / 2 + PAD_X;
      const startY = y - h / 2 + PAD_Y;

      // Word wrap
      const words = text.split(" ");
      const lines = [];
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (s.textWidth(candidate) <= maxTextW) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);

      s.fill(0, 0, 82);
      let lineY = startY;
      for (const line of lines) {
        s.text(line, startX, lineY);
        lineY += LEADING;
      }

      // ID: 2em below last text line, terminal font, blue
      if (id) {
        if (fontMono) s.textFont(fontMono);
        s.textSize(ID_FONT_SIZE);
        s.textAlign(s.LEFT, s.TOP);
        s.fill("blue");
        s.text(`#${id}`, startX, lineY + GAP_2EM);
        s.textFont(font);
      }
    }
  };
</script>

{#if P5}
  <article
    bind:clientWidth={width}
    bind:clientHeight={height}
    style:cursor={isDragging ? "grabbing" : "grab"}
  >
    {#if showIntro}
      <div class="overlay" role="dialog" aria-modal="true">
        <div class="overlayCard">
          <h1 class="overlayTitle">
            What do you like and detest about working for Amazon Mechanical
            Turk? Why do you do it? <br />Please share your honest feelings and
            opinions on the platform.
          </h1>

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
    font-family: "TimesDotRom", serif;
    background-color: black;
    color: white;
    min-height: 100vh;
    font-size: 12px;
    padding: 0;
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
    width: min(80vw, 1100px);
    padding: clamp(16px, 3vw, 28px);
    background: rgba(10, 10, 10, 0.9);
    border: 1px solid blue;
  }

  .overlayTitle {
    font-size: clamp(18px, 2.4vw, 24px);
    margin: 0;
    margin-bottom: 1em;
    padding: 0;
    line-height: 1.05;
    text-align: center;
  }

  .actionBtn {
    display: block;
    margin: 0 auto;
    padding: 0.55em 1em;
    font-size: clamp(11px, 1.2vw, 14px);
    font-weight: 700;
    background: white;
    color: black;
    border: none;
    cursor: pointer;
  }
  .actionBtn:focus {
    outline: 2px solid white;
    outline-offset: 2px;
  }
</style>
