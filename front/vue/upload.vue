<template>
    <div id="root">
        <div id="panel">
            <input
                type="file"
                name="someFile"
                ref="fileInput"
                accept="video/mp4"
                @change="onFileChange"
                style="width: 100%; max-width: 70vw"
            />
            <progress
                id="uploadProgress"
                v-if="progress > 0"
                :value="progress"
                max="1"
            ></progress>
            <p id="success" v-if="uploadCompleted">Upload successful!</p>
            <button
                style="display: block"
                @click="fullFormShown = !fullFormShown"
            >
                Toggle Detailed Mode
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
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";

export default defineComponent({
    setup() {
        const fileInput = ref<HTMLInputElement | null>(null);
        const progress = ref(0);
        const uploadCompleted = ref(false);
        const fileSelected = ref(false);
        const onFileChange = () => {
            uploadCompleted.value = false;
            fileSelected.value = !!fileInput.value?.files?.length;
        };

        const fullFormShown = ref(false);
        const videoTitle = ref("");
        const folder = ref("");
        const password = ref("");

        const upload = () => {
            if (!fileInput.value?.files?.length) {
                return;
            }
            const file = fileInput.value.files[0];
            const fd = new FormData();
            fd.append("file", file, file.name);
            if (videoTitle.value?.trim()) {
                fd.append("title", videoTitle.value.trim());
            }
            if (folder.value?.trim()) {
                fd.append("folder", folder.value.trim());
            }
            if (password.value) {
                fd.append("password", password.value);
            }
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (event) => {
                progress.value = event.loaded / event.total;
            });
            xhr.upload.addEventListener("load", () => {
                progress.value = 0;
                if (fileInput.value) fileInput.value.value = "";
                videoTitle.value = "";
                folder.value = "";
                uploadCompleted.value = true;
            });
            xhr.open("POST", "/api/upload");
            xhr.send(fd);
        };
        return {
            upload,
            fileInput,
            progress,
            uploadCompleted,
            fullFormShown,
            videoTitle,
            folder,
            onFileChange,
            fileSelected,
            password,
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
    background-color: white;
    border: 1px solid black;
    border-radius: 5px;
    padding: 4px;
    & > * {
        margin: 3px 2px;
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
#uploadProgress {
    display: block;
    margin: 2px auto;
}
#upload-button {
    font-size: 300%;
    display: block;
    margin: 15px auto 5px auto;
}
</style>