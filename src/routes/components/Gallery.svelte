<script>
    import Image from "./Image.svelte";
    export let data;
</script>

<section class="gallery">
    {#each data as d}
        <div>
            <Image data={d} />
        </div>
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

    div {
        width: 25%;
    }

    div:hover {
        background: #fff9d2;
    }
</style>
