<script>
    import Image from "./Image.svelte";
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
        background: #1a1a1a;
        display: flex;
        flex-wrap: wrap;
        overflow: scroll;
        color: #838b85;
    }
</style>
