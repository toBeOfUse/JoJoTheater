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
import { avatars, Direction } from "./avatars";
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
    "arm-chair": defineAsyncComponent(
        () => import("../../assets/images/chairs/arm-chair.vue.svg")
    ),
    "little-car": defineAsyncComponent(
        () => import("../../assets/images/chairs/little-car.vue.svg")
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
                // TODO: optimize with Record<string, Avatar> lookup?
                const avatar = avatars.find((a) => a.path == replacement.value);
                const flip = avatar && avatar.facing == Direction.left;
                let cdnURL =
                    "/imgopt?path=" + encodeURIComponent(replacement.value);
                cdnURL += "&flip=" + flip;
                cdnURL +=
                    "&width=" +
                    image.getBoundingClientRect().width *
                        window.devicePixelRatio;
                image.setAttribute("href", cdnURL);
                image.setAttribute("xlink:href", cdnURL);
            }
        },
    },
    setup(props) {
        const chairs = Object.keys(chairComponents);
        // const testSalt = ref(0);
        // setInterval(() => testSalt.value++, 2000);
        const getChair = (userID: string) => {
            let acc = 0;
            for (let i = 0; i < userID.length; i++) {
                acc += userID.charCodeAt(i);
            }
            //return chairs[(acc + testSalt.value) % chairs.length];
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
            users.value = audience;
        });
        const getMaxUsersPerRow = () =>
            Math.floor(
                (document.querySelector("#container-container") as HTMLElement)
                    .offsetWidth / (window.innerWidth > 450 ? 160 : 80)
            );
        const maxUsersPerRow = ref(-1);
        window.addEventListener("resize", () => {
            maxUsersPerRow.value = getMaxUsersPerRow();
        });
        onMounted(() => {
            maxUsersPerRow.value = getMaxUsersPerRow();
        });
        const groupedUsers = computed(() => {
            const rowCount = Math.ceil(
                users.value.length / maxUsersPerRow.value
            );
            const groups: ChatUserInfo[][] = [];
            for (let j = 0; j < rowCount; j++) {
                groups.push([]);
            }
            let i = 0;
            while (
                i < users.value.length &&
                maxUsersPerRow.value != -1 &&
                !isNaN(maxUsersPerRow.value)
            ) {
                groups[i % rowCount].push(users.value[i]);
                i++;
            }
            return groups;
        });

        props.socket.emit("ready_for", Subscription.audience);

        return { getChair, users, groupedUsers, maxUsersPerRow };
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
    border: 2px solid black;
    border-radius: 10px;
    background-image: url("/assets/images/chairs/background.svg");
    background-position: center;
    background-size: cover;
}
.chair-container {
    position: relative;
    margin: 0 5px;
}
image {
    background-color: white;
}
svg {
    height: 150px;
    @media (max-width: 450px) {
        height: 70px;
    }
    width: auto;
}
</style>
