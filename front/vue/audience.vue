<template>
    <div class="chair-space" v-if="users.length > 0">
        <div
            v-for="(user, i) in users"
            class="chair-container"
            :class="getMarginClass(i)"
            :key="user.id"
        >
            <img class="chair-image" :src="'/images/chairs/' + getChair(i)" />
            <img
                class="chair-avatar"
                :src="user.avatarURL"
                :title="user.name"
            />
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import type { ChatUserInfo } from "../../types";

export default defineComponent({
    setup() {
        const chairs = [
            "tanchair.svg",
            "gamechair.svg",
            "greychair.svg",
            "greycouch.svg",
            "tancouch.svg",
        ];
        const getChair = (i: number) => chairs[i % chairs.length];
        const marginClasses = ["left-margin-1", "right-margin-1"];
        const getMarginClass = (i: number) =>
            i < marginClasses.length ? marginClasses[i] : "";
        const users = ref<ChatUserInfo[]>([
            {
                avatarURL: "/images/avatars/strongseal.png",
                name: "fake selki",
                id: "1",
                resumed: false,
            },
            {
                avatarURL: "/images/avatars/bad.png",
                name: "fake erica",
                id: "2",
                resumed: false,
            },
            {
                avatarURL: "/images/avatars/scream.png",
                name: "fake dorian",
                id: "3",
                resumed: false,
            },
            {
                avatarURL: "/images/avatars/purpleface.png",
                name: "fake mickey",
                id: "4",
                resumed: false,
            },
        ]);
        // todo: listen for user info events and update

        return { getChair, getMarginClass, users };
    },
});
</script>

<style scoped lang="scss">
.chair-space {
    display: flex;
    flex-direction: row;
    justify-content: space-evenly;
    align-items: center;
    height: 100px;
    width: 100%;
    margin: 10px 0;
}
.chair-container {
    position: relative;
    @media (min-aspect-ratio: 14/9) {
        &.left-margin-1 {
            position: absolute;
            left: 50px;
            top: 50px;
        }
        &.right-margin-1 {
            position: absolute;
            right: 50px;
            top: 50px;
        }
    }
}
.chair-image {
    height: 100px;
}
.chair-avatar {
    border-radius: 50%;
    width: 40px;
    height: 40px;
    position: absolute;
    left: 50%;
    top: 50%;
}
</style>
