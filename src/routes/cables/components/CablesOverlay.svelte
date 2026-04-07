<script>
  export let activeChapterStep = "";
  export let activeChapterTitle = "";
  export let activeChapterDescription = "";
  export let activeEditorialText = "";
  export let stageCenterXPx = 0;
  export let stageTitleYPx = 0;
  export let stageSizePx = 0;
  export let stageSubtitleYPx = 0;
  export let editorialWidthPx = 0;
  export let subtitleScale = 1;
</script>

{#if activeChapterStep || activeChapterTitle || activeChapterDescription}
  <section
    class="chapterLegend"
    style={`left:${stageCenterXPx}px; top:${stageTitleYPx}px; width:${Math.max(260, Math.round(stageSizePx * 0.78))}px;`}
  >
    {#if activeChapterDescription}
      <p class="chapterLegendDesc">{activeChapterDescription}</p>
    {/if}
    {#if activeChapterStep || activeChapterTitle}
      <p class="chapterLegendHead">
        {#if activeChapterTitle}<span class="chapterLegendTitle">{activeChapterTitle}</span>{/if}
        {#if activeChapterStep}<span class="chapterLegendStep"> : {activeChapterStep}</span>{/if}
      </p>
    {/if}
  </section>
{/if}

{#if activeEditorialText}
  <section
    class="editorialTape"
    style={`left:${stageCenterXPx}px; top:${stageSubtitleYPx}px; width:${editorialWidthPx}px;`}
  >
    <p class="editorialText" style={`font-size: clamp(${15 * subtitleScale}px, ${1.25 * subtitleScale}vw, ${21 * subtitleScale}px);`}>{activeEditorialText}</p>
  </section>
{/if}

<style>
  .chapterLegend {
    position: fixed;
    left: 0;
    top: 0;
    transform: translate(-50%, 0);
    margin: 0;
    padding: 0;
    font-size: clamp(8px, 1.45vw, 14px);
    z-index: 12;
    pointer-events: none;
    text-align: center;
  }

  .chapterLegendHead {
    margin: 0;
    padding: 0;
    display: block;
    width: fit-content;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
    font-size: clamp(11px, 1.45vw, 15px);
    line-height: 1.02;
    color: #ffffff;
    background: rgb(0, 0, 0);
    text-align: center;
    white-space: pre-line;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  .chapterLegendStep {
    color: rgba(255, 255, 255, 0.68);
    letter-spacing: 0.02em;
  }

  .chapterLegendTitle {
    color: rgba(255, 255, 255, 0.68);
  }

  .chapterLegendDesc {
    margin: 0;
    padding: 0;
    display: block;
    width: fit-content;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
    font-size: clamp(10px, 1.45vw, 15px);
    line-height: 0.98;
    color: #ffffff;
    background: rgb(0, 0, 0);
    text-align: center;
    white-space: pre-line;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  .editorialTape {
    position: fixed;
    left: 0;
    top: 0;
    transform: translate(-50%, -100%);
    right: auto;
    bottom: auto;
    padding: 0;
    margin: 0;
    z-index: 12;
    pointer-events: none;
    text-align: center;
  }

  .editorialText {
    margin: 0;
    padding: 0;
    display: inline;
    font-size: clamp(15px, 1.25vw, 21px);
    line-height: 1.02;
    text-align: center;
    white-space: pre-line;
    color: #fff9d2;
    background: rgb(0, 0, 0);
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
</style>
