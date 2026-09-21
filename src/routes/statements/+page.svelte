<script>
  import { tsv } from "d3";
  import { onMount, tick } from "svelte";
  import { base } from "$app/paths";

  const COL_WIDTH = 220;
  const GAP = 14;
  const MIN_SCALE = 0.15;
  const MAX_SCALE = 8;

  let cards = [];
  let loading = true;
  let showIntro = true;

  let viewportEl;
  let worldEl;
  let cardEls = [];
  let worldWidth = 1200;

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let isDragging = false;

  let dragStart = { x: 0, y: 0 };
  let dragOrigin = { x: 0, y: 0 };
  const pointers = new Map();
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  onMount(async () => {
    const rows = await tsv(`${base}/opinions_out.tsv`);
    cards = rows.filter((row) => row.text && row.text.length > 2);
    const cols = Math.max(3, Math.ceil(Math.sqrt(cards.length)));
    worldWidth = cols * (COL_WIDTH + GAP) + GAP;
    loading = false;
    await tick();
    centerView();
  });

  function centerView() {
    if (!viewportEl || !worldEl) return;
    scale = 1;
    tx = (viewportEl.clientWidth - worldEl.offsetWidth) / 2;
    ty = (viewportEl.clientHeight - worldEl.offsetHeight) / 2;
  }

  function clampScale(s) {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = viewportEl.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const newScale = clampScale(scale * factor);
    const wx = (mx - tx) / scale;
    const wy = (my - ty) / scale;
    tx = mx - wx * newScale;
    ty = my - wy * newScale;
    scale = newScale;
  }

  function closeIntro() {
    showIntro = false;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function handleWheel(e) {
    if (showIntro) return;
    e.preventDefault();
    const sensitivity = e.ctrlKey ? 0.006 : 0.0015;
    const factor = Math.exp(-e.deltaY * sensitivity);
    zoomAt(e.clientX, e.clientY, factor);
  }

  function handlePointerDown(e) {
    if (showIntro) return;
    viewportEl.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      isDragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      dragOrigin = { x: tx, y: ty };
    } else if (pointers.size === 2) {
      isDragging = false;
      const [a, b] = [...pointers.values()];
      pinchStartDist = distance(a, b);
      pinchStartScale = scale;
    }
  }

  function handlePointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = distance(a, b);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomAt(mid.x, mid.y, dist / pinchStartDist);
      pinchStartDist = dist;
    } else if (isDragging && pointers.size === 1) {
      tx = dragOrigin.x + (e.clientX - dragStart.x);
      ty = dragOrigin.y + (e.clientY - dragStart.y);
    }
  }

  function handlePointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStartDist = 0;
    if (pointers.size === 0) isDragging = false;
  }

  function handleKeydown(e) {
    if (e.key === "Escape" && showIntro) closeIntro();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if loading}
  <p class="status">Loading…</p>
{:else}
  <div
    class="viewport"
    bind:this={viewportEl}
    style:cursor={isDragging ? "grabbing" : "grab"}
    on:wheel={handleWheel}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:pointercancel={handlePointerUp}
  >
    {#if showIntro}
      <div class="intro" role="dialog" aria-modal="true">
        <div class="introBox">
          <p>
            What do you like and detest about working for Amazon Mechanical
            Turk? Why do you do it? Please share your honest feelings and
            opinions on the platform.
          </p>
          <button on:click={closeIntro}>Enter</button>
        </div>
      </div>
    {/if}

    <div
      class="world"
      bind:this={worldEl}
      style:width="{worldWidth}px"
      style:transform="translate({tx}px, {ty}px) scale({scale})"
    >
      {#each cards as card, i}
        <div class="card" bind:this={cardEls[i]}>
          <p>{card.text}</p>
          {#if card.id}<span class="id">#{card.id}</span>{/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }

  .status {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #fff;
    color: #000;
  }

  .viewport {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #fff;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .world {
    position: absolute;
    top: 0;
    left: 0;
    columns: 220px;
    column-gap: 14px;
    padding: 14px;
    box-sizing: border-box;
    transform-origin: 0 0;
  }

  .card {
    break-inside: avoid;
    margin-bottom: 14px;
    padding: 7px 8px;
    border: 1px solid #ccc;
    background: #fff;
    color: #000;
    font-size: 13px;
    line-height: 1.45;
  }

  .card p {
    margin: 0;
  }

  .card .id {
    display: block;
    margin-top: 6px;
    font-family: "terminal-grotesque", monospace;
    font-size: 9px;
    color: #888;
  }

  .intro {
    position: fixed;
    inset: 0;
    z-index: 2;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.85);
  }

  .introBox {
    max-width: 640px;
    width: min(80vw, 640px);
    padding: 24px;
    background: #fff;
    border: 1px solid #ccc;
    text-align: center;
  }

  .introBox p {
    margin: 0 0 16px;
    line-height: 1.3;
    color: #000;
  }

  .introBox button {
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 700;
    background: #000;
    color: #fff;
    border: none;
    cursor: pointer;
  }
</style>
