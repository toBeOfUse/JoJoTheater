<template>
    <div
        class="inhabitant-container"
        ref="inhabitantContainer"
        v-html="markup"
    ></div>
</template>

<script lang="ts">
/**
 * I will admit, this component is kind of rough. Instead of making dedicated
 * Vue template files for each inhabitant type that can be displayed, this
 * component receives the source of the SVG for the "inhabitant" as a prop,
 * places it within the root element, and then modifies it imperatively based on
 * the other props.
 */

import {
    defineComponent,
    nextTick,
    onMounted,
    onUnmounted,
    ref,
    watch,
} from "vue";
import { getOptimizedImageURL } from "../../endpoints";
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
        inhabitantMarkup: {
            type: String,
            required: true,
        },
    },
    setup(props) {
        const inhabitantContainer = ref<null | HTMLDivElement>(null);
        let prevParentSpaceHeight = -1;
        let prevMarkup = "";

        const setSizes = () => {
            const parentSpace = findParentSpace();
            if (!parentSpace || !inhabitantContainer.value) return;
            const svgElement = inhabitantContainer.value.querySelector(
                "svg"
            ) as SVGSVGElement;
            if (!svgElement) return;
            const height = parentSpace.offsetHeight;
            // only create new sizes for the SVG if the parent element's height
            // or incoming svg file have actually changed (or this is the first
            // time this function is running and prevParentSpaceHeight is still
            // set to -1)
            if (
                height == prevParentSpaceHeight &&
                props.inhabitantMarkup == prevMarkup
            ) {
                return;
            } else {
                prevParentSpaceHeight = height;
                prevMarkup = props.inhabitantMarkup;
            }
            const nativeWidth = Number(svgElement.getAttribute("width"));
            const nativeHeight = Number(svgElement.getAttribute("height"));
            const scaleFactor = height / nativeHeight;
            svgElement.setAttribute("width", String(nativeWidth * scaleFactor));
            svgElement.setAttribute(
                "height",
                String(nativeHeight * scaleFactor)
            );
        };
        window.addEventListener("resize", setSizes);
        onUnmounted(() => window.removeEventListener("resize", setSizes));
        const initializeSVG = async () => {
            const markup = props.inhabitantMarkup;
            const parentSpace = findParentSpace();
            if (!parentSpace) {
                console.error(
                    "could not find #inhabitant-space parent " +
                        "while initializing inhabitant svg!"
                );
                return;
            }
            if (!inhabitantContainer.value) {
                console.error("premature inhabitant svg initialization!");
                return;
            }
            inhabitantContainer.value.innerHTML = markup;
            await nextTick();
            const svgElement = inhabitantContainer.value.querySelector(
                "svg"
            ) as SVGSVGElement;
            const avatarImage = svgElement.querySelector(
                ".seated-avatar"
            ) as SVGImageElement;
            svgElement.classList.add("svg-inhabitant");
            setSizes();
            const avatar = avatars.find((a2) => a2.path == props.avatarURL);
            const avatarURL = getOptimizedImageURL({
                path: props.avatarURL,
                width:
                    avatarImage.getBoundingClientRect().width *
                    window.devicePixelRatio,
                flip: avatar && avatar.facing == Direction.left,
            });
            avatarImage.setAttribute("href", avatarURL);
            const keyboard = svgElement.querySelector(
                ".seated-keyboard"
            ) as HTMLElement;
            if (
                keyboard &&
                keyboard.tagName == "image" &&
                !keyboard.getAttribute("href")?.startsWith("data:image") &&
                !keyboard.getAttribute("xlink:href")?.startsWith("data:image")
            ) {
                keyboard.setAttribute("href", "/images/scenes/keyboard.png");
                keyboard.removeAttribute("xlink:href");
            }
            setInhabitantVisuals();
        };
        const findParentSpace = (): null | HTMLElement => {
            if (!inhabitantContainer.value) {
                return null;
            }
            let space: HTMLElement = inhabitantContainer.value;
            while (space.id != "inhabitant-space" && space.parentElement) {
                space = space.parentElement;
            }
            if (!space) {
                console.error("could not find inhabitant-space element");
            }
            return space;
        };
        const setInhabitantVisuals = () => {
            if (inhabitantContainer.value) {
                const svgElement =
                    inhabitantContainer.value.querySelector("svg");
                if (svgElement) {
                    const keyboard = svgElement.querySelector(
                        ".seated-keyboard"
                    ) as HTMLElement;
                    if (keyboard) {
                        keyboard.style.opacity = props.typing ? "1" : "";
                        const animation =
                            keyboard.getAttribute("data-animation") ??
                            "verticalshake";
                        keyboard.style.animationName = props.typing
                            ? animation
                            : "";
                    }
                }
            }
        };
        const markup = ref("");
        onMounted(initializeSVG);
        watch(() => props.typing, setInhabitantVisuals);
        watch(() => props.inhabitantMarkup, initializeSVG);
        // here we can see whether we are visible in the parent element,
        // scrolled offscreen within it to the left, or scrolled offscreen
        // within it to the right; this property is for the consumption of the
        // parent element so that it can display a count of how many inhabitants are
        // offscreen
        const placement = (): "left" | "middle" | "right" | null => {
            if (!inhabitantContainer.value) {
                return null;
            } else {
                const space = findParentSpace();
                if (!space) {
                    return null;
                } else {
                    const width = space.offsetWidth;
                    const ourWidth = inhabitantContainer.value.offsetWidth;
                    const scrollPos = space.scrollLeft;
                    const ourPos = inhabitantContainer.value.offsetLeft;
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
        return { inhabitantContainer, placement, markup };
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
.inhabitant-container {
    position: relative;
    margin: 0 5px;
    height: 100%;
}
.svg-inhabitant {
    overflow: visible;
    image {
        background-color: white;
    }
    .seated-keyboard {
        // animation-name: verticalshake is applied in setInhabitantVisuals()
        animation-duration: 0.25s;
        animation-iteration-count: infinite;
        animation-direction: alternate;
        animation-timing-function: linear;
        transition: opacity 0.1s linear;
        opacity: 0;
    }
}
</style>
