<template>
    <div class="counter" id="offToTheLeftCount" v-if="visibleCount.left">
        &lt; +{{ visibleCount.left }}
    </div>
    <div
        id="chair-space"
        ref="chairSpace"
        :style="{
            backgroundImage: 'url(' + optImageLayerURL(backgroundURL) + ')',
        }"
    >
        <div id="musical-chairs" v-if="backgroundURL && users.length">
            <transition-group name="musical-chairs" @before-leave="beforeLeave">
                <div
                    key="left-spacer"
                    class="musical-chairs-item"
                    style="width: 100%"
                />
                <Chair
                    v-for="user in users"
                    :key="user.id"
                    :title="user.name"
                    :avatarURL="user.avatarURL"
                    :typing="user.typing"
                    :chairMarkup="user.svgMarkup"
                    class="musical-chairs-item"
                    :ref="(e) => e && chairs.push(e)"
                />
                <div
                    key="right-spacer"
                    class="musical-chairs-item"
                    style="width: 100%"
                />
            </transition-group>
        </div>
        <div class="image-layer">
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
            >
                <option
                    v-for="scene in availableScenes"
                    :key="scene"
                    :value="scene"
                >
                    {{ scene.charAt(0).toUpperCase() + scene.slice(1) }}
                </option>
            </select>
            <div
                class="image-layer"
                id="curtain"
                :style="
                    fadedOut || (!users.length && !allowedToSwitch)
                        ? { backgroundColor: '#000f' }
                        : { backgroundColor: '#0000' }
                "
            >
                <img
                    v-if="backgroundURL && !users.length && !allowedToSwitch"
                    src="/images/eyes.svg"
                />
                <Curtains
                    style="
                        position: absolute;
                        left: 50%;
                        transform: translateX(-50%);
                        top: 0;
                        height: 100%;
                    "
                    :state="
                        !backgroundURL
                            ? 'closed'
                            : allowedToSwitch
                            ? 'open'
                            : 'slightlyOpen'
                    "
                />
            </div>
        </div>
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
    computed,
    Ref,
} from "vue";
import { Subscription } from "../../types";
import Chair from "./chair.vue";
import type { Socket } from "socket.io-client";
import type { RoomInhabitant, OutputRoom } from "../../back/rooms";
import globals from "../globals";
import { APIPath, endpoints, getOptimizedImageURL } from "../../endpoints";
import Curtains from "./curtains.vue";

export default defineComponent({
    props: {
        socket: {
            required: true,
            type: Object as PropType<Socket>,
        },
    },
    components: { Chair, Curtains },
    setup(props) {
        // receive an array of the Chair components as a template ref and track
        // their visibility within our chair-space:
        const chairs = ref<typeof Chair[]>([]);
        onBeforeUpdate(() => (chairs.value = []));
        const visibleCount = ref<{ left: number; right: number }>({
            left: 0,
            right: 0,
        });
        const updateVisibleCount = () => {
            const result = { left: 0, right: 0 };
            for (const chair of chairs.value) {
                const visibility = chair.placement();
                if (visibility == "left") {
                    result.left++;
                } else if (visibility == "right") {
                    result.right++;
                }
            }
            visibleCount.value = result;
        };
        const chairSpace = ref<null | HTMLDivElement>(null);
        watch(chairSpace, () => {
            if (!chairSpace.value) return;
            chairSpace.value.addEventListener("scroll", updateVisibleCount);
        });

        const fadedOut = ref(true);

        // Load and cache the SVG markup for each of the "chairs" that the Chair
        // components will display:
        interface LoadedRoomInhabitant extends RoomInhabitant {
            svgMarkup: string;
        }
        const svgMarkupCache: Record<string, string> = {};

        const currentScene = ref("");
        const backgroundURL = ref("");
        const foregroundURL = ref<undefined | string>(undefined);
        const users = ref<LoadedRoomInhabitant[]>([]);
        const loadRoom = async (graphics: OutputRoom) => {
            if (graphics.sceneName != currentScene.value) {
                fadedOut.value = true;
                // wait for "curtain" to fade in to start changing and loading things
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            backgroundURL.value = graphics.background;
            foregroundURL.value = graphics.foreground;
            currentScene.value = graphics.sceneName;

            // wait for background and foreground to be loaded; this ensures
            // that the curtain's removal (which happens at the end of this
            // function) will wait for that too
            // TODO: all the loading in this function should probably be done in
            // parallel with something like Promise.all
            await new Promise((resolve) => {
                const bgimg = new Image();
                bgimg.onload = resolve;
                bgimg.src = graphics.background;
            });
            await new Promise<void>((resolve) => {
                if (graphics.foreground) {
                    const fgimg = new Image();
                    fgimg.onload = () => resolve();
                    fgimg.src = graphics.foreground;
                } else {
                    resolve();
                }
            });

            const loaded: LoadedRoomInhabitant[] = [];
            for (const inhabitant of graphics.inhabitants) {
                if (!svgMarkupCache[inhabitant.chairURL]) {
                    const markupResponse = await fetch(inhabitant.chairURL);
                    const markup = await markupResponse.text();
                    svgMarkupCache[inhabitant.chairURL] = markup;
                }
                loaded.push({
                    ...inhabitant,
                    svgMarkup: svgMarkupCache[inhabitant.chairURL],
                });
            }
            // TODO: also await avatarURL fetching?
            users.value = loaded;
            await nextTick();
            updateVisibleCount();
            if (users.value.length) {
                // remove "curtain" now that everything is finished loading, in case it was put in place
                fadedOut.value = false;
            }
        };
        const optImageLayerURL = (url: string) => {
            if (!url || !chairSpace.value) {
                return "";
            } else if (url.endsWith(".svg")) {
                return url;
            } else {
                const width =
                    chairSpace.value.offsetWidth * window.devicePixelRatio;
                return getOptimizedImageURL({
                    path: url,
                    width,
                });
            }
        };

        // start receiving audience data from the server:
        props.socket.on("audience_info_set", loadRoom);
        props.socket.emit("ready_for", Subscription.audience);

        // this function is just used to fix a weird bug with transition-group
        // and flexbox:
        const beforeLeave = (el: HTMLElement) => {
            el.style.left = el.offsetLeft + "px";
            el.style.top = el.offsetTop + "px";
        };

        const availableScenes = ref<string[]>([]);
        endpoints[APIPath.getScenes].dispatch({}, {}).then((scenes) => {
            availableScenes.value = scenes.scenes;
        });

        const switchCoolingDown = ref(false);
        const requestSceneChange = (event: InputEvent) => {
            const newValue = (event.target as HTMLSelectElement).value;
            if (!switchCoolingDown.value && newValue != currentScene.value) {
                switchCoolingDown.value = true;
                setTimeout(() => (switchCoolingDown.value = false), 1000);
                endpoints[APIPath.changeScene].dispatch({
                    newScene: newValue,
                });
            }
        };

        const allowedToSwitch = ref(globals.get("loggedIn"));
        globals.watch(
            "loggedIn",
            (newValue: boolean) => (allowedToSwitch.value = newValue)
        );

        return {
            users,
            beforeLeave,
            visibleCount,
            chairs,
            chairSpace,
            backgroundURL,
            foregroundURL,
            requestSceneChange,
            fadedOut,
            switchCoolingDown,
            allowedToSwitch,
            optImageLayerURL,
            availableScenes,
            currentScene,
        };
    },
});
</script>

<style scoped lang="scss">
@use "../scss/vars";

#chair-space {
    margin: 10px auto;
    border: 2px solid black;
    border-radius: 10px;
    width: 100%;
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
    height: 25vh;
    // max 5:1 aspect ratio to avoid stretching art assets
    max-width: 25vh * 5;
    @media (max-width: 450px) {
        height: 80px;
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
    justify-content: start;
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
    background-color: #000f;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    & img {
        height: 80%;
        width: auto;
    }
    transition: background-color 1s linear;
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
