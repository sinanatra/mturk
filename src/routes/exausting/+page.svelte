<script>
    import Text_2 from "@components/texts/Text_2.svelte";
    import Map from "@components/Map.svelte";
    import Gallery from "@components/Gallery.svelte";

    import * as d3 from "d3";
    import { onMount } from "svelte";

    let data = [];
    onMount(async (d) => {
        data = await d3.csv("exausting.csv");

        data = data
            .filter((d) => d.task_1)
            .map((d) => {
                return {
                    ...d,
                    task_1_url: d.task_1_url.replace(
                        "https://drive.google.com/uc?export=view&id=",
                        "https://lh3.googleusercontent.com/d/",
                    ),
                    task_3: d.task_3
                        ? d.task_3?.replace(
                              "https://drive.google.com/uc?export=view&id=",
                              "https://lh3.googleusercontent.com/d/",
                          )
                        : undefined,
                };
            });
    });

    let counter = 0;
    const incr = () => (counter += 1 % data.length);

    $: datum = data[counter];
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
                <button on:click={() => (counter += 1)}>Next</button>
            </section>

            <section class="columns">
                <section class="task">
                    <div>
                        <img src={datum.task_1_url} alt="" />
                    </div>
                    <p>{datum.city_1}</p>
                </section>
                <section class="task">
                    <div>
                        <p style="color:grey">
                            What do you see in the picture?
                        </p>
                        <p>{datum.task_2}</p>
                        {#if datum.task_2_diff}
                            <hr />
                            <p style="color:grey">
                                How does it differ to your daily life?
                            </p>
                            <p>{datum.task_2_diff}</p>
                        {/if}
                    </div>
                    <p>{datum.city_2}</p>
                </section>
                <section class="task">
                    <div>
                        <img src={datum.task_3} alt="" />
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
        min-width: 430px;
        min-height: 500px;
        border-right: 1px dashed var(--bg);
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
