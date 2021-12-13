<template>
    <div class="chair-space" v-for="(group, i) in groupedUsers" :key="i">
        <div
            v-for="(user, j) in group"
            class="chair-container"
            :key="user.id"
            :title="user.name"
        >
            <component
                :is="getChair(j + groupedUsers[0].length * i)"
                v-hijack-svg-image="user.avatarURL"
                v-scale-svg="0.1"
            ></component>
        </div>
    </div>
</template>

<script lang="ts">
import {
    defineComponent,
    DirectiveBinding,
    ref,
    computed,
    onMounted,
    PropType,
} from "vue";
import type { ChatUserInfo } from "../../types";
import type { Socket } from "socket.io-client";
import BlueChair from "!vue-loader!vue-svg-loader!../../assets/images/chairs/bluechairopt.svg";
import GameChair from "!vue-loader!vue-svg-loader!../../assets/images/chairs/gamechairopt.svg";
import GreyCouch from "!vue-loader!vue-svg-loader!../../assets/images/chairs/greycouchopt.svg";
import TanChair from "!vue-loader!vue-svg-loader!../../assets/images/chairs/tanchairopt.svg";
import ShoppingCart from "!vue-loader!vue-svg-loader!../../assets/images/chairs/shoppingcartopt.svg";

export default defineComponent({
    props: {
        socket: {
            required: true,
            type: Object as PropType<Socket>,
        },
    },
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
        "scale-svg": {
            mounted(el: SVGElement, scaleFactor: DirectiveBinding<number>) {
                const oldHeight = Number(el.getAttribute("height"));
                const oldWidth = Number(el.getAttribute("width"));
                el.setAttribute(
                    "height",
                    String(oldHeight * scaleFactor.value)
                );
                el.setAttribute("width", String(oldWidth * scaleFactor.value));
            },
        },
    },
    setup(props) {
        const chairs = [
            BlueChair,
            GreyCouch,
            ShoppingCart,
            GameChair,
            TanChair,
        ];
        const getChair = (i: number) => chairs[i % chairs.length];
        // test data
        // const users = ref<ChatUserInfo[]>([
        //     {
        //         avatarURL: "/images/avatars/facingright/strongseal.png",
        //         name: "fake selki",
        //         id: "1",
        //         resumed: false,
        //     },
        //     {
        //         avatarURL: "/images/avatars/facingright/bad.png",
        //         name: "fake erica",
        //         id: "2",
        //         resumed: false,
        //     },
        //     {
        //         avatarURL: "/images/avatars/facingright/scream.png",
        //         name: "fake dorian",
        //         id: "3",
        //         resumed: false,
        //     },
        //     {
        //         avatarURL: "/images/avatars/facingright/purpleface.png",
        //         name: "fake mickey",
        //         id: "4",
        //         resumed: false,
        //     },
        // ]);
        const users = ref<ChatUserInfo[]>([]);
        props.socket.on("audience_info_set", (audience: ChatUserInfo[]) => {
            users.value = audience.map((u) => ({
                ...u,
                avatarURL: u.avatarURL.replace(
                    "/avatars",
                    "/avatars/facingright"
                ),
            }));
        });
        const getUsersPerRow = () =>
            Math.floor(
                (document.querySelector("#container-container") as HTMLElement)
                    .offsetWidth / 120
            );
        const usersPerRow = ref(-1);
        window.addEventListener("resize", () => {
            usersPerRow.value = getUsersPerRow();
        });
        onMounted(() => {
            usersPerRow.value = getUsersPerRow();
        });
        const groupedUsers = computed(() => {
            const groups = [];
            let i = 0;
            while (
                i < users.value.length &&
                usersPerRow.value != -1 &&
                !isNaN(usersPerRow.value)
            ) {
                console.log("creating users row");
                groups.push(users.value.slice(i, i + usersPerRow.value));
                i += usersPerRow.value;
            }
            return groups;
        });

        return { getChair, users, groupedUsers, usersPerRow };
    },
});
</script>

<style scoped lang="scss">
.chair-space {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: baseline;
    flex-wrap: wrap;
    margin: 10px auto;
    padding: 10px;
    border: 3px solid black;
    border-radius: 10px;
    background-image: url("/assets/images/chairs/background.svg");
    background-position: center;
    background-size: cover;
}
.chair-container {
    position: relative;
    margin: 0 10px;
    &.flipped {
        transform: scaleX(-1);
    }
}
image {
    background-color: white;
}
</style>
