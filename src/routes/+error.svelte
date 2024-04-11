<script>
    import { page } from "$app/stores";
</script>

<article>
    <h1>{$page.error.message}</h1>
</article>

<style>
    article {
        padding: 5px;
    }
    h1,
    p {
        padding: 0;
    }
</style>
