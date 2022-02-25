<template>
    <div class="counter" id="offToTheLeftCount" v-if="visibleCount.left">
        &lt; +{{ visibleCount.left }}
    </div>
    <div
        id="inhabited-space"
        ref="inhabitedSpace"
        :style="{
            backgroundImage: 'url(' + optImageLayerURL(backgroundURL) + ')',
        }"
    >
        <div
            id="musical-chairs"
            v-if="backgroundURL && users.length"
            :style="{ justifyContent: overflowing ? 'start' : 'center' }"
        >
            <transition-group
                :name="curtainState == 'open' ? 'musical-chairs' : ''"
                @before-leave="beforeLeave"
                @after-leave="
                    updateVisibleCount();
                    updateScrollbarComp();
                "
            >
                <Inhabitant
                    v-for="user in users"
                    :key="user.userID"
                    :title="user.name"
                    :avatar="user.avatar"
                    :typing="user.typing"
                    :propsMarkup="user.svgMarkup"
                    :isSelf="user.connectionID == ownID"
                    class="musical-chairs-item"
                    :ref="(e) => e && inhabitants.push(e)"
                    :morePosesAvailable="multipleProps"
                    :socket="socket"
                />
            </transition-group>
        </div>
        <div class="image-layer" style="pointer-events: none">
            <img
                v-if="foregroundURL"
                :src="optImageLayerURL(foregroundURL)"
                id="foreground"
            />
            <select
                id="switch"
                v-if="allowedToSwitch"
                @change="requestSceneChange"
                :disabled="switchCoolingDown"
                :value="currentScene"
                style="pointer-events: all"
            >
                <option
                    v-for="scene in availableScenes"
                    :key="scene"
                    :value="scene"
                >
                    {{ scene.charAt(0).toUpperCase() + scene.slice(1) }}
                </option>
            </select>
        </div>
    </div>
    <div
        id="curtain"
        :style="{
            backgroundColor: curtainState != 'open' ? '#000f' : '#0000',
            visibility: showCurtain ? 'visible' : 'hidden',
        }"
    >
        <img v-if="curtainState == 'slightlyOpen'" src="/images/eyes.svg" />
        <Curtains
            style="
                position: absolute;
                left: 50%;
                transform: translateX(-50%);
                top: 0;
                height: 100%;
            "
            :state="curtainState"
            @outoftheway="showCurtain = false"
            @backintheway="showCurtain = true"
        />
    </div>
    <div class="counter" id="offToTheRightCount" v-if="visibleCount.right">
        +{{ visibleCount.right }} &gt;
    </div>
</template>

<script lang="ts">
import {
    defineComponent,
    ref,
    PropType,
    onBeforeUpdate,
    nextTick,
    watch,
} from "vue";
import { StreamsSocket, Subscription } from "../../constants/types";
import Inhabitant from "./inhabitant.vue";
import type { SceneInhabitant, OutputScene } from "../../back/scenes";
import { APIPath, getOptimizedImageURL } from "../../constants/endpoints";
import Curtains from "./curtains.vue";

export default defineComponent({
    props: {
        socket: {
            required: true,
            type: Object as PropType<StreamsSocket>,
        },
    },
    components: { Inhabitant, Curtains },
    setup(props) {
        // receive an array of the Inhabitant components as a template ref and track
        // their visibility within our inhabited-space:
        const inhabitants = ref<typeof Inhabitant[]>([]);
        onBeforeUpdate(() => (inhabitants.value = []));
        const visibleCount = ref<{ left: number; right: number }>({
            left: 0,
            right: 0,
        });
        const updateVisibleCount = () => {
            const result = { left: 0, right: 0 };
            for (const inhabitant of inhabitants.value) {
                const visibility = inhabitant.placement();
                if (visibility == "left") {
                    result.left++;
                } else if (visibility == "right") {
                    result.right++;
                }
            }
            visibleCount.value = result;
        };
        const scrollBarHeight = ref(0);
        const overflowing = ref(false);
        const updateScrollbarComp = () => {
            if (inhabitedSpace.value) {
                scrollBarHeight.value =
                    inhabitedSpace.value.offsetHeight -
                    inhabitedSpace.value.clientHeight;
                overflowing.value =
                    inhabitedSpace.value.scrollWidth >
                    inhabitedSpace.value.clientWidth;
            }
        };
        const inhabitedSpace = ref<null | HTMLDivElement>(null);
        watch(inhabitedSpace, () => {
            if (!inhabitedSpace.value) return;
            inhabitedSpace.value.addEventListener("scroll", updateVisibleCount);
        });

        // Load and cache the SVG markup for each of the "inhabitants" that the Inhabitant
        // components will display:
        interface LoadedSceneInhabitant extends SceneInhabitant {
            svgMarkup: string;
        }
        const svgMarkupCache: Record<string, string> = {};

        const currentScene = ref("");
        const backgroundURL = ref("");
        const foregroundURL = ref<undefined | string>(undefined);
        const users = ref<LoadedSceneInhabitant[]>([]);
        const curtainState = ref<
            "closed" | "slightlyOpen" | "open" | "descended"
        >("closed");
        const multipleProps = ref(false);
        const loadScene = async (graphics: OutputScene) => {
            const startTime = Date.now();
            if (graphics.inhabitants.length == 0) {
                curtainState.value = "slightlyOpen";
            }
            multipleProps.value = graphics.multipleProps;
            let sceneChanged = false;
            if (graphics.sceneName != currentScene.value) {
                sceneChanged = true;
                if (curtainState.value == "open") {
                    curtainState.value = "descended";
                }
                console.log(
                    "scene changing! received " +
                        graphics.inhabitants.length +
                        " blorbos"
                );
            }

            currentScene.value = graphics.sceneName;

            // wait for background and foreground to be loaded; this ensures
            // that the curtain's removal (which happens at the end of this
            // function) will wait for that too
            const bgImageLoaded = new Promise<void>((resolve) => {
                if (backgroundURL.value == graphics.background) {
                    resolve();
                } else {
                    const bgimg = new Image();
                    bgimg.onload = () => resolve();
                    bgimg.src = graphics.background;
                }
            });
            const fgImageLoaded = new Promise<void>((resolve) => {
                if (
                    graphics.foreground &&
                    foregroundURL.value != graphics.foreground
                ) {
                    const fgimg = new Image();
                    fgimg.onload = () => resolve();
                    fgimg.src = graphics.foreground;
                } else {
                    resolve();
                }
            });

            const inhabitantsLoaded: Promise<LoadedSceneInhabitant>[] = [];
            for (const inhabitant of graphics.inhabitants) {
                inhabitantsLoaded.push(
                    new Promise<LoadedSceneInhabitant>(async (resolve) => {
                        if (!svgMarkupCache[inhabitant.propsURL]) {
                            const markupResponse = await fetch(
                                inhabitant.propsURL
                            );
                            const markup = await markupResponse.text();
                            svgMarkupCache[inhabitant.propsURL] = markup;
                        }
                        resolve({
                            ...inhabitant,
                            svgMarkup: svgMarkupCache[inhabitant.propsURL],
                        });
                    })
                );
            }
            // TODO: also await avatarURL fetching?
            Promise.all([bgImageLoaded, fgImageLoaded]).then(() => {
                Promise.all(inhabitantsLoaded).then(
                    async (loadedInhabitants) => {
                        const timePassed = Date.now() - startTime;
                        if (
                            sceneChanged &&
                            loadedInhabitants.length &&
                            timePassed < 1000
                        ) {
                            // leave enough time for the curtain animation not to look jerky
                            await new Promise((resolve) =>
                                setTimeout(resolve, 1000 - timePassed)
                            );
                        }
                        backgroundURL.value = graphics.background;
                        foregroundURL.value = graphics.foreground;
                        users.value = loadedInhabitants;
                        if (loadedInhabitants.length) {
                            nextTick().then(() => {
                                curtainState.value = "open";
                                updateVisibleCount();
                                updateScrollbarComp();
                            });
                        }
                    }
                );
            });
        };
        const optImageLayerURL = (url: string) => {
            if (!url || !inhabitedSpace.value) {
                return "";
            } else if (url.endsWith(".svg")) {
                return url;
            } else {
                const width =
                    inhabitedSpace.value.offsetWidth * window.devicePixelRatio;
                return getOptimizedImageURL({
                    path: url,
                    width,
                });
            }
        };

        // start receiving audience data from the server:
        props.socket.on("audience_info_set", (graphics: OutputScene) => {
            loadScene(graphics);
        });
        props.socket.emit("ready_for", Subscription.audience);

        // this function is just used to fix a weird bug with transition-group
        // and flexbox:
        const beforeLeave = (el: HTMLElement) => {
            el.style.left = el.offsetLeft + "px";
            el.style.top = el.offsetTop + "px";
        };

        const availableScenes = ref<string[]>([]);
        props.socket.http(APIPath.getScenes).then((response) => {
            availableScenes.value = response.scenes;
        });

        const switchCoolingDown = ref(false);
        const requestSceneChange = (event: InputEvent) => {
            const newValue = (event.target as HTMLSelectElement).value;
            if (!switchCoolingDown.value && newValue != currentScene.value) {
                switchCoolingDown.value = true;
                setTimeout(() => (switchCoolingDown.value = false), 1000);
                props.socket.http(APIPath.changeScene, {
                    newScene: newValue,
                });
            }
        };

        const allowedToSwitch = ref<boolean>(
            props.socket.getGlobal("inChat") as boolean
        );
        props.socket.watchGlobal(
            "inChat",
            (newValue: boolean) => (allowedToSwitch.value = newValue)
        );

        const showCurtain = ref(true);

        return {
            users,
            beforeLeave,
            visibleCount,
            inhabitants,
            inhabitedSpace,
            backgroundURL,
            foregroundURL,
            requestSceneChange,
            curtainState,
            switchCoolingDown,
            allowedToSwitch,
            optImageLayerURL,
            availableScenes,
            currentScene,
            showCurtain,
            ownID: props.socket.id,
            scrollBarHeight,
            overflowing,
            updateVisibleCount,
            updateScrollbarComp,
            multipleProps,
        };
    },
});
</script>

<style scoped lang="scss">
@use "../scss/vars";

#inhabited-space {
    margin: 0 auto;
    border: 2px solid black;
    border-radius: 10px;
    width: 100%;
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
    height: calc(25vh + v-bind("scrollBarHeight+'px'"));
    // max 5:1 aspect ratio to avoid stretching art assets
    max-width: 25vh * 5;
    @media (max-width: 450px) {
        height: calc(80px + v-bind("scrollBarHeight+'px'"));
        max-width: 80px * 5;
    }
    background-size: cover;
    background-position: center;
}
#musical-chairs {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: row;
}
.counter {
    position: absolute;
    background-color: white;
    padding: 5px;
    border-radius: 10px;
    border: 2px solid black;
    font-family: vars.$pilot-font;
    z-index: 100;
}
.image-layer {
    position: sticky;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
}
#foreground {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
    object-fit: cover;
    object-position: center;
}
#curtain {
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    & img {
        height: 80%;
        width: auto;
    }
    transition: background-color 0.5s linear;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
    border: 2px solid black;
    border-radius: 10px;
    z-index: 5;
}
#offToTheLeftCount {
    left: 7px;
    top: 7px;
}
#offToTheRightCount {
    right: 7px;
    top: 7px;
}
#switch {
    position: absolute;
    right: 7px;
    bottom: 7px;
    font-family: vars.$pilot-font;
    font-size: 0.8em;
}
</style>
<style lang="scss">
.musical-chairs-item {
    transition: transform 0.2s, opacity 0.2s;
}
.musical-chairs-enter-from,
.musical-chairs-leave-to {
    opacity: 0;
    transform: translateY(-30px);
}
.musical-chairs-leave-active {
    position: absolute;
}
</style>
