<script>
    import { selected } from "../lib/stores/selected";
    import { onMount } from "svelte";

    export let data;
    let selectedElement;
    let parentElement;

    let scroll = true;

    onMount(() => {
        parentElement = selectedElement.parentElement;
    });

    $: {
        if (scroll && $selected == data["img"] && parentElement) {
            parentElement.scrollTo({
                top: selectedElement.offsetTop,
                behavior: "smooth",
            });
        }
    }
</script>

<div class:selected={$selected == data["img"]} bind:this={selectedElement}>
    <a href={data["img"]} target="_blank" rel="noopener noreferrer">
        <img
            src="https://lh3.googleusercontent.com/d/{data['img'].replace(
                'https://drive.google.com/u/0/open?usp=forms_web&id=',
                '',
            )}"
            alt=""
            srcset=""
            onerror="this.style.visibility='hidden'"
            on:mouseover={() => {
                scroll = false;
                $selected = data["img"];
            }}
            on:focus={() => {
                scroll = false;
                $selected = data["img"];
            }}
        />
    </a>
    <h4>{data["city"]}</h4>
</div>

<style>
    img {
        cursor: pointer;
        width: 100%;
        height: 130px;
        object-fit: cover;
        filter: grayscale(100%) opacity(0.5);
    }

    a {
        line-height: 0;
        display: block;
    }

    h4 {
        padding: 0px;
        padding-bottom: 4px;
    }

    div {
        width: 25%;
    }

    div:hover,
    .selected {
        background: var(--color-1);
    }

    h4 {
        font-size: 1rem;
    }
</style>
