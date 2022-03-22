<template>
    <login />
    <div id="container">
        <img id="logo" src="/images/welcome-logo.svg" />
        <div id="mascot-container">
            <opt-image path="/images/hogbg.jpg" id="mascot-bg" />
            <opt-image
                path="/images/avatars/animals/hedgehog.jpg"
                aspectRatio="1:1"
                id="mascot"
            />
            <button>Make a playlist for Him</button>
        </div>
        <div id="conversion-container">
            <div class="conversion-column">
                <h3>Or go to a room:</h3>
                <a href="/room"><button>Tanya's Treehouse Room</button></a>
            </div>
            <div class="conversion-column">
                <h3>Or create a room (this doesn't work yet):</h3>
                <label for="room-name">Name:</label>
                <input
                    type="text"
                    id="room-name"
                    name="room-name"
                    placeholder="RUMPUS ROOM"
                />
                <label for="scene-select">Backdrop:</label>
                <select
                    id="scene-select"
                    name="scene-select"
                    :value="currentScene"
                >
                    <option
                        v-for="scene in availableScenes"
                        :key="scene"
                        :value="scene"
                    >
                        {{ scene.charAt(0).toUpperCase() + scene.slice(1) }}
                    </option>
                </select>
                <label for="video-url">Add videos by URL:</label>
                <div style="display: flex">
                    <input
                        style="width: 100%; margin-right: 3px"
                        type="text"
                        id="video-url"
                        name="video-url"
                        placeholder="youtube/vimeo/dailymotion url"
                    />
                    <button>+</button>
                </div>
                And/or
                <button style="display: inline">Find playlists...</button>
                <button id="create-room-button">Go</button>
            </div>
        </div>
    </div>
    <info-modals />
</template>
<script lang="ts">
import { defineComponent, ref } from "vue";
import { endpoints, APIPath } from "../../constants/endpoints";
import Image from "./image.vue";
import InfoModals from "./infomodals.vue";
import Login from "./login.vue";

export default defineComponent({
    components: { optImage: Image, InfoModals, Login },
    setup() {
        const availableScenes = ref([]);
        const currentScene = ref("");
        endpoints[APIPath.getAllScenes].dispatch("", {}).then((e) => {
            currentScene.value = e.scenes[0];
            availableScenes.value = e.scenes;
        });
        return { availableScenes, currentScene };
    },
});
</script>
<style lang="scss" scoped>
@use "../scss/vars.scss";
@mixin box {
    background-color: white;
    border: 1px solid black;
    padding: 5px;
}
@font-face {
    font-family: "Anivers";
    src: url("/assets/fonts/Anivers_Regular-webfont.woff2") format("woff2"),
        url("/assets/fonts/Anivers_Regular-webfont.woff") format("woff");
    font-weight: normal;
    font-style: normal;
}
#container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-family: "Anivers", sans-serif;
    max-width: 850px;
    margin: 0 auto 30px auto;
    text-align: left;
    @media (max-width: 1050px) {
        // leave extra space for the log in buttons if there isn't a wide open
        // top right corner for them to be in
        margin-top: 30px;
    }
}
#logo {
    width: 70%;
    @media (max-width: 500px) {
        width: 95%;
    }
    margin: 30px 0;
}
h3 {
    margin: 5px 0;
}
@keyframes fade-in-out {
    from {
        background-color: #fff0;
    }
    to {
        background-color: #fff9;
    }
}
#mascot-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin: 20px 0;
    @include box;
    position: relative;
    animation: fade-in-out 10s ease-in-out 0s infinite alternate;
}
#mascot-bg {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
}
#mascot {
    height: 50px;
    margin-right: 5px;
    border-radius: 50%;
}
#conversion-container {
    display: flex;
    justify-content: center;
    width: 100%;
    @media (max-width: 500px) {
        flex-direction: column;
        padding: 0 10px;
    }
}
input[type="text"] {
    background-color: transparent;
}
.conversion-column {
    @include box;
    &:first-child {
        margin-right: 2.5%;
        margin-bottom: 15px;
    }
    & h3 {
        font-weight: normal;
        text-align: center;
    }
    & > select,
    & > input,
    & > div {
        width: 85%;
        margin-left: 15%;
    }
    & > label,
    & > button {
        display: block;
        margin: 5px 0;
    }
    width: 100%;
    padding: 5px 10px;
    background-color: #f5f5f5;
}
#create-room-button {
    margin-left: auto;
    width: 20%;
}
</style>