<script>
    import { selected } from "../lib/stores/selected";
    export let data;
    let selectedElement;

    let scroll = true;

    $: {
        if ($selected == data["img"] && selectedElement) {
            selectedElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest",
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
