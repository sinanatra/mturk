<script>
    import { selected } from "../lib/stores/selected";
    import { onMount } from "svelte";

    export let data;
    let selectedElement;
    let parentElement;

    let scroll = true;
    let imageCandidates = [];
    let imageCandidateIndex = 0;

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

    function normalizePath(path) {
        if (!path) return "";
        return path.startsWith("/") ? path : `/${path}`;
    }

    function extractImageId(source) {
        const raw = String(source || "");
        if (!raw) return "";
        const byQuery = raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
        if (byQuery?.[1]) return byQuery[1];
        const byDrive = raw.match(/\/d\/([A-Za-z0-9_-]+)/);
        if (byDrive?.[1]) return byDrive[1];
        const byPath = raw.match(/cables\/images\/([A-Za-z0-9_-]+)\.[A-Za-z0-9]+$/);
        if (byPath?.[1]) return byPath[1];
        return "";
    }

    function buildImageCandidates(source) {
        const raw = String(source || "").trim();
        if (!raw) return [];
        if (raw.includes("cables/images/")) {
            return [normalizePath(raw.replace(/^https?:\/\/[^/]+\//, ""))];
        }

        const id = extractImageId(raw);
        if (!id) return [raw];

        const local = [
            `/images/${id}.jpg`,
            `/images/${id}.jpeg`,
            `/images/${id}.png`,
            `/images/${id}.webp`,
            `/images/${id}.gif`,
            `/cables/images/${id}.jpg`,
            `/cables/images/${id}.jpeg`,
            `/cables/images/${id}.png`,
            `/cables/images/${id}.webp`,
            `/cables/images/${id}.gif`,
        ];
        return local;
    }

    function onImageError() {
        if (imageCandidateIndex < imageCandidates.length - 1) {
            imageCandidateIndex += 1;
        }
    }

    $: imageCandidates = buildImageCandidates(data?.["img"]);
    $: if (imageCandidateIndex >= imageCandidates.length) {
        imageCandidateIndex = 0;
    }
    $: imageSrc = imageCandidates[imageCandidateIndex] || "";
</script>

<div class:selected={$selected == data["img"]} bind:this={selectedElement}>
    <a href={imageSrc || data["img"]} target="_blank" rel="noopener noreferrer">
        <img
            src={imageSrc}
            alt=""
            srcset=""
            on:error={onImageError}
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
