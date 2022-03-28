import { ServerInteractor } from "../serverinteractor";

async function loadIndexComps(socket: ServerInteractor) {
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
        const LoginPromise = import(/* webpackMode: "eager" */ "./login.vue");
        const [Chat, Playlist, Audience, Info, Login] = await Promise.all([
            ChatPromise,
            PlaylistPromise,
            AudiencePromise,
            InfoPromise,
            LoginPromise,
        ]);
        // ensure socket is connected and authenticated before Vue components
        // are created so they can all use it without fear
        await new Promise<void>((resolve) => {
            if (socket.getGlobal("identity")) {
                resolve();
            } else {
                const tokenWatcher = () => {
                    resolve();
                    socket.stopWatchingGlobal("identity", tokenWatcher);
                };
                socket.watchGlobal("identity", tokenWatcher);
            }
        });
        Vue.createApp(Chat.default, { socket }).mount("#chat-container");
        Vue.createApp(Playlist.default, { socket }).mount(
            "#playlist-container"
        );
        Vue.createApp(Audience.default, { socket }).mount(
            "#audience-container"
        );
        Vue.createApp(Info.default).mount("#info-container");
        Vue.createApp(Login.default).mount("#login-container");
    });
}

export { loadIndexComps };
