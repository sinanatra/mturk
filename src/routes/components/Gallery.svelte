<script>
    import Image from "@components/Image.svelte";
    export let data;
</script>

<section class="gallery">
    {#each data as d}
        <Image data={d} />
    {/each}
</section>

<style>
    section {
        width: 100%;
        background: var(--bg);
        display: flex;
        flex-wrap: wrap;
        overflow: scroll;
        color: #838b85;
    }
</style>
