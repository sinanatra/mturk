<script>
    import Text_2 from "@components/texts/Text_2.svelte";
    import Map from "@components/Map.svelte";
    import Gallery from "@components/Gallery.svelte";
    import imageIndex from "$lib/image-index.json";

    import { csv } from "d3";
    import { onMount } from "svelte";

    let data = [];

    function extractImageId(source) {
        const raw = String(source || "");
        if (!raw) return "";
        const byQuery = raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
        if (byQuery?.[1]) return byQuery[1];
        const byDrive = raw.match(/\/d\/([A-Za-z0-9_-]+)/);
        if (byDrive?.[1]) return byDrive[1];
        const byPath = raw.match(
            /cables\/images\/([A-Za-z0-9_-]+)\.[A-Za-z0-9]+$/,
        );
        if (byPath?.[1]) return byPath[1];
        return "";
    }

    function imageCandidates(source) {
        const raw = String(source || "").trim();
        if (!raw) return [];

        if (raw.startsWith("/images/")) return [raw];

        const id = extractImageId(raw);
        const candidates = [];

        if (id) {
            const filename = imageIndex[id];
            if (filename) candidates.push(`/images/${filename}`);
        }

        candidates.push(raw);
        return [...new Set(candidates)];
    }

    let task1Idx = 0;
    let task3Idx = 0;

    onMount(async (d) => {
        data = await csv("exausting.csv");

        data = data
            .filter((d) => d.task_1)
            .map((d) => ({ ...d }));
    });

    let counter = 0;
    const incr = () => (counter += 1 % data.length);

    $: datum = data[counter];
    $: {
        task1Idx = 0;
        task3Idx = 0;
    }
    $: task1Candidates = imageCandidates(datum?.task_1_url);
    $: task3Candidates = imageCandidates(datum?.task_3);
    $: task1Src = task1Candidates[task1Idx] || "";
    $: task3Src = task3Candidates[task3Idx] || "";
</script>

{#if data.length == 0}
    <article>Loading...</article>
{:else}
    <article class="container" style="--color-1:#ffe0e0; --color-2:#f2f2f2;">
        <Text_2 />

        <div class="inner-container">
            <section class="counter">
                <p>
                    {counter + 1} of {data.length}
                </p>
                {#if counter > 0}
                    <button on:click={() => (counter -= 1)}>Previous</button>
                {/if}
                {#if counter < data.length}
                    <button on:click={() => (counter += 1)}>Next</button>
                {/if}
            </section>

            <section class="columns">
                <section class="task">
                    <div>
                        <h4 style="color:grey">
                            What can you see from outside of the windows?
                        </h4>
                        <div>
                            <img
                                src={task1Src}
                                alt=""
                                on:error={() => {
                                    if (task1Idx < task1Candidates.length - 1)
                                        task1Idx += 1;
                                }}
                            />
                        </div>
                    </div>
                    <p>{datum.city_1}</p>
                </section>
                <section class="task">
                    <div>
                        <h4 style="color:grey">
                            What do you see in the picture?
                        </h4>
                        <p>{datum.task_2}</p>
                        {#if datum.task_2_diff}
                            <hr />
                            <h4 style="color:grey">
                                How does it differ to your daily life?
                            </h4>
                            <p>{datum.task_2_diff}</p>
                        {/if}
                    </div>
                    <p>{datum.city_2}</p>
                </section>
                <section class="task">
                    <div>
                        <h4 style="color:grey">
                            Make a drawing of the written text on a piece of
                            paper.
                        </h4>
                        <div>
                            <img
                                src={task3Src}
                                alt=""
                                on:error={() => {
                                    if (task3Idx < task3Candidates.length - 1)
                                        task3Idx += 1;
                                }}
                            />
                        </div>
                    </div>
                    <p>{datum.city_3}</p>
                </section>
            </section>
        </div>
    </article>
{/if}

<style>
    article {
        display: flex;
        height: 100vh;
        background-color: var(--color-2);
        overflow: hidden;
    }

    .columns {
        display: flex;
        height: 100vh;
        width: calc(100vw - 330px);
        overflow: scroll;
    }

    section {
        font-family: "terminal-grotesque", sans-serif;
        padding: 5px;
        flex: 1;
    }

    .task {
        min-width: 330px;
        min-height: 500px;
        border-right: 1px dashed var(--bg);
    }

    .task > div {
        min-height: 600px;
    }

    img {
        width: 100%;
        object-fit: contain;
        object-position: top left;
    }

    .counter {
        font-family: "terminal-grotesque", sans-serif;
        font-size: 1.45rem;
        display: block;
        text-align: center;
        width: 100%;
        padding-bottom: 5px;
        border-bottom: 1px dashed var(--bg);
        cursor: pointer;
    }
    button {
        cursor: pointer;
    }

    @media all and (max-width: 650px) {
        .container {
            overflow: scroll;
            display: block;
        }

        .columns {
            width: 100vw;
        }
    }
</style>
