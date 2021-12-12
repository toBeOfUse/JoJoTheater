<template>
    <div class="chair-space" v-if="users.length > 0">
        <div
            v-for="(user, i) in users"
            class="chair-container"
            :class="getMarginClass(i)"
            :key="user.id"
            :title="user.name"
        >
            <component
                :is="getChair(i)"
                v-hijack-svg-image="user.avatarURL"
                v-scale-svg="1 / 7"
            ></component>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, DirectiveBinding, ref } from "vue";
import type { ChatUserInfo } from "../../types";
import BlueChair from "!vue-loader!vue-svg-loader!../../assets/images/chairs/bluechairopt.svg";
import GameChair from "!vue-loader!vue-svg-loader!../../assets/images/chairs/gamechairopt.svg";
import GreyCouch from "!vue-loader!vue-svg-loader!../../assets/images/chairs/greycouchopt.svg";
import TanChair from "!vue-loader!vue-svg-loader!../../assets/images/chairs/tanchairopt.svg";
import ShoppingCart from "!vue-loader!vue-svg-loader!../../assets/images/chairs/bluechairopt.svg";

export default defineComponent({
    directives: {
        "hijack-svg-image"(
            el: SVGElement,
            replacement: DirectiveBinding<string>
        ) {
            const image = el.querySelector("image") as SVGImageElement;
            if (image) {
                image.setAttribute("href", replacement.value);
                image.setAttribute("xlink:href", replacement.value);
            }
        },
        "scale-svg"(el: SVGElement, scaleFactor: DirectiveBinding<number>) {
            console.log("scaling svg");
            const oldHeight = Number(el.getAttribute("height"));
            const oldWidth = Number(el.getAttribute("width"));
            el.setAttribute("height", String(oldHeight * scaleFactor.value));
            el.setAttribute("width", String(oldWidth * scaleFactor.value));
        },
    },
    setup() {
        const chairs = [
            BlueChair,
            GreyCouch,
            ShoppingCart,
            GameChair,
            TanChair,
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
</style>
