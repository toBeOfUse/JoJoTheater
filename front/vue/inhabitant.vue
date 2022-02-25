<template>
    <div
        class="inhabitant-container"
        ref="inhabitantContainer"
        @click="menuOpen = false"
        @mouseleave="menuOpen = false"
        :style="menuOpen ? { backgroundImage: backgroundGlow } : {}"
    >
        <div v-if="isSelf" id="menu-container">
            <span @click.stop="menuOpen = !menuOpen">🌟</span>
            <div id="menu" v-if="menuOpen" @click.stop>
                That's you!
                <button v-if="morePosesAvailable" @click="requestNewPose">
                    Change Pose
                </button>
            </div>
        </div>
    </div>
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
    PropType,
    ref,
    watch,
} from "vue";
import {
    getOptimizedImageURL,
    APIPath,
    getAvatarImageURL,
} from "../../constants/endpoints";
import { Avatar, StreamsSocket } from "../../constants/types";

export default defineComponent({
    props: {
        avatar: {
            type: Object as PropType<Avatar>,
            required: true,
        },
        typing: {
            type: Boolean,
            required: true,
        },
        propsMarkup: {
            type: String,
            required: true,
        },
        isSelf: {
            type: Boolean,
            required: true,
        },
        morePosesAvailable: {
            type: Boolean,
            required: true,
        },
        socket: {
            type: Object as PropType<StreamsSocket>,
            required: true,
        },
    },
    setup(props) {
        const inhabitantContainer = ref<null | HTMLDivElement>(null);
        let prevParentSpaceHeight = -1;
        let prevMarkup = "";

        const setSizes = (svgElement?: SVGSVGElement) => {
            if (!svgElement) {
                if (inhabitantContainer.value) {
                    svgElement = inhabitantContainer.value.querySelector(
                        "svg"
                    ) as SVGSVGElement;
                    if (!svgElement) return;
                } else {
                    return;
                }
            }
            const parentSpace = findParentSpace();
            if (!parentSpace || !inhabitantContainer.value) return;
            const height = parentSpace.clientHeight;
            // only create new sizes for the SVG if the parent element's height
            // or incoming svg file have actually changed (or this is the first
            // time this function is running and prevParentSpaceHeight is still
            // set to -1)
            if (
                height == prevParentSpaceHeight &&
                props.propsMarkup == prevMarkup
            ) {
                return;
            } else {
                prevParentSpaceHeight = height;
                prevMarkup = props.propsMarkup;
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
        window.addEventListener("resize", () => setSizes());
        onUnmounted(() =>
            window.removeEventListener("resize", () => setSizes())
        );
        const initializeSVG = async () => {
            const markup = props.propsMarkup;
            const parentSpace = findParentSpace();
            if (!parentSpace) {
                console.error(
                    "could not find #inhabited-space parent " +
                        "while initializing inhabitant svg!"
                );
                return;
            }
            if (!inhabitantContainer.value) {
                console.error("premature inhabitant svg initialization!");
                return;
            }
            const placeholder = document.createElement("div");
            placeholder.insertAdjacentHTML("afterbegin", markup);
            const svgElement = placeholder.querySelector(
                "svg"
            ) as SVGSVGElement;
            svgElement.classList.add("svg-inhabitant");
            setSizes(svgElement);
            // risky to directly add an element? it doesn't seem to ever get removed though
            inhabitantContainer.value
                .querySelectorAll(".svg-inhabitant")
                .forEach((e) => e.remove());
            inhabitantContainer.value.prepend(svgElement);
            const avatarImage = svgElement.querySelector(
                ".seated-avatar"
            ) as SVGImageElement;
            const avatarURL = getOptimizedImageURL({
                path: getAvatarImageURL(props.avatar.file),
                width:
                    avatarImage.getBoundingClientRect().width *
                    window.devicePixelRatio,
                flip: props.avatar && props.avatar.facing == "left",
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
                keyboard.removeAttribute("xlink:href");
                keyboard.setAttribute("href", "/images/scenes/keyboard.png");
            }
            updateTypingIndicator();
        };
        const findParentSpace = (): null | HTMLElement => {
            if (!inhabitantContainer.value) {
                return null;
            }
            let space: HTMLElement = inhabitantContainer.value;
            while (space.id != "inhabited-space" && space.parentElement) {
                space = space.parentElement;
            }
            if (!space) {
                console.error("could not find inhabited-space element");
            }
            return space;
        };
        const updateTypingIndicator = () => {
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
        onMounted(initializeSVG);
        watch(() => props.typing, updateTypingIndicator);
        watch(() => props.propsMarkup, initializeSVG);
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

        const menuOpen = ref(false);
        // const backgroundGlow =
        //     "radial-gradient(ellipse closest-side, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0) 100%)";
        const backgroundGlow = `linear-gradient(90deg, 
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.25) 15%, 
            rgba(255,255,255,0.5) 50%,
            rgba(255,255,255,0.25) 85%,
            rgba(255,255,255,0) 100%
        )`.replace(/\n/g, " ");
        const requestNewPose = () => {
            props.socket.http(APIPath.switchProps);
        };

        return {
            inhabitantContainer,
            placement,
            menuOpen,
            backgroundGlow,
            requestNewPose,
        };
    },
});
</script>

<style lang="scss">
@use "../scss/vars";

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
    margin: 0 -15px;
    height: 100%;
    background-size: contain;
    padding: 0 20px;
}
.svg-inhabitant {
    overflow: visible;
    image {
        background-color: white;
    }
    .seated-keyboard {
        // animation-name is set according to svg data in updateTypingIndicator
        animation-duration: 0.25s;
        animation-iteration-count: infinite;
        animation-direction: alternate;
        animation-timing-function: linear;
        transition: opacity 0.1s linear;
        opacity: 0;
    }
}
#menu-container {
    position: absolute;
    left: 70%;
    bottom: 5%;
    cursor: pointer;
    opacity: 0.6;
    z-index: 3;
    &:hover {
        opacity: 1;
    }
    display: flex;
    align-items: flex-end;
}
#menu {
    cursor: default;
    margin-left: 5px;
    background-color: white;
    padding: 5px;
    width: 100px;
    font-family: vars.$pilot-font;
    font-size: 0.8em;
    border-radius: 3px;
    & button {
        margin: 3px 0;
    }
}
</style>
