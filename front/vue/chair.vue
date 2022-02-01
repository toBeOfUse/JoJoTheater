<template>
    <div class="chair-container" ref="chairContainer" v-html="svgSource"></div>
</template>

<script lang="ts">
/**
 * I will admit, this component is kind of rough. Instead of making dedicated
 * Vue template files for each "chair" that can be displayed, I'm loading SVGs
 * as text, setting them as the innerHTML of the component's root element, and
 * then making imperative programatic changes to certain elements inside.
 */

import { defineComponent, ref, nextTick, watch, onMounted } from "vue";
import { avatars, Direction } from "./avatars";

export default defineComponent({
    props: {
        avatarURL: {
            type: String,
            required: true,
        },
        typing: {
            type: Boolean,
            required: true,
        },
        chairURL: {
            type: String,
            required: true,
        },
    },
    setup(props) {
        const chairContainer = ref<null | HTMLDivElement>(null);
        let initialized = false;
        const setChairVisuals = () => {
            if (chairContainer.value) {
                const svgElement = chairContainer.value.querySelector("svg");
                if (svgElement) {
                    const keyboard = svgElement.querySelector(
                        ".seated-keyboard"
                    ) as HTMLElement;
                    if (!initialized) {
                        const avatarImage = svgElement.querySelector(
                            ".seated-avatar"
                        ) as SVGImageElement;
                        svgElement.classList.add("svg-chair");
                        const avatar = avatars.find(
                            (a2) => a2.path == props.avatarURL
                        );
                        let avatarURL =
                            "/imgopt?path=" +
                            encodeURIComponent(props.avatarURL);
                        if (avatar && avatar.facing == Direction.left) {
                            avatarURL += "&flip=true";
                        }
                        avatarURL +=
                            "&width=" +
                            avatarImage.getBoundingClientRect().width *
                                window.devicePixelRatio;
                        avatarImage.setAttribute("href", avatarURL);
                        keyboard.setAttribute(
                            "href",
                            "/images/rooms/keyboard.png"
                        );
                        initialized = true;
                    }
                    console.log("props.typing is", props.typing);
                    keyboard.style.display = props.typing ? "unset" : "none";
                }
            }
        };
        const svgSource = ref("");
        onMounted(() => {
            fetch(props.chairURL).then(async (response) => {
                svgSource.value = await response.text();
                await nextTick();
                setChairVisuals();
            });
        });
        watch(() => props.typing, setChairVisuals);
        return { chairContainer, svgSource };
    },
});
</script>

<style lang="scss">
.chair-container {
    position: relative;
    margin: 0 5px;
}
.svg-chair {
    height: 150px;
    @media (max-width: 450px) {
        height: 70px;
    }
    width: auto;
    overflow: visible;
    image {
        background-color: white;
    }
}
</style>
