<script>
  import { createEventDispatcher } from "svelte";

  export let phaseLabelForUi = "";
  export let paused = false;
  export let syncFocusToEditorial = true;
  export let isRecording4K = false;
  export let recordingError = "";
  export let focusPaddingRatio = 0.25;
  export let voiceoverEnabled = false;
  export let voiceoverSupported = false;
  export let voiceoverError = "";
  export let voiceoverVoiceNames = [];
  export let voiceoverVoiceName = "";
  export let voiceoverRate = 0.92;

  const dispatch = createEventDispatcher();

  function onPadInput(event) {
    const nextValue = Number.parseFloat(event.currentTarget.value);
    dispatch("focusPaddingChange", nextValue);
  }

  function onVoiceChange(event) {
    dispatch("voiceoverVoiceChange", event.currentTarget.value);
  }

  function onVoiceRateInput(event) {
    const nextValue = Number.parseFloat(event.currentTarget.value);
    dispatch("voiceoverRateChange", nextValue);
  }
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
  <button
    type="button"
    on:click={() => dispatch("toggleVoiceover")}
    disabled={!voiceoverSupported}
  >
    {voiceoverEnabled ? "Voice Off" : "Voice On"}
  </button>
  {#if voiceoverSupported}
    <label class="metaRange">
      Voice
      <select value={voiceoverVoiceName} on:change={onVoiceChange}>
        {#each voiceoverVoiceNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </label>
    <label class="metaRange">
      Rate {voiceoverRate.toFixed(2)}
      <input
        type="range"
        min="0.75"
        max="1.1"
        step="0.01"
        value={voiceoverRate}
        on:input={onVoiceRateInput}
      />
    </label>
  {/if}
  <label class="metaRange">
    Pad {Math.round(focusPaddingRatio * 100)}%
    <input
      type="range"
      min="0"
      max="0.5"
      step="0.01"
      value={focusPaddingRatio}
      on:input={onPadInput}
    />
  </label>
  {#if recordingError}
    <p class="metaWarn">{recordingError}</p>
  {/if}
  {#if !voiceoverSupported}
    <p class="metaWarn">Voice preview unavailable in this browser.</p>
  {/if}
  {#if voiceoverError}
    <p class="metaWarn">{voiceoverError}</p>
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

  .metaTop button {
    border: 1px solid #838b85;
    padding: 4px 10px;
    background: #000;
    color: #838b85;
    font-size: 13px;
    cursor: pointer;
  }

  .metaTop button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .metaRange {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #838b85;
    padding: 4px 8px;
    background: #000;
    color: #838b85;
    font-size: 13px;
  }

  .metaRange input {
    width: 100px;
  }

  .metaRange select {
    width: 180px;
    border: 1px solid #838b85;
    background: #000;
    color: #838b85;
    font-size: 13px;
  }
</style>
