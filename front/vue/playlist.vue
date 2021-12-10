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
            @click="$emit('changeVideo', i)"
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
            /><button
                @click="$emit('addVideo', videoURL)"
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
import type { Video } from "../../types";
import { defineComponent, PropType, ref } from "vue";

export default defineComponent({
    props: {
        playlist: {
            type: Array as PropType<Video[]>,
            required: true,
        },
    },
    emits: ["changeVideo", "addVideo"],
    setup() {
        const shown = ref(false);
        const getIcon = (provider: string) => {
            return (
                { youtube: "/images/youtube.svg", vimeo: "/images/vimeo.svg" }[
                    provider
                ] || "/images/video-file.svg"
            );
        };
        const videoURL = ref("");

        return { shown, getIcon, videoURL };
    },
});
</script>

<style lang="scss" scoped>
</style>
