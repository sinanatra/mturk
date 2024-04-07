<script>
    import Text_1 from "@components/texts/Text_1.svelte";
    import Map from "@components/Map.svelte";
    import Gallery from "@components/Gallery.svelte";

    import * as d3 from "d3";
    import { onMount } from "svelte";

    let data = [];
    onMount(async (d) => {
        data = await d3.tsv("windows.tsv");
    });
</script>

{#if data.length == 0}
    <article>Loading...</article>
{:else}
    <article class="container">
        <Text_1 />
        <Map {data} />
        <Gallery {data} />
    </article>
{/if}

<style>
    article {
        display: flex;
        height: 100vh;
    }

    @media all and (max-width: 650px) {
        .container {
            overflow: scroll;
            display: block;
        }
    }
</style>
