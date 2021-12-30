<template>
    <h2 @click="shown = !shown" id="playlist-header">
        Playlist
        <OpenCloseIcon class="folder-open-close" :class="{ open: shown }" />
    </h2>
    <template v-if="shown">
        <div class="folder" v-for="folder in playlist" :key="folder.name">
            <h3 class="folder-header" @click="toggleOpen(folder.name)">
                {{ folder.name }}
                <OpenCloseIcon
                    class="folder-open-close"
                    :class="{ open: openFolders.has(folder.name) }"
                />
                <!-- TODO: add fun little icon if folder.name==activeFolder -->
            </h3>
            <template
                v-if="openFolders.has(folder.name) || playlist.length <= 2"
            >
                <div
                    class="playlist-item"
                    v-for="video in folder.videos"
                    :key="video.src"
                    :class="{ active: currentVideoID == video.id }"
                    @click="changeVideo(video.id)"
                    :title="video.title"
                >
                    <div
                        :style="{
                            backgroundImage: `url(/images/thumbnails/${video.id}.jpg)`,
                        }"
                        class="video-thumbnail"
                    />
                    <div class="video-info-box">
                        <p class="video-title">
                            <img
                                :src="getIcon(video.provider)"
                                class="video-source-icon"
                            />{{ video.title }}
                        </p>
                    </div>
                </div>
                <div
                    class="playlist-item playlist-input"
                    v-if="folder.name == UserSubmittedFolderName"
                >
                    <input
                        type="text"
                        :placeholder="placeholder"
                        v-model="videoURL"
                        @keydown.enter="addVideo(videoURL)"
                    />
                    <button
                        @click="addVideo(videoURL)"
                        class="add-video-button"
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
        <input
            type="text"
            v-model="search"
            placeholder="Search..."
            id="search"
        />
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
    Subscription,
} from "../../types";
import { defineComponent, PropType, ref, computed } from "vue";
import OpenCloseIcon from "!vue-loader!vue-svg-loader!../../assets/images/folder-open.svg";

export default defineComponent({
    props: {
        socket: {
            type: Object as PropType<Socket>,
            required: true,
        },
    },
    components: { OpenCloseIcon },
    setup(props) {
        const shown = ref(true);
        const getIcon = (provider: string) => {
            return (
                {
                    youtube: "/images/youtube.svg",
                    vimeo: "/images/vimeo.svg",
                    dailymotion: "/images/dailymotion.svg",
                }[provider] || "/images/video-file.svg"
            );
        };

        const videoURL = ref("");

        interface Folder {
            name: string;
            videos: Video[];
        }

        const videos = ref<Video[]>([]);
        const currentVideoID = ref(-1);
        const openFolders = ref(new Set<string>());
        const activeFolder = ref("");
        const search = ref("");

        const toggleOpen = (folderName: string) => {
            if (!openFolders.value.has(folderName)) {
                openFolders.value.add(folderName);
            } else {
                openFolders.value.delete(folderName);
            }
        };

        props.socket.on("playlist_set", (newVideos: Video[]) => {
            videos.value = newVideos;
            if (openFolders.value.size == 0 && activeFolder.value) {
                openFolders.value.add(activeFolder.value);
            }
        });

        const playlist = computed<Folder[]>(() => {
            if (!videos.value.length) {
                return [];
            }
            const foldersObj: Record<string, Video[]> = {};
            const submissionsFolder: Video[] = [];
            for (const video of videos.value) {
                const searchString = search.value.trim().toLowerCase();
                if (
                    searchString &&
                    !video.title.toLowerCase().includes(searchString) &&
                    !video.folder.toLowerCase().includes(searchString)
                ) {
                    continue;
                }
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
            return folders.concat([
                { name: UserSubmittedFolderName, videos: submissionsFolder },
            ]);
        });

        props.socket.on("state_set", (newState: VideoState) => {
            const oldID = currentVideoID.value;
            currentVideoID.value = newState.video?.id || -1;
            if (oldID != currentVideoID.value && newState.video) {
                activeFolder.value = newState.video.folder;
                openFolders.value.add(newState.video.folder);
            }
        });

        const changeVideo = (newID: number) => {
            const req: StateChangeRequest = {
                whichElement: StateElements.videoID,
                newValue: newID,
            };
            props.socket.emit("state_change_request", req);
        };

        const defaultPlaceholder =
            "Type a Youtube, Vimeo, or Dailymotion URL...";
        const placeholder = ref(defaultPlaceholder);
        props.socket.on("add_video_failed", () => {
            placeholder.value = "I couldn't use that URL :(";
        });

        const addVideo = (url: string) => {
            props.socket.emit("add_video", url);
            videoURL.value = "";
            placeholder.value = defaultPlaceholder;
        };

        props.socket.emit("ready_for", Subscription.playlist);

        return {
            shown,
            getIcon,
            videoURL,
            addVideo,
            changeVideo,
            playlist,
            currentVideoID,
            openFolders,
            UserSubmittedFolderName,
            toggleOpen,
            placeholder,
            search,
            activeFolder,
        };
    },
});
</script>

<style lang="scss" scoped>
@use "../scss/vars.scss";
@use "sass:color";

$playlist-item-margin: 3px;
.playlist-item {
    background-color: white;
    color: black;
    margin: $playlist-item-margin;
    border: 1px solid black;
    border-radius: 3px;
    &.active {
        font-style: italic;
        color: gray;
    }
    &:not(.active) {
        cursor: pointer;
    }
    width: calc(25% - #{$playlist-item-margin * 2});
    @media (max-width: 750px) {
        width: calc(33.3% - #{$playlist-item-margin * 2});
    }
    @media (max-width: 500px) {
        width: calc(50% - #{$playlist-item-margin * 2});
    }
    position: relative;
}

.video-info-box {
    display: flex;
    align-items: center;
    width: 100%;
    border-radius: 3px;
    height: 2.5em;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 2px;
}

.video-title {
    color: black;
    font-size: 85%;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.video-source-icon {
    height: 1.3em;
    display: inline;
    vertical-align: middle;
    margin: 0 4px 0 2px;
}

.video-thumbnail {
    width: 100%;
    height: 0;
    padding-bottom: 56.25%;
    background-size: cover;
    background-position: center;
}

#playlist-header {
    padding: 10px 20px;
    @media (max-width: 450px) {
        padding: 5px 10px;
    }
    margin: 0 auto;
    background-image: url("../../assets/images/fun-square.svg");
    background-repeat: no-repeat;
    background-size: contain;
    background-position: center;
    width: 175px;
    text-align: center;
    cursor: pointer;
    color: vars.$mitchbot-blue;
    .folder-open-close {
        margin: 0 3px;
        height: 15px;
        width: auto;
    }
}

.folder-header {
    cursor: pointer;
    font-weight: normal;
    color: vars.$mitchbot-blue;
    margin: 3px;
    text-shadow: 2px 0px 1px white;
    width: 100%;
    .folder-open-close {
        margin: 0 2px;
        height: 10px;
        width: 10px;
    }
}

.folder {
    background: linear-gradient(
            vars.$bg-blue 0,
            vars.$bg-blue 35px,
            transparent 45px,
            transparent 100%
        ),
        repeating-linear-gradient(
            135deg,
            white,
            white 10px,
            white 15px,
            vars.$bg-blue 15px,
            vars.$bg-blue 25px,
            white 25px,
            // white 30px
        );
    color: vars.$mitchbot-blue;
    border: 1px solid vars.$mitchbot-blue;
    border-radius: 5px;
    padding: 3px 5px;
    margin: 12px 0;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
}

.folder-open-close {
    display: inline;
    stroke: vars.$mitchbot-blue;
    &.open {
        transform: rotate(90deg);
    }
}

.playlist-input {
    & input[type="text"] {
        margin-right: 3px;
        width: 100%;
        border: none;
    }
    width: 100%;
    display: flex;
    height: fit-content;
    align-items: center;
    padding: 3px;
}

.add-video-button {
    margin-left: auto;
    width: 20px;
    height: 20px;
    padding: 0;
    svg {
        transform: scale(0.5);
    }
}

#search {
    position: relative;
    left: 50%;
    transform: translateX(-50%);
}
</style>
