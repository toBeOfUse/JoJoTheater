<template>
    <div class="chair-space" v-for="(group, i) in groupedUsers" :key="i">
        <div
            v-for="user in group"
            class="chair-container"
            :key="user.id"
            :title="user.name"
        >
            <component
                :is="getChair(user.id)"
                v-hijack-svg-image="user.avatarURL"
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
    defineAsyncComponent,
} from "vue";
import { ChatUserInfo, Subscription } from "../../types";
import type { Socket } from "socket.io-client";

const chairComponents = {
    "blue-chair": defineAsyncComponent(
        () => import("../../assets/images/chairs/blue-chair.vue.svg")
    ),
    tub: defineAsyncComponent(
        () => import("../../assets/images/chairs/clawfoot-tub.vue.svg")
    ),
    "game-chair": defineAsyncComponent(
        () => import("../../assets/images/chairs/game-chair.vue.svg")
    ),
    "grey-couch": defineAsyncComponent(
        () => import("../../assets/images/chairs/grey-couch.vue.svg")
    ),
    "shopping-cart": defineAsyncComponent(
        () => import("../../assets/images/chairs/shopping-cart.vue.svg")
    ),
    "tan-chair": defineAsyncComponent(
        () => import("../../assets/images/chairs/tan-chair.vue.svg")
    ),
};

export default defineComponent({
    props: {
        socket: {
            required: true,
            type: Object as PropType<Socket>,
        },
    },
    components: chairComponents,
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
    },
    setup(props) {
        const chairs = Object.keys(chairComponents);
        const getChair = (userID: string) => {
            let acc = 0;
            for (let i = 0; i < userID.length; i++) {
                acc += userID.charCodeAt(i);
            }
            return chairs[acc % chairs.length];
        };
        // test data
        // const users = ref<ChatUserInfo[]>([
        //     {
        //         avatarURL: "/images/avatars/facingright/strongseal.jpg",
        //         name: "fake selki",
        //         id: "1",
        //         resumed: false,
        //     },
        //     {
        //         avatarURL: "/images/avatars/facingright/bad.jpg",
        //         name: "fake erica",
        //         id: "2",
        //         resumed: false,
        //     },
        //     {
        //         avatarURL: "/images/avatars/facingright/scream.jpg",
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
        //     {
        //         avatarURL: "/images/avatars/facingright/fear.jpg",
        //         name: "fake melissa",
        //         id: "5",
        //         resumed: false,
        //     },
        //     {
        //         avatarURL: "/images/avatars/facingright/coop.jpg",
        //         name: "fake coop fan",
        //         id: "6",
        //         resumed: false,
        //     },
        //     {
        //         avatarURL: "/images/avatars/facingright/rosie.jpg",
        //         name: "fake rosie",
        //         id: "7",
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
                    .offsetWidth / (window.innerWidth > 450 ? 120 : 72)
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
                groups.push(users.value.slice(i, i + usersPerRow.value));
                i += usersPerRow.value;
            }
            return groups;
        });

        props.socket.emit("ready_for", Subscription.audience);

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
    border: 3px solid black;
    border-radius: 10px;
    background-image: url("/assets/images/chairs/background.svg");
    background-position: center;
    background-size: cover;
}
.chair-container {
    position: relative;
    margin: 0 5px;
    &.flipped {
        transform: scaleX(-1);
    }
}
image {
    background-color: white;
}
svg {
    height: 150px;
    @media (max-width: 450px) {
        height: 60px;
    }
    width: auto;
}
</style>
