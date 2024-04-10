<script>
    import TextItem from "@components/TextItem.svelte";
    import { sort } from "d3";
    export let data;
</script>

<section>
    {#each data as d, i}
        <TextItem data={d} idx={i} />
    {/each}
</section>

<style>
    section {
        flex: 2;
        overflow: scroll;
        word-wrap: break-word;
        background-color: var(--color-2);
    }
</style>
