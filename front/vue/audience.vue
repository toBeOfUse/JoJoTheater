<template>
    <div class="counter" id="offToTheLeftCount" v-if="visibleCount.left">
        &lt; +{{ visibleCount.left }}
    </div>
    <div class="chair-space" ref="chairSpace" v-if="users.length">
        <transition-group name="musical-chairs" @before-leave="beforeLeave">
            <div
                key="left-spacer"
                class="musical-chairs-item"
                style="width: 100%; flex-shrink: 1"
            />
            <Chair
                v-for="user in users"
                :key="user.id"
                :title="user.name"
                :avatarURL="user.avatarURL"
                :typing="user.typing"
                :chairMarkup="user.svgMarkup"
                class="musical-chairs-item"
                :ref="(e) => chairs.push(e)"
            />
            <div
                key="right-spacer"
                class="musical-chairs-item"
                style="width: 100%; flex-shrink: 1"
            />
        </transition-group>
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
import { RoomInhabitant } from "../../back/rooms";
// import testUsers from "./testaudience";

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

        // Load and cache the SVG markup for each of the "chairs" that the Chair
        // components will display:
        interface LoadedRoomInhabitant extends RoomInhabitant {
            svgMarkup: string;
        }
        const svgMarkupCache: Record<string, string> = {};

        const users = ref<LoadedRoomInhabitant[]>([]);
        const addInhabitants = async (audience: RoomInhabitant[]) => {
            const loaded: LoadedRoomInhabitant[] = [];
            for (const inhabitant of audience) {
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
        props.socket.on("audience_info_set", addInhabitants);
        // addInhabitants(testUsers);
        props.socket.emit("ready_for", Subscription.audience);

        // this function is just used to fix a weird bug with transition-group
        // and flexbox:
        const beforeLeave = (el: HTMLElement) => {
            el.style.left = el.offsetLeft + "px";
            el.style.top = el.offsetTop + "px";
        };

        return { users, beforeLeave, visibleCount, chairs, chairSpace };
    },
});
</script>

<style scoped lang="scss">
@use "../scss/vars";

.chair-space {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    margin: 10px auto;
    border: 2px solid black;
    border-radius: 10px;
    background-image: url("/assets/images/rooms/basic/background.svg");
    background-position: center;
    background-size: cover;
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    padding: 0 10px;
    position: relative;
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
#offToTheLeftCount {
    left: 7px;
    top: 7px;
}
#offToTheRightCount {
    right: 7px;
    top: 7px;
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
