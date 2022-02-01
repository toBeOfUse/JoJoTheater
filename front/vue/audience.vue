<template>
    <div class="chair-space" v-for="(group, i) in groupedUsers" :key="i">
        <template v-for="user in group" :key="user.id">
            <Chair
                :title="user.name"
                :avatarURL="user.avatarURL"
                :typing="user.typing"
                :chairURL="user.chairURL"
            />
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, PropType } from "vue";
import { ChatUserInfo, Subscription } from "../../types";
import { avatars, Direction } from "./avatars";
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
        const users = ref<ChatUserInfo[]>([]);
        props.socket.on("audience_info_set", (audience: RoomInhabitant[]) => {
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

        const typing = ref(true);

        props.socket.emit("ready_for", Subscription.audience);

        return { users, groupedUsers, maxUsersPerRow, typing };
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
    background-image: url("/assets/images/rooms/basic/background.svg");
    background-position: center;
    background-size: cover;
}
</style>
