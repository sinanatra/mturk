<script>
    import { onMount } from "svelte";
    import { geoGuyou } from "d3-geo-projection";
    import { geoPath } from "d3-geo";
    import * as topojson from "topojson";
    import { selected } from "@stores/selected";

    export let data;
    let width;
    let height;

    $: projection = geoGuyou()
        .translate([width / 2, height / 2])
        .angle(-90)
        .rotate([18, -90]);

    $: path = geoPath().projection(projection);
    let features = [];

    onMount(async () => {
        const world = await fetch(
            "https://gist.githubusercontent.com/sinanatra/91a7736f19e6636592703a459a8bfe75/raw/ca86b3ea72d66a68945624f3e933445c766aa28f/pixel25.json",
        ).then((d) => d.json());

        features = topojson.feature(world, world.objects.pixel25).features;
    });
</script>

<section id="map" bind bind:clientWidth={width} bind:clientHeight={height}>
    {#if projection != undefined}
        <svg viewBox="0 0 {width} {height}">
            <g fill="#1A1A1A">
                {#each features as feature}
                    <path d={path(feature)} class="state" />
                {/each}
            </g>
            <g fill="var(--color-1)">
                {#each data as d}
                    <circle
                        role="tab"
                        tabindex="0"
                        r="3"
                        stroke="black"
                        transform="translate({projection([
                            d.Longitude,
                            d.Latitude,
                        ])})"
                        on:mouseover={() => {
                            $selected = d?.["img"] || d?.["id"];
                        }}
                        on:focus
                        class:selected={$selected == d?.["img"] ||
                            $selected == d?.["id"]}
                    />
                {/each}
            </g>
        </svg>
    {/if}
</section>

<style>
    section {
        width: 100%;
        min-width: 100px;
        max-width: 500px;
        background: var(--color-2);
    }

    circle {
        cursor: cell;
        -webkit-transition: r 0.5s;
        transition: r 0.5s;
    }

    circle:hover,
    .selected {
        r: 12;
        -webkit-transition: r 0.5s;
        transition: r 0.5s;
    }

    @media all and (max-width: 900px) {
        section {
            display: none;
        }
    }
</style>
