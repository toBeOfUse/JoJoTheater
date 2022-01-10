<template>
    <img :src="cdnURL" ref="img" />
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
    props: {
        path: {
            required: true,
            type: String,
        },
        flipped: {
            required: false,
            type: Boolean,
            default: false,
        },
    },
    setup(props) {
        const img = ref<HTMLImageElement | null>(null);
        const cdnURL = ref("");
        onMounted(() => {
            if (img.value) {
                const width =
                    img.value.offsetWidth * (window.devicePixelRatio || 1);
                const path = encodeURIComponent(props.path);
                cdnURL.value = `/imgopt?width=${width}&path=${path}&flip=${props.flipped}`;
            }
        });
        return { img, cdnURL };
    },
});
</script>

