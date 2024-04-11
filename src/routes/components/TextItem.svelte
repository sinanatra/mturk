<script>
    import { onMount } from "svelte";
    import { selected } from "@stores/selected";
    export let data;
    export let idx;

    let selectedElement;
    let parentElement;
    let scroll = true;

    onMount(() => {
        parentElement = selectedElement.parentElement;
    });

    $: {
        if (selectedElement && scroll === true && $selected == data.id) {
            selectedElement.parentElement.scrollTo({
                top: selectedElement.offsetTop,
                behavior: "smooth",
            });
        }
    }
</script>

<div
    on:mouseover={() => {
        scroll = false;
        $selected = data?.id;
    }}
    on:focus={() => {}}
    bind:this={selectedElement}
>
    <p class:selected={$selected == data["img"] || $selected == data["id"]}>
        {data.text}
    </p>
    <h4>{data.city}</h4>
</div>

<style>
    div {
        border-bottom: 1px solid;
        padding: 10px 0;
    }

    .selected {
        font-style: italic;
    }
</style>
