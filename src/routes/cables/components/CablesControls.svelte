<script>
  import { createEventDispatcher } from "svelte";

  export let phaseLabelForUi = "";
  export let paused = false;
  export let syncFocusToEditorial = true;
  export let isRecording4K = false;
  export let recordingError = "";
  export let authoringHint = "";
  export let subtitleScale = 1;

  const dispatch = createEventDispatcher();
</script>

<section class="metaTop">
  <p>{phaseLabelForUi}</p>
  <button type="button" on:click={() => dispatch("togglePause")}
    >{paused ? "Play" : "Pause"}</button
  >
  <button type="button" on:click={() => dispatch("nextStory")}>Next Story</button>
  <button type="button" on:click={() => dispatch("prevText")}>Prev Text</button>
  <button type="button" on:click={() => dispatch("nextText")}>Next Text</button>
  <button type="button" on:click={() => dispatch("toggleSyncFocus")}
    >{syncFocusToEditorial ? "Focus = Text Time" : "Focus = Fixed Time"}</button
  >
  <button type="button" on:click={() => dispatch("toggleRecording")}
    >{isRecording4K ? "Stop 4K Rec" : "Record 4K"}</button
  >
  <label class="subtitleScaleLabel">
    Sub size
    <input
      type="range"
      min="0.5"
      max="3"
      step="0.05"
      value={subtitleScale}
      on:input={(e) => dispatch("subtitleScaleChange", +e.target.value)}
    />
    {subtitleScale.toFixed(2)}x
  </label>
  {#if recordingError}
    <p class="metaWarn">{recordingError}</p>
  {/if}
  {#if authoringHint}
    <p class="metaHint">{authoringHint}</p>
  {/if}
</section>

<style>
  .metaTop {
    position: fixed;
    top: 12px;
    left: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 12;
    flex-wrap: wrap;
    max-width: 400px;
  }

  .metaTop p {
    margin: 0;
    padding: 4px;
    background: #000;
    border: 1px solid #838b85;
    color: #838b85;
    font-size: 13px;
  }

  .metaTop .metaWarn {
    border-color: #c44;
    color: #f8b7b7;
  }

  .metaTop .metaHint {
    border-color: #5b9ad6;
    color: #c4deff;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .metaTop button {
    border: 1px solid #838b85;
    padding: 4px 10px;
    background: #000;
    color: #838b85;
    font-size: 13px;
    cursor: pointer;
  }

  .subtitleScaleLabel {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #838b85;
    padding: 4px 10px;
    background: #000;
    color: #838b85;
    font-size: 13px;
    white-space: nowrap;
  }

  .subtitleScaleLabel input[type="range"] {
    width: 80px;
    accent-color: #838b85;
  }

</style>
