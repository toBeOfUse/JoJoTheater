import "normalize.css";

import { io } from "socket.io-client";

import { Video, VideoState } from "../types";
import initVideo from "./video";
import globals from "./globals";
const socket = io();

socket.on("grant_token", (token: string) => {
    globals.set("token", token);
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

const resizeVideoContainer = () => {
    const cont = document.querySelector("#video-container") as HTMLDivElement;
    if (cont && cont.parentElement) {
        const height = window.innerHeight * 0.7;
        const maxWidth = cont.parentElement.offsetWidth;
        const allegedWidth = height * (16 / 9);
        const actualWidth = Math.min(maxWidth, allegedWidth);
        console.log("video container max width", maxWidth);
        cont.style.height = actualWidth * (9 / 16) + "px";
        cont.style.width = actualWidth + "px";
    }
};

async function loadUIComponents() {
    // load full-page styles
    await import(/* webpackChunkName: "index.scss" */ "./scss/index.scss");
    // dismiss initial heart loading spinner
    document.querySelector("#initial-loading-spinner")?.remove();
    const container = document.querySelector(
        "#container-container"
    ) as HTMLElement;
    container.style.display = "initial";
    // resize video container now that everything that needs to be observed
    // exists
    resizeVideoContainer();
    window.addEventListener("resize", resizeVideoContainer);
    // load all the dynamic vue components
    (
        await import(/*webpackChunkName: "vue-comps"*/ "./vue/vue-index")
    ).loadIndexComps(socket, currentVideo);
}

window.addEventListener("load", loadUIComponents);
