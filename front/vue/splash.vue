<template>
    <div id="container">
        <img id="logo" src="/images/welcome-logo.svg" />
        <div id="audience-container">
            <Audience :socket="fakeSocket" />
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import type { OutputScene } from "../../back/scenes";
import Audience from "./audience.vue";

export default defineComponent({
    components: { Audience },
    setup() {
        const fakeSocket = {
            on(eventName: string, callback: (graphics: OutputScene) => void) {
                if (eventName == "audience_info_set") {
                    callback({
                        background: "/images/scenes/rock 'n' roll/stage.jpg",
                        sceneName: "rock 'n' roll",
                        multipleProps: false,
                        inhabitants: [
                            {
                                typing: false,
                                lastTypingTimestamp: -1,
                                propsURL: encodeURI(
                                    "/images/scenes/rock 'n' roll/guitar.svg"
                                ),
                                id: "notrealid",
                                name: "Jimbo",
                                avatarURL:
                                    "/images/avatars/animals/chipmunk.jpg",
                                resumed: false,
                            },
                        ],
                    });
                }
            },
            id: "evenlessrealid",
            emit() {},
        };
        return { fakeSocket };
    },
});
</script>
<style lang="scss" scoped>
@use "../scss/vars.scss";
#container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-family: vars.$pilot-font;
}
#logo {
    width: 70%;
    max-width: 800px;
}
#audience-container {
    position: relative;
    width: 900px;
    overflow: hidden;
}
</style>