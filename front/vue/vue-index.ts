import type { Socket } from "socket.io-client";
import { Video } from "../../types";

async function loadIndexComps(
    socket: Socket,
    initialActiveVideo: Video | undefined
) {
    import(/* webpackMode: "eager" */ "vue").then(async (Vue) => {
        const Chat = await import(/* webpackMode: "eager" */ "./vchat.vue");
        Vue.createApp(Chat.default, { socket }).mount("#chat-container");
        const Playlist = await import(
            /* webpackMode: "eager" */ "./playlist.vue"
        );
        Vue.createApp(Playlist.default, { socket, initialActiveVideo }).mount(
            "#playlist-container"
        );
        const Audience = await import(
            /* webpackMode: "eager" */ "./audience.vue"
        );
        Vue.createApp(Audience.default, { socket }).mount(
            "#audience-container"
        );
        const Info = await import(
            /* webpackMode: "eager" */ "./infomodals.vue"
        );
        Vue.createApp(Info.default).mount("#info-container");
    });
}

export { loadIndexComps };
