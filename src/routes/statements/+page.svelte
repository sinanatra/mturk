<script>
  import { tsv } from "d3";
  import { onMount } from "svelte";
  import { base } from "$app/paths";

  let statements = [];

  onMount(async () => {
    const rows = await tsv(`${base}/opinions_out.tsv`);
    statements = rows.filter((row) => row.text && row.text.trim().length > 2);
  });
</script>

<div class="page">
  <header>
    <h1>
      What do you like and detest about working for Amazon Mechanical Turk?
    </h1>
    <h2>
      Why do you do it? Please share your honest feelings and opinions on the
      platform.
    </h2>
  </header>

  {#each statements as s}
    <p class="statement">
      {#if s.id}<span class="meta">{s.id}</span>{/if}
      {s.text.trim()}
      {#if s.city}<span class="meta">{s.city}</span>{/if}
    </p>
  {/each}
</div>

<style>
  .page {
    min-height: 100vh;
    box-sizing: border-box;
    margin: 0;
    padding: 10px;
    background: white;
    color: black;
    font-family: "Helvetica", sans-serif;
    font-size: 28px;
    text-rendering: optimizeLegibility;
  }

  .page > :global(*) {
    max-width: 1024px;
  }

  * {
    font-family: "Helvetica", sans-serif;
  }

  header {
    margin-bottom: 100px;
  }
  h1,
  p {
    font-weight: 400;
    font-family: inherit;
    font-size: inherit;
  }

  h1 {
    font-size: 2em;
    line-height: 1.15;
  }

  p {
    margin: 1em 0;
    line-height: 1.25;
  }

  .meta {
    color: #888;
  }
</style>
