import type { Socket } from "socket.io-client";

async function loadIndexComps(socket: Socket) {
    import(/* webpackMode: "eager" */ "vue").then(async (Vue) => {
        const Chat = await import(/* webpackMode: "eager" */ "./vchat.vue");
        Vue.createApp(Chat.default, { socket }).mount("#chat-container");
        const Playlist = await import(
            /* webpackMode: "eager" */ "./playlist.vue"
        );
        Vue.createApp(Playlist.default, { socket }).mount(
            "#playlist-container"
        );
        const Audience = await import(
            /* webpackMode: "eager" */ "./audience.vue"
        );
        Vue.createApp(Audience.default, { socket }).mount(
            "#audience-container"
        );
    });
}
async function loadUploadComps() {
    import(/* webpackMode: "eager" */ "vue").then(async (Vue) => {
        const Upload = await import(/* webpackMode: "eager" */ "./upload.vue");
        Vue.createApp(Upload.default).mount("#upload-container");
    });
}

export { loadIndexComps, loadUploadComps };
