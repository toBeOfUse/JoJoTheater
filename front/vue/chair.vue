<template>
    <div class="chair-container" ref="chairContainer" v-html="markup"></div>
</template>

<script lang="ts">
/**
 * I will admit, this component is kind of rough. Instead of making dedicated
 * Vue template files for each "chair" that can be displayed, this component
 * receives the source of the SVG for the "chair" as a prop, places it within
 * the root element, and then modifies it imperatively based on the other
 * props.
 */

import { defineComponent, nextTick, onMounted, ref, watch } from "vue";
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
        chairMarkup: {
            type: String,
            required: true,
        },
    },
    setup(props) {
        const chairContainer = ref<null | HTMLDivElement>(null);
        const initializeSVG = async () => {
            const markup = props.chairMarkup;
            const parentSpace = findParentSpace();
            if (!parentSpace) {
                console.error(
                    "could not find #chair-space parent " +
                        "while initializing chair svg!"
                );
                return;
            }
            if (!chairContainer.value) {
                console.error("premature chair svg initialization!");
                return;
            }
            const height = parentSpace.offsetHeight;
            chairContainer.value.innerHTML = markup;
            await nextTick();
            const svgElement = chairContainer.value.querySelector(
                "svg"
            ) as SVGSVGElement;
            const avatarImage = svgElement.querySelector(
                ".seated-avatar"
            ) as SVGImageElement;
            svgElement.classList.add("svg-chair");
            const nativeWidth = Number(svgElement.getAttribute("width"));
            const nativeHeight = Number(svgElement.getAttribute("height"));
            const scaleFactor = height / nativeHeight;
            svgElement.setAttribute("width", String(nativeWidth * scaleFactor));
            svgElement.setAttribute(
                "height",
                String(nativeHeight * scaleFactor)
            );
            const avatar = avatars.find((a2) => a2.path == props.avatarURL);
            let avatarURL =
                "/imgopt?path=" + encodeURIComponent(props.avatarURL);
            if (avatar && avatar.facing == Direction.left) {
                avatarURL += "&flip=true";
            }
            avatarURL +=
                "&width=" +
                avatarImage.getBoundingClientRect().width *
                    window.devicePixelRatio;
            avatarImage.setAttribute("href", avatarURL);
            const keyboard = svgElement.querySelector(
                ".seated-keyboard"
            ) as HTMLElement;
            if (keyboard.tagName == "image") {
                keyboard.setAttribute("href", "/images/rooms/keyboard.png");
            }
            setChairVisuals();
        };
        const findParentSpace = (): null | HTMLElement => {
            if (!chairContainer.value) {
                return null;
            }
            let space: HTMLElement = chairContainer.value;
            while (space.id != "chair-space" && space.parentElement) {
                space = space.parentElement;
            }
            if (!space) {
                console.error("could not find chair-space element");
            }
            return space;
        };
        const setChairVisuals = () => {
            if (chairContainer.value) {
                const svgElement = chairContainer.value.querySelector("svg");
                if (svgElement) {
                    const keyboard = svgElement.querySelector(
                        ".seated-keyboard"
                    ) as HTMLElement;
                    keyboard.style.opacity = props.typing ? "1" : "";
                    keyboard.style.animationName = props.typing
                        ? "verticalshake"
                        : "";
                }
            }
        };
        const markup = ref("");
        onMounted(initializeSVG);
        watch(() => props.typing, setChairVisuals);
        watch(() => props.chairMarkup, initializeSVG);
        // here we can see whether we are visible in the parent element,
        // scrolled offscreen within it to the left, or scrolled offscreen
        // within it to the right; this property is for the consumption of the
        // parent element so that it can display a count of how many chairs are
        // offscreen
        const placement = (): "left" | "middle" | "right" | null => {
            if (!chairContainer.value) {
                return null;
            } else {
                const space = findParentSpace();
                if (!space) {
                    return null;
                } else {
                    const width = space.offsetWidth;
                    const ourWidth = chairContainer.value.offsetWidth;
                    const scrollPos = space.scrollLeft;
                    const ourPos = chairContainer.value.offsetLeft;
                    if (ourPos + ourWidth - ourWidth / 2 < scrollPos) {
                        return "left";
                    } else if (ourPos + ourWidth / 2 > scrollPos + width) {
                        return "right";
                    } else {
                        return "middle";
                    }
                }
            }
        };
        return { chairContainer, placement, markup };
    },
});
</script>

<style lang="scss">
@keyframes verticalshake {
    0% {
        transform: translateY(-3px);
    }
    40% {
        transform: translateY(1px);
    }
    100% {
        transform: translateY(3px);
    }
}
.chair-container {
    position: relative;
    margin: 0 5px;
    height: 100%;
}
.svg-chair {
    overflow: visible;
    image {
        background-color: white;
    }
    .seated-keyboard {
        // animation-name: verticalshake is applied in setChairVisuals()
        animation-duration: 0.25s;
        animation-iteration-count: infinite;
        animation-direction: alternate;
        animation-timing-function: linear;
        transition: opacity 0.1s linear;
        opacity: 0;
    }
}
</style>
