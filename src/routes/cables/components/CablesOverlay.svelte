<script>
  export let activeIntroText = "";
  export let activeEditorialText = "";
  export let stageCenterXPx = 0;
  export let stageTitleYPx = 0;
  export let stageSizePx = 0;
  export let stageSubtitleYPx = 0;
  export let editorialWidthPx = 0;
</script>

{#if activeIntroText}
  <section
    class="editorialCorner"
    style={`left:${stageCenterXPx}px; top:${stageTitleYPx}px; width:${Math.max(260, Math.round(stageSizePx * 0.78))}px;`}
  >
    <p class="editorialCornerText">{activeIntroText}</p>
  </section>
{/if}

{#if activeEditorialText}
  <section
    class="editorialTape"
    style={`left:${stageCenterXPx}px; top:${stageSubtitleYPx}px; width:${editorialWidthPx}px;`}
  >
    <p class="editorialText">{activeEditorialText}</p>
  </section>
{/if}

<style>
  .editorialCorner {
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

  .editorialCornerText {
    margin: 0;
    padding: 0;
    display: inline;
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
