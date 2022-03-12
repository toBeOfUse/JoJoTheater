<template>
    <div id="root">
        <div id="panel">
            <input
                type="file"
                name="video"
                ref="videoFile"
                accept="video/mp4"
                @change="onFileChange"
                style="width: 100%; max-width: 70vw"
            />
            <button
                style="display: block"
                @click="fullFormShown = !fullFormShown"
            >
                View Optional Data Form
            </button>
            <template v-if="fullFormShown">
                <input
                    type="text"
                    v-model="videoTitle"
                    placeholder="Video name..."
                />
                <br />
                <input
                    type="text"
                    v-model="folder"
                    placeholder="Video folder name..."
                />
                <br />
                <div id="thumbnail-container">
                    <div
                        class="thumbnail"
                        :style="{ backgroundImage: `url(${thumbnail})` }"
                        @click="thumbnailInput && thumbnailInput.click()"
                    />
                    <div
                        id="thumbnail-clear"
                        v-if="thumbnail != thumbnailPlaceholderImage"
                        @click="clearThumbnail"
                    >
                        x
                    </div>
                </div>
                <input
                    type="file"
                    style="display: none"
                    id="thumbnailFile"
                    @change="showThumbnail"
                    ref="thumbnailInput"
                    accept="image/jpeg,image/png"
                    name="thumbnail"
                />
                <p>Subtitle files:</p>
                <input
                    type="file"
                    id="subtitleInput"
                    ref="subtitleInput"
                    accept="text/vtt"
                    name="subtitles"
                    multiple
                />
                <p>Password for immediate video availability:</p>
                <input
                    type="password"
                    v-model="password"
                    placeholder="Password..."
                />
            </template>
            <button
                @click="upload"
                :disabled="!fileSelected"
                id="upload-button"
            >
                UPLOAD
            </button>
            <p v-if="diskSpace">({{ diskSpace }} free)</p>
            <p v-else>(loading...)</p>
            <div id="in-progress-container">
                <div
                    v-for="(inProgress, i) in uploadsInProgress"
                    :key="i"
                    class="in-progress"
                >
                    <h3>{{ inProgress.title }}</h3>
                    <p>{{ inProgress.folder }}</p>
                    <div
                        class="thumbnail"
                        style="border: none"
                        :style="{
                            backgroundImage:
                                'url(' + inProgress.thumbnailURL + ')',
                        }"
                    />
                    <progress
                        v-if="inProgress.progress != 1"
                        class="uploadProgress"
                        :value="inProgress.progress"
                        max="1"
                    />
                    <p style="text-align: center" v-else>Complete</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { APIPath } from "../../constants/endpoints";

export default defineComponent({
    setup() {
        interface UploadInProgress {
            title: string;
            folder: string;
            thumbnailURL: string;
            progress: number;
        }
        const uploadsInProgress = ref<UploadInProgress[]>([]);

        const videoFile = ref<HTMLInputElement | null>(null);
        const fileSelected = ref(false);
        const onFileChange = () => {
            fileSelected.value = !!videoFile.value?.files?.length;
        };

        const fullFormShown = ref(false);
        const videoTitle = ref("");
        const folder = ref("");
        const subtitleInput = ref<HTMLInputElement | null>(null);
        const thumbnailInput = ref<HTMLInputElement | null>(null);
        const thumbnailPlaceholderImage = "/images/upload-plus.svg";
        const thumbnail = ref(thumbnailPlaceholderImage);
        const showThumbnail = () => {
            if (thumbnailInput.value?.files?.length) {
                thumbnail.value = URL.createObjectURL(
                    thumbnailInput.value.files[0]
                );
            }
        };
        const clearThumbnail = () => {
            thumbnail.value = thumbnailPlaceholderImage;
            if (thumbnailInput.value) {
                thumbnailInput.value.value = "";
            }
        };
        const password = ref("");

        const upload = () => {
            if (!videoFile.value?.files?.length) {
                return;
            }
            const file = videoFile.value.files[0];
            const fd = new FormData();
            fd.append("video", file, file.name);
            if (thumbnailInput.value?.files?.length) {
                const thumbnailFile = thumbnailInput.value.files[0];
                fd.append("thumbnail", thumbnailFile, thumbnailFile.name);
            }
            const subtitlesCount = subtitleInput.value?.files?.length;
            if (subtitlesCount && subtitleInput.value?.files) {
                for (let i = 0; i < subtitlesCount; i++) {
                    const subFile = subtitleInput.value.files[i];
                    fd.append("captions", subFile, subFile.name);
                }
            }
            if (videoTitle.value?.trim()) {
                fd.append("title", videoTitle.value.trim());
            }
            if (folder.value?.trim()) {
                fd.append("folder", folder.value.trim());
            }
            if (password.value) {
                fd.append("password", password.value);
            }

            const progressIndex = uploadsInProgress.value.length;
            uploadsInProgress.value.push({
                title: videoTitle.value || "no title",
                folder: folder.value || "no folder",
                thumbnailURL:
                    thumbnail.value &&
                    thumbnail.value != thumbnailPlaceholderImage
                        ? thumbnail.value
                        : "",
                progress: 0,
            });

            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (event) => {
                uploadsInProgress.value[progressIndex].progress =
                    event.loaded / event.total;
            });
            xhr.upload.addEventListener("load", () => {
                // TODO: something?
            });
            xhr.open("POST", "/api/upload");
            xhr.send(fd);
            if (videoFile.value) {
                videoFile.value.value = "";
            }
            if (subtitleInput.value) {
                subtitleInput.value.value = "";
            }
            videoTitle.value = "";
            folder.value = "";
            clearThumbnail();
        };

        const diskSpace = ref("");
        fetch(APIPath.getFreeSpace).then(async (resp) => {
            const stats = await resp.json();
            diskSpace.value = (stats.free / 1_073_741_824).toFixed(2) + " GB";
        });

        return {
            upload,
            videoFile,
            fullFormShown,
            videoTitle,
            folder,
            onFileChange,
            fileSelected,
            password,
            thumbnail,
            thumbnailInput,
            showThumbnail,
            clearThumbnail,
            thumbnailPlaceholderImage,
            uploadsInProgress,
            diskSpace,
            subtitleInput,
        };
    },
});
</script>

<style lang="scss" scoped>
#root {
    font-family: sans-serif;
    width: 100%;
    display: flex;
    justify-content: center;
}
#panel {
    text-align: center;
    position: relative;
    width: 500px;
    background-color: white;
    border: 1px solid black;
    border-radius: 5px;
    padding: 4px;
    & > * {
        margin: 3px 2px;
    }
    & > input[type="text"] {
        width: 70%;
    }
}
#upload {
    display: flex;
    flex-direction: row;
}
#success {
    color: green;
    margin-top: 5px;
    margin-bottom: 5px;
}
#thumbnail-container {
    width: 200px;
    position: relative;
    margin: 0 auto;
}
.thumbnail {
    height: 0;
    padding-top: 56.25%;
    width: 100%;
    border: 1px solid black;
    border-radius: 2px;
    background-size: cover;
    background-position: center center;
    overflow: hidden;
}
#thumbnail-clear {
    font-family: sans-serif;
    position: absolute;
    right: 5px;
    top: 5px;
    cursor: pointer;
    color: white;
    background-color: black;
    border-radius: 50%;
    height: 20px;
    width: 20px;
    text-align: center;
}
#upload-button {
    font-size: 300%;
    display: block;
    margin: 15px auto 5px auto;
}
#in-progress-container {
    width: 150px;
    position: absolute;
    left: 105%;
    top: 0;
}
.in-progress {
    background: white;
    border-radius: 5px;
    border: 1px solid black;
    margin-bottom: 10px;
    & * {
        margin: 2px 0;
    }
    & img {
        max-width: 100%;
    }
    & progress {
        width: 100%;
    }
}
</style>