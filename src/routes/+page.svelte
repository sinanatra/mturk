<script>
    import Intro from "@components/texts/Intro.svelte";
    import Text_1 from "@components/texts/Text_1.svelte";
    import Text_2 from "@components/texts/Text_2.svelte";
    import Text_3 from "@components/texts/Text_3.svelte";
    import Text_4 from "@components/texts/Text_4.svelte";
    import Outro from "@components/texts/Outro.svelte";
</script>

<article class="container">
    <div style="--color-1:#8d9a8f">
        <Intro />
    </div>
    <a href="views">
        <Text_1 />
    </a>
    <a href="exausting" style="--color-1:#ffe0e0">
        <Text_2 />
    </a>
    <a href="screens" style="--color-1:#acb2c8">
        <Text_3 />
    </a>
    <a href="opinions" style="--color-1:#aec8ac">
        <Text_4 />
    </a>
    <div style="--color-1:#c2c2c2">
        <Outro />
    </div>
</article>

<style>
    a {
        color: unset;
        text-decoration: none;
    }

    a:hover {
        color: red;
    }

    article {
        display: flex;
        height: 100vh;
        width: 100%;
        background: gainsboro;
        overflow: scroll;
    }

    .container > * {
        min-width: 350px;
        display: block;
        height: 100%;
        margin: 0;
        padding: 0;
        position: sticky;
        left: 0;
        top: 0;
        z-index: 10;
        opacity: 1;
        overflow: scroll;
    }

    .container > *:last-child {
        box-shadow: 7px -7px 16px -8px black;
        margin-right: 40vw;
        background: red !important;
    }
</style>
