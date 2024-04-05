<script>
    import Intro from "@components/texts/Intro.svelte";
    import Text_1 from "@components/texts/Text_1.svelte";
    import Text_2 from "@components/texts/Text_2.svelte";
    import Text_3 from "@components/texts/Text_3.svelte";
</script>

<article class="container">
    <div style="--color-1:#8d9a8f; --color-2:#ffe0e0;">
        <Intro />
    </div>
    <a href="views">
        <Text_1 />
    </a>
    <!-- <a href="screens" style="--color-1:#d2e5ff; --color-2:#ead7fe;">
        <Text_2 />
    </a> -->
    <a href="exausting" style="--color-1:#ffe0e0; --color-2:#efefef;">
        <Text_3 />
    </a>
</article>

<style>
    a {
        color: unset;
        text-decoration: none;
    }

    a:hover {
        opacity: 0.8;
    }

    article {
        display: flex;
        height: 100vh;
        width: 100%;
        background: gainsboro;
    }

    .container > * {
        display: flex;
        margin: 0;
        padding: 0;
    }
    .container a:last-of-type {
        box-shadow: 7px -7px 16px -8px black;
    }

    @media all and (max-width: 650px) {
        .container {
            overflow: scroll;
            display: block;
        }
    }
</style>
