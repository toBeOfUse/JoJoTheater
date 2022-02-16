import type { Socket } from "socket.io-client";
import { Video } from "../../types";

async function loadIndexComps(
    socket: Socket,
    initialActiveVideo: Video | undefined
) {
    import(/* webpackMode: "eager" */ "vue").then(async (Vue) => {
        // Create a Promise for each Vue component and then await them with
        // Promise.all so they can load in parallel
        const ChatPromise = import(/* webpackMode: "eager" */ "./vchat.vue");
        const PlaylistPromise = import(
            /* webpackMode: "eager" */ "./playlist.vue"
        );
        const AudiencePromise = import(
            /* webpackMode: "eager" */ "./audience.vue"
        );
        const InfoPromise = import(
            /* webpackMode: "eager" */ "./infomodals.vue"
        );
        const [Chat, Playlist, Audience, Info] = await Promise.all([
            ChatPromise,
            PlaylistPromise,
            AudiencePromise,
            InfoPromise,
        ]);
        // ensure socket is connected before Vue components are created so they
        // can all use it without fear
        if (!socket.connected) {
            await new Promise<void>((resolve) => socket.on("connect", resolve));
        }
        Vue.createApp(Chat.default, { socket }).mount("#chat-container");
        Vue.createApp(Playlist.default, { socket, initialActiveVideo }).mount(
            "#playlist-container"
        );
        Vue.createApp(Audience.default, { socket }).mount(
            "#audience-container"
        );
        Vue.createApp(Info.default).mount("#info-container");
    });
}

export { loadIndexComps };
