<template>
    <div class="chair-space" v-if="users.length">
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
            />
            <div
                key="right-spacer"
                class="musical-chairs-item"
                style="width: 100%; flex-shrink: 1"
            />
        </transition-group>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, PropType } from "vue";
import { Subscription } from "../../types";
import Chair from "./chair.vue";
import type { Socket } from "socket.io-client";
import { RoomInhabitant } from "../../back/rooms";

export default defineComponent({
    props: {
        socket: {
            required: true,
            type: Object as PropType<Socket>,
        },
    },
    components: { Chair },
    setup(props) {
        // test data
        // const users = ref<RoomInhabitant[]>([
        //     {
        //         avatarURL: "/images/avatars/strongseal.jpg",
        //         name: "fake selki",
        //         id: "1",
        //         resumed: false,
        //         chairURL: "/images/rooms/basic/arm-chair.svg",
        //         typing: true,
        //     },
        // {
        //     avatarURL: "/images/avatars/bad.jpg",
        //     name: "fake erica",
        //     id: "2",
        //     resumed: false,
        // },
        // {
        //     avatarURL: "/images/avatars/scream.jpg",
        //     name: "fake dorian",
        //     id: "3",
        //     resumed: false,
        // },
        // {
        //     avatarURL: "/images/avatars/purpleface.png",
        //     name: "fake mickey",
        //     id: "4",
        //     resumed: false,
        // },
        // {
        //     avatarURL: "/images/avatars/fear.jpg",
        //     name: "fake melissa",
        //     id: "5",
        //     resumed: false,
        // },
        // {
        //     avatarURL: "/images/avatars/coop.jpg",
        //     name: "fake coop fan",
        //     id: "6",
        //     resumed: false,
        // },
        // {
        //     avatarURL: "/images/avatars/rosie.jpg",
        //     name: "fake rosie",
        //     id: "7",
        //     resumed: false,
        // },
        // {
        //     avatarURL: "/images/avatars/rosie.jpg",
        //     name: "fake rosie 2",
        //     id: "8",
        //     resumed: false,
        // },
        //]);
        interface LoadedRoomInhabitant extends RoomInhabitant {
            svgMarkup: string;
        }
        const svgMarkupCache: Record<string, string> = {};

        const users = ref<LoadedRoomInhabitant[]>([]);
        props.socket.on(
            "audience_info_set",
            async (audience: RoomInhabitant[]) => {
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
            }
        );

        props.socket.emit("ready_for", Subscription.audience);

        const beforeLeave = (el: HTMLElement) => {
            el.style.left = el.offsetLeft + "px";
            el.style.top = el.offsetTop + "px";
        };

        return { users, beforeLeave };
    },
});
</script>

<style scoped lang="scss">
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
