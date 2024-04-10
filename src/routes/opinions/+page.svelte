<script>
    import Text_4 from "@components/texts/Text_4.svelte";
    import Map from "@components/Map.svelte";
    import TextViz from "@components/TextViz.svelte";

    import { tsv } from "d3";
    import { onMount } from "svelte";

    let data = [];
    onMount(async (d) => {
        data = await tsv("opinions_out.tsv");
    });
</script>

{#if data.length == 0}
    <article>Loading...</article>
{:else}
    <article class="container" style="--color-1:#aec8ac; --color-2:#eae7d9;">
        <Text_4 />
        <Map {data} />
        <TextViz {data} />
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
