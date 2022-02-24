<template>
    <h2 @click="shown = !shown" id="playlist-header">
        Playlist
        <OpenCloseIcon class="folder-open-close" :class="{ open: shown }" />
    </h2>
    <template v-if="shown">
        <div class="folder" v-for="folder in playlist" :key="folder.name">
            <h3 class="folder-header" @click="toggleOpen(folder.name)">
                <input
                    type="text"
                    v-model="search"
                    placeholder="Search these videos..."
                    id="search"
                    v-if="folder.name == searchResultsFolderName"
                    @click.stop
                />{{ getFolderLabel(folder.name)
                }}<img
                    v-if="folder.name == activeFolder"
                    src="/images/active-folder-indicator.svg"
                    class="folder-active-icon"
                />
                <OpenCloseIcon
                    class="folder-open-close"
                    :class="{ open: openFolders.has(folder.name) }"
                />
            </h3>
            <template v-if="openFolders.has(folder.name)">
                <div
                    class="playlist-item"
                    v-for="video in folder.videos"
                    :key="video.src"
                    :class="{ active: currentVideoID == video.id }"
                    @click="changeVideo(video.id)"
                    :title="video.title"
                >
                    <opt-image
                        :path="`/images/thumbnails/${video.id}.jpg`"
                        aspectRatio="16:9"
                        class="video-thumbnail"
                    />
                    <div class="video-info-box">
                        <p class="video-title">
                            {{ video.title }}
                        </p>
                    </div>
                    <div
                        style="
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            flex-grow: 1;
                        "
                    >
                        <span class="duration">
                            (<img
                                :src="getIcon(video.provider)"
                                class="video-source-icon"
                            />{{ durationToString(video.duration) }})
                        </span>
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
    </template>
</template>

<script lang="ts">
import {
    Video,
    VideoState,
    StateChangeRequest,
    ChangeTypes,
    UserSubmittedFolderName,
    Subscription,
    StreamsSocket,
} from "../../constants/types";
import { defineComponent, PropType, ref, computed, watch } from "vue";
import OpenCloseIcon from "!vue-loader!vue-svg-loader!../../assets/images/folder-open.svg";
import OptImage from "./image.vue";
import { APIPath } from "../../constants/endpoints";

export default defineComponent({
    props: {
        socket: {
            type: Object as PropType<StreamsSocket>,
            required: true,
        },
        initialActiveVideo: {
            type: Object as PropType<Video>,
            required: false,
        },
    },
    components: { OpenCloseIcon, OptImage },
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
        const currentVideoID = ref<number>(props.initialActiveVideo?.id || -1);
        const openFolders = ref(
            new Set<string>(
                props.initialActiveVideo
                    ? [props.initialActiveVideo.folder]
                    : []
            )
        );
        const activeFolder = ref("");
        const search = ref("");
        const searchResultsFolderName = "~~~~~SEARCH";
        watch(search, (newValue, oldValue) => {
            if (newValue.trim()) {
                if (
                    oldValue.toLowerCase().trim() !=
                    newValue.toLowerCase().trim()
                )
                    openFolders.value.add(searchResultsFolderName);
            } else {
                openFolders.value.delete(searchResultsFolderName);
            }
        });

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
            const searchResults: Video[] = [];
            for (const video of videos.value) {
                const searchString = search.value.trim().toLowerCase();
                if (
                    searchString &&
                    (video.title.toLowerCase().includes(searchString) ||
                        video.folder.toLowerCase().includes(searchString))
                ) {
                    searchResults.push(video);
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
                { name: searchResultsFolderName, videos: searchResults },
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
                changeType: ChangeTypes.videoID,
                newValue: newID,
            };
            props.socket.emit("state_change_request", req);
        };

        const getFolderLabel = (folderName: string) => {
            if (folderName == searchResultsFolderName) {
                return "";
            } else if (folderName == UserSubmittedFolderName) {
                return folderName + " (add videos here)";
            } else {
                return folderName;
            }
        };

        const defaultPlaceholder =
            "Type a Youtube, Vimeo, or Dailymotion URL...";
        const placeholder = ref(defaultPlaceholder);

        const addVideo = (url: string) => {
            if (url.trim()) {
                props.socket.http(APIPath.addVideo, { url }).catch(() => {
                    placeholder.value = "I couldn't use that URL :(";
                });
                videoURL.value = "";
                placeholder.value = defaultPlaceholder;
            }
        };

        const durationToString = (duration: number) => {
            if (Math.round(duration / 60 / 5) * 5 < 1) {
                return `${Math.round(duration / 5) * 5} sec.`;
            } else {
                return `${Math.round(duration / 60 / 5) * 5} min.`;
            }
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
            searchResultsFolderName,
            getFolderLabel,
            durationToString,
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
        color: #666;
        border-style: inset;
        & .video-thumbnail {
            opacity: 0.7;
        }
    }
    &:not(.active) {
        border-style: solid;
        cursor: pointer;
        color: black;
    }
    width: calc(25% - #{$playlist-item-margin * 2});
    @media (max-width: 750px) {
        width: calc(33.3% - #{$playlist-item-margin * 2});
    }
    @media (max-width: 500px) {
        width: calc(50% - #{$playlist-item-margin * 2});
    }
    position: relative;
    text-align: center;
    display: flex;
    flex-direction: column;
}

.video-info-box {
    display: flex;
    align-items: center;
    width: 100%;
    border-radius: 3px;
    overflow: hidden;
    padding: 0 2px;
    text-align: left;
}

.video-title {
    font-size: 85%;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    width: 100%;
    text-overflow: ellipsis;
    margin: 3px 0;
}

.video-source-icon {
    height: 1.3em;
    display: inline;
    vertical-align: middle;
    margin: 0 4px 0 2px;
}

.duration {
    font-size: 85%;
    color: gray;
    font-style: italic;
}

.video-thumbnail {
    width: 100%;
}

#playlist-header {
    padding: 10px 20px;
    @media (max-width: 450px) {
        padding: 5px 10px;
    }
    margin: 0 auto;
    background-image: url("../../assets/images/fun-square.inline.svg");
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
        margin: 0 5px;
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

.folder-active-icon {
    display: inline;
    width: 17px;
    height: 17px;
    margin: 0 5px;
    vertical-align: middle;
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
    flex-direction: row;
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
    width: 35%;
}
</style>
