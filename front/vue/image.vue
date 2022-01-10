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
        aspectRatio: {
            required: false,
            type: String,
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
                let url = `/imgopt?width=${width}&path=${path}`;
                if (props.flipped) {
                    url += "&flip=true";
                }
                if (props.aspectRatio) {
                    url += `&ratio=${props.aspectRatio}`;
                }
                cdnURL.value = url;
            }
        });
        return { img, cdnURL };
    },
});
</script>

