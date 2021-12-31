import "normalize.css";

import { io } from "socket.io-client";

import { Video, VideoState } from "../types";
import initVideo from "./video";
const socket = io();

socket.on("id_set", (e) => console.log("client has id", e));
socket.on("ping", () => {
    socket.emit("pong");
});

window.onerror = (event) => {
    socket.emit("error_report", event.toString() + " - " + new Error().stack);
};

const player = initVideo(socket);

socket.on("playlist_set", () => {
    renderTitle();
});

let currentVideo: Video | undefined = undefined;
socket.on("state_set", (v: VideoState) => {
    renderTitle();
    currentVideo = v.video || undefined;
});

function renderTitle() {
    let title;
    let currentVideo = player.currentVideo;
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
