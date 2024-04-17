<script>
    import { tsv } from "d3";
    import P5 from "p5-svelte";
    import { onMount } from "svelte";
    let width;
    let height;

    let data = [];
    let comments = [];
    onMount(async (d) => {
        data = await tsv("opinions_out.tsv");
        comments = data
            .flatMap((d) => {
                return d.text.split(". ").map((text) => ({ text, id: d.id }));
            })
            .flatMap((d) => {
                if (d.text.length > 200) {
                    return d.text
                        .split(",")
                        .map((text) => ({ text, id: d.id }));
                } else {
                    return d;
                }
            })
            .filter((d) => d.text && d.text.length > 2);
    });

    let nr = 0;
    let idx = 0;
    let textSize = 12;
    let speed = 6;
    let xPrev, yPrev, idPrev;
    let color = [0, 100, 0];
    let font;
    let invert = false;

    const sketch = (s) => {
        s.preload = () => {
            font = s.loadFont("terminal-grotesque.woff");
        };
        s.setup = () => {
            s.createCanvas(width, height);
            s.colorMode(s.HSL);
            s.textFont(font);
        };

        // s.mousePressed = () => {
        //     speed = 1;
        // };

        // s.mouseReleased = () => {
        //     speed = 10;
        // };

        s.draw = () => {
            s.background(0, 0, 0, 0.05);
            s.frameRate(speed);
            s.textSize(textSize);

            idx = (idx + 1) % comments.length;

            let y = height - 10;
            let x = (width / 4) * s.sin(s.frameCount * 0.2) + width / 4;
            nr = (nr + textSize + 4) % height;

            // invert sin
            if (nr <= 20) {
                x = -x;
            }

            if (idPrev == comments[idx].id) {
                s.stroke(...color, 0.6);
                if (yPrev >= 5) {
                    s.strokeWeight(1);
                    s.line(xPrev, yPrev, x, y - nr, 0);
                }
            } else {
                color = [idx + (10 % 360), 20, 50];
                nr = nr + textSize + 14;
            }
            s.fill(...color);
            s.stroke(0);
            s.strokeWeight(textSize / 3);
            s.text(comments[idx].text, x + 20, y - nr);
            xPrev = x;
            yPrev = y - nr;
            idPrev = comments[idx].id;
        };
    };
</script>

{#if data.length == 0}
    <article>Loading...</article>
{:else}
    <article bind:clientWidth={width} bind:clientHeight={height}>
        <section>
            <label>
                Font Size
                <input
                    type="range"
                    bind:value={textSize}
                    min="5"
                    max="44"
                    step="1"
                />
                {textSize}
            </label>
            <label>
                Speed
                <input
                    type="range"
                    bind:value={speed}
                    min="1"
                    max="20"
                    step="1"
                />
                {speed}
            </label>
        </section>
        <P5 {sketch} />
    </article>
{/if}

<style>
    :global(body) {
        padding: 0;
        margin: 0;
    }

    section {
        margin-bottom: 20px;
        /* display: flex; */
        gap: 10px;
    }

    article {
        font-family: sans-serif;
        background-color: black;
        color: white;
        /* display: flex; */
        min-height: 100vh;
        font-size: 12px;
        padding: 0px 10px;
    }
</style>
