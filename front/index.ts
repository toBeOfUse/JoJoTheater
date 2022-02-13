import "normalize.css";

import { io } from "socket.io-client";

import { Video, VideoState } from "../types";
import initVideo from "./video";
import { globals } from "./globalflags";
const socket = io();

socket.on("grant_token", (token: string) => {
    globals.token = token;
});
socket.on("ping", () => {
    socket.emit("pong");
});

window.onerror = (event) => {
    socket.emit("error_report", event.toString() + " - " + new Error().stack);
};

initVideo(socket);

let currentVideo: Video | undefined = undefined;
socket.on("state_set", (v: VideoState) => {
    currentVideo = v.video || undefined;
    if (currentVideo) {
        renderTitle();
    }
});

function renderTitle() {
    let title;
    if (currentVideo && (title = document.querySelector("#video-title"))) {
        title.innerHTML = currentVideo.title;
    }
}

async function loadUIComponents() {
    // load full-page styles
    await import(/* webpackChunkName: "index.scss" */ "./scss/index.scss");
    // dismiss initial heart loading spinner
    document.querySelector("#initial-loading-spinner")?.remove();
    const container = document.querySelector(
        "#container-container"
    ) as HTMLElement;
    container.style.display = "initial";
    (
        await import(/*webpackChunkName: "vue-comps"*/ "./vue/vue-index")
    ).loadIndexComps(socket, currentVideo);
}

loadUIComponents();
