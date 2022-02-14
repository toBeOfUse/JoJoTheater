<template>
    <img :src="cdnURL" ref="img" :style="style" />
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
        const style = ref<any>({});
        const img = ref<HTMLImageElement | null>(null);
        // image is initially a single transparent png pixel (if the src starts out
        // blank, chrome (and others?) won't give the image a width)
        const cdnURL = ref(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcS" +
                "JAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg=="
        );
        onMounted(() => {
            if (img.value) {
                img.value.addEventListener("load", () => {
                    style.value = {};
                });
                const baseWidth = img.value.offsetWidth;
                const width = baseWidth * (window.devicePixelRatio || 1);
                const path = encodeURIComponent(props.path);
                let url = `/imgopt?width=${width}&path=${path}`;
                if (props.flipped) {
                    url += "&flip=true";
                }
                if (props.aspectRatio) {
                    url += `&ratio=${props.aspectRatio}`;
                }
                cdnURL.value = url;
                if (props.aspectRatio) {
                    const ratioComps = props.aspectRatio.split(":").map(Number);
                    if (ratioComps[0] && ratioComps[1]) {
                        style.value = {
                            width: baseWidth + "px",
                            height:
                                baseWidth * (ratioComps[1] / ratioComps[0]) +
                                "px",
                        };
                    }
                }
            }
        });
        return { img, cdnURL, style };
    },
});
</script>

