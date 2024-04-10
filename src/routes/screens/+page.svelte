<script>
    import Text_3 from "@components/texts/Text_3.svelte";
    import Map from "@components/Map.svelte";
    import Gallery from "@components/Gallery.svelte";

    import { tsv } from "d3";
    import { onMount } from "svelte";

    let data = [];
    onMount(async (d) => {
        data = await tsv("desktop_out.tsv");
    });
</script>

{#if data.length == 0}
    <article>Loading...</article>
{:else}
    <article class="container" style="--color-1:#acb2c8; --color-2:#a79bb4;">
        <Text_3 />
        <Map {data} />
        <Gallery {data} />
    </article>
{/if}

<style>
    article {
        display: flex;
        height: 100vh;
        overflow: hidden;
    }

    @media all and (max-width: 650px) {
        .container {
            overflow: scroll;
            display: block;
        }
    }
</style>
