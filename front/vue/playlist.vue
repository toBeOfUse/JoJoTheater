<template>
    <h2 @click="shown = !shown" id="playlist-header">
        Playlist {{ shown ? "▾" : "▸" }}
    </h2>
    <template v-if="shown">
        <div
            class="playlist-item"
            v-for="(video, i) in playlist"
            :key="video.src"
            :class="{ active: currentVideo == i }"
            @click="changeVideo(i)"
        >
            <img :src="getIcon(video.provider)" class="playlist-icon" />{{
                video.title
            }}
        </div>

        <div class="playlist-item playlist-input">
            <input
                type="text"
                placeholder="Type a Youtube or Vimeo URL..."
                v-model="videoURL"
                @keydown.enter="addVideo(videoURL)"
            />
            <button
                @click="addVideo(videoURL)"
                style="margin-left: auto; width: 20px; height: 20px"
            >
                <svg width="100%" height="100%" viewBox="0 0 16 16">
                    <rect x="7" y="0" width="2" height="16" fill="black"></rect>
                    <rect x="0" y="7" width="16" height="2" fill="black"></rect>
                </svg>
            </button>
        </div>
    </template>
</template>

<script lang="ts">
import type { Socket } from "socket.io-client";
import {
    Video,
    VideoState,
    StateChangeRequest,
    StateElements,
} from "../../types";
import { defineComponent, PropType, ref } from "vue";

export default defineComponent({
    props: {
        socket: {
            type: Object as PropType<Socket>,
            required: true,
        },
    },
    setup(props) {
        const shown = ref(false);
        const getIcon = (provider: string) => {
            return (
                { youtube: "/images/youtube.svg", vimeo: "/images/vimeo.svg" }[
                    provider
                ] || "/images/video-file.svg"
            );
        };

        const videoURL = ref("");

        const playlist = ref<Video[]>([]);
        const currentVideo = ref(0);

        props.socket.on(
            "playlist_set",
            (newPlaylist: Video[]) => (playlist.value = newPlaylist)
        );
        props.socket.on(
            "state_set",
            (newState: VideoState) =>
                (currentVideo.value = newState.currentVideoIndex)
        );

        const changeVideo = (newIndex: number) => {
            const req: StateChangeRequest = {
                whichElement: StateElements.index,
                newValue: newIndex,
            };
            props.socket.emit("state_change_request", req);
        };

        const addVideo = (url: string) => {
            props.socket.emit("add_video", url);
            videoURL.value = "";
        };

        return {
            shown,
            getIcon,
            videoURL,
            addVideo,
            changeVideo,
            playlist,
            currentVideo,
        };
    },
});
</script>

<style lang="scss" scoped>
@use "../scss/vars.scss";

.playlist-item {
    background-color: white;
    margin: 5px 0px;
    padding: 5px 5px;
    border: 1px solid black;
    border-radius: 3px;
    &.active {
        font-style: italic;
        color: gray;
    }
    &:not(.active) {
        cursor: pointer;
    }
    display: flex;
    flex-direction: row;
    align-items: center;
}

#playlist-header {
    padding: 10px 20px;
    margin: 0 auto;
    background-image: url("../../assets/images/fun-square.svg");
    background-repeat: no-repeat;
    background-size: contain;
    background-position: center;
    width: 150px;
    text-align: center;
    cursor: pointer;
    color: vars.$mitchbot-blue;
}

.playlist-icon {
    height: 1em;
    margin: 0 5px;
}

.playlist-input {
    & input[type="text"] {
        margin-right: 3px;
        width: 100%;
    }
}
</style>
