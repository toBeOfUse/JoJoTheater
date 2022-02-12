<template>
    <div class="counter" id="offToTheLeftCount" v-if="visibleCount.left">
        &lt; +{{ visibleCount.left }}
    </div>
    <div
        id="chair-space"
        ref="chairSpace"
        v-if="backgroundURL && users.length"
        :style="{ backgroundImage: 'url(' + backgroundURL + ')' }"
    >
        <div id="musical-chairs">
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
            <img v-if="foregroundURL" :src="foregroundURL" id="foreground" />
            <button
                id="switch"
                v-if="allowedToSwitch"
                @click="requestSceneChange"
                :disabled="switchCoolingDown"
            >
                Change Scene
            </button>
            <transition name="fade">
                <div class="image-layer" id="curtain" v-show="fadedOut" />
            </transition>
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
} from "vue";
import { Subscription } from "../../types";
import Chair from "./chair.vue";
import type { Socket } from "socket.io-client";
import type { RoomInhabitant, OutputRoom } from "../../back/rooms";
import flags from "./globalflags";

export default defineComponent({
    props: {
        socket: {
            required: true,
            type: Object as PropType<Socket>,
        },
    },
    components: { Chair },
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

        const fadedOut = ref(false);

        // Load and cache the SVG markup for each of the "chairs" that the Chair
        // components will display:
        interface LoadedRoomInhabitant extends RoomInhabitant {
            svgMarkup: string;
        }
        const svgMarkupCache: Record<string, string> = {};

        const backgroundURL = ref("");
        const foregroundURL = ref<undefined | string>(undefined);
        const users = ref<LoadedRoomInhabitant[]>([]);
        const loadRoom = async (graphics: OutputRoom) => {
            if (
                backgroundURL.value &&
                backgroundURL.value != graphics.background
            ) {
                fadedOut.value = true;
                // wait for "curtain" to fade in
                await new Promise((resolve) => setTimeout(resolve, 1000));
                // start fading curtain back out soon
                setTimeout(() => (fadedOut.value = false), 100);
            }
            backgroundURL.value = graphics.background;
            foregroundURL.value = graphics.foreground;
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
            users.value = loaded;
            await nextTick();
            updateVisibleCount();
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

        const switchCoolingDown = ref(false);
        const requestSceneChange = () => {
            if (!switchCoolingDown.value) {
                switchCoolingDown.value = true;
                setTimeout(() => (switchCoolingDown.value = false), 1000);
                props.socket.emit("change_room");
            }
        };

        const allowedToSwitch = ref(flags.loggedIn);
        flags.watchFlag(
            "loggedIn",
            (newValue) => (allowedToSwitch.value = newValue)
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
    height: 175px;
    // max 5:1 aspect ratio to avoid stretching art assets
    max-width: 175px * 5;
    @media (max-width: 450px) {
        height: 70px;
        max-width: 70px * 5;
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
    background-color: black;
}
.fade-enter-active,
.fade-leave-active {
    transition: opacity 1s linear;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
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
    padding: 3px;
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
