import "normalize.css";

import { io } from "socket.io-client";

import { Video } from "../types";
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

socket.on("playlist_set", (newPlaylist: Video[]) => {
    player.setPlaylist(newPlaylist);
    renderTitle();
});

socket.on("state_set", () => {
    renderTitle();
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
    console.log(document.querySelector("#initial-loading-spinner"));
    document.querySelector("#initial-loading-spinner")?.remove();
    const container = document.querySelector(
        "#container-container"
    ) as HTMLElement;
    container.style.display = "initial";
    (await import(/*webpackChunkName: "vue-comps"*/ "./vue/vue-index")).default(
        socket
    );
}

loadUIComponents();
