<template>
    <a target="_blank" :href="href" rel="noopener noreferrer"><slot></slot></a>
</template>
<script>
import { defineComponent } from "vue";
export default defineComponent({
    props: {
        href: {
            type: String,
            required: true,
        },
    },
});
</script>