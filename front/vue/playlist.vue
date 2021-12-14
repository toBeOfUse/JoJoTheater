<template>
    <h2 @click="shown = !shown" id="playlist-header">
        Playlist {{ shown ? "▾" : "▸" }}
    </h2>
    <template v-if="shown">
        <div class="folder" v-for="folder in playlist" :key="folder.name">
            <h3 class="folder-header" @click="toggleOpen(folder.name)">
                {{ folder.name + (openFolders.has(folder.name) ? "▾" : "▸") }}
            </h3>
            <template v-if="openFolders.has(folder.name)">
                <div
                    class="playlist-item"
                    v-for="video in folder.videos"
                    :key="video.src"
                    :class="{ active: currentVideo == video.id }"
                    @click="changeVideo(video.id)"
                >
                    <img
                        :src="getIcon(video.provider)"
                        class="playlist-icon"
                    />{{ video.title }}
                </div>
                <div
                    class="playlist-item playlist-input"
                    v-if="folder.name == UserSubmittedFolderName"
                >
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
                            <rect
                                x="7"
                                y="0"
                                width="2"
                                height="16"
                                fill="black"
                            ></rect>
                            <rect
                                x="0"
                                y="7"
                                width="16"
                                height="2"
                                fill="black"
                            ></rect>
                        </svg>
                    </button>
                </div>
            </template>
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
    UserSubmittedFolderName,
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

        interface Folder {
            name: string;
            videos: Video[];
        }

        const playlist = ref<Folder[]>();
        const currentVideo = ref(-1);
        const openFolders = ref(new Set<string>());

        const toggleOpen = (folderName: string) => {
            if (!openFolders.value.has(folderName)) {
                openFolders.value.add(folderName);
            } else {
                openFolders.value.delete(folderName);
            }
        };

        props.socket.on("playlist_set", (newPlaylist: Video[]) => {
            const foldersObj: Record<string, Video[]> = {};
            const submissionsFolder: Video[] = [];
            for (const video of newPlaylist) {
                if (video.folder == UserSubmittedFolderName) {
                    submissionsFolder.push(video);
                } else if (video.folder in foldersObj) {
                    foldersObj[video.folder].push(video);
                } else {
                    foldersObj[video.folder] = [video];
                }
            }
            const folders = Object.keys(foldersObj).map((folderName) => ({
                name: folderName,
                videos: foldersObj[folderName],
            }));
            playlist.value = folders.concat([
                { name: UserSubmittedFolderName, videos: submissionsFolder },
            ]);
        });

        props.socket.on(
            "state_set",
            (newState: VideoState) =>
                (currentVideo.value = newState.currentVideoID)
        );

        const changeVideo = (newID: number) => {
            const req: StateChangeRequest = {
                whichElement: StateElements.videoID,
                newValue: newID,
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
            openFolders,
            UserSubmittedFolderName,
            toggleOpen,
        };
    },
});
</script>

<style lang="scss" scoped>
@use "sass:color";
@use "../scss/vars.scss";

.playlist-item {
    background-color: white;
    color: black;
    margin: 5px 0px;
    padding: 5px 5px 5px 0;
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
    // margin-left: 10px;
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

.folder-header {
    cursor: pointer;
    font-weight: normal;
    color: color.scale(vars.$mitchbot-blue, $lightness: -60%);
    margin: 0;
}

.folder {
    background-color: vars.$bg-blue;
    color: vars.$mitchbot-blue;
    border: 1px solid color.scale(vars.$mitchbot-blue, $lightness: -60%);
    border-radius: 5px;
    padding: 3px 5px;
    margin: 12px 0;
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
