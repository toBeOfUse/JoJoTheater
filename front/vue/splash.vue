<template>
    <img id="logo" src="/images/welcome-logo.svg" />
    <div id="container">
        <div id="mascot-container">
            <opt-image
                path="/images/avatars/animals/hedgehog.jpg"
                aspectRatio="1:1"
                id="mascot"
            />
            <button>Make a playlist for him</button>
        </div>
        <div id="conversion-container">
            <div class="conversion-column">
                <h3>Go to a room:</h3>
            </div>
            <div class="conversion-column">
                <h3>Or create a room:</h3>
                <label for="room-name">Name:</label>
                <input type="text" id="room-name" name="room-name" />
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
                <label for="video-url">Add video by URL:</label>
                <div style="display: flex">
                    <input
                        style="width: 100%; margin-right: 3px"
                        type="text"
                        id="video-url"
                        name="video-url"
                    />
                    <button>+</button>
                </div>
                <button>Find playlists...</button>
                <button id="create-room-button">Go</button>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent, ref } from "vue";
import {
    endpoints,
    APIPath,
    getOptimizedImageURL,
} from "../../constants/endpoints";
import Image from "./image.vue";

export default defineComponent({
    components: { optImage: Image },
    setup() {
        const availableScenes = ref([]);
        const currentScene = ref("");
        endpoints[APIPath.getScenes].dispatch({}).then((e) => {
            currentScene.value = e.scenes[0];
            availableScenes.value = e.scenes;
        });
        const mascotBG = getOptimizedImageURL({
            path: "/images/hogbg.3.jpg",
            width: window.innerWidth * 0.7,
        });
        return { availableScenes, currentScene, mascotBG };
    },
});
</script>
<style lang="scss" scoped>
@use "../scss/vars.scss";
@mixin box {
    background-color: white;
    // border-radius: 5px;
    border: 1px solid black;
    padding: 5px;
}
#logo {
    width: 60%;
    max-width: 800px;
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
    width: 60%;
    margin: 0 auto;
    text-align: left;
}
h3 {
    margin: 5px 0;
}
#mascot-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin: 10px 0;
    @include box;
    padding: 10px 20px;
    background-size: cover;
    background-position: center;
    background-image: v-bind("'url('+mascotBG+')'");
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
    margin: 15px 0;
}
input[type="text"] {
    background-color: transparent;
}
.conversion-column {
    @include box;
    &:first-child {
        margin-right: 10px;
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
    background-color: #ededed;
}
#create-room-button {
    margin-left: auto;
    width: 20%;
}
</style>