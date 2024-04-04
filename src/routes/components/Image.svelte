<script>
    import { selected } from "../lib/stores/selected";
    export let data;
    let selectedElement;

    let scroll = true;

    $: {
        $selected;
        if (
            scroll &&
            selectedElement &&
            selectedElement.classList.contains("selected")
        ) {
            console.log(selectedElement.classList);
            selectedElement.scrollIntoView({
                behavior: "smooth",
                block: "end",
                inline: "nearest",
            });
        }
    }
</script>

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
        class:selected={$selected == data["img"]}
        bind:this={selectedElement}
    />
</a>
<h4>{data["city"]}</h4>

<style>
    .selected {
        background: #fff9d2;
    }

    img {
        cursor: pointer;
        width: 100%;
        height: 130px;
        object-fit: cover;
        filter: grayscale(100%) opacity(0.5);
    }

    h4 {
        font-size: 1rem;
    }
</style>
