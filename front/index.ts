import "normalize.css";
import(/* webpackChunkName: "index.css" */ "./scss/index.scss");
import "../fonts/fonts.css";
// load xp.css as raw, put it in a style element, and then modify the rules so that
// they only apply to elements within the .xp class
import(/* webpackChunkName: "xp.css" */ "!raw-loader!xp.css/dist/XP.css").then(
    (xpImport) => {
        const xp = xpImport.default as string;
        const xpStyle = document.createElement("style");
        xpStyle.innerHTML = xp;
        document.head.appendChild(xpStyle);
        if (xpStyle.sheet) {
            for (const rule of Array.from(xpStyle.sheet.cssRules)) {
                if (rule instanceof CSSStyleRule) {
                    rule.selectorText = ".xp " + rule.selectorText;
                }
            }

            // the best way to load the fonts is still to let the sass-loader import them though
            for (let i = xpStyle.sheet.cssRules.length - 1; i >= 0; i--) {
                if (xpStyle.sheet.cssRules[i] instanceof CSSFontFaceRule) {
                    xpStyle.sheet.deleteRule(i);
                }
            }
        } else {
            console.error("browser not generating xp style sheet properly");
        }
    }
);
import "xp.css/gui/_fonts.scss";

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

import(/* webpackChunkName: "vue-comps" */ "vue").then(async (Vue) => {
    const Chat = await import("./vue/vchat.vue");
    const Playlist = await import("./vue/playlist.vue");
    const Audience = await import("./vue/audience.vue");
    Vue.createApp(Chat.default, { socket }).mount("#chat-container");
    Vue.createApp(Playlist.default, { socket }).mount("#playlist-container");
    Vue.createApp(Audience.default).mount("#audience-container");
});

socket.on("playlist_set", (newPlaylist: Video[]) => {
    player.setPlaylist(newPlaylist);
    renderTitle();
});

socket.on("state_set", () => {
    renderTitle();
});

function renderTitle() {
    let title;
    let currentVideo = player.getPlaylist()[player.state.currentVideoIndex];
    if (currentVideo && (title = document.querySelector("#video-title"))) {
        title.innerHTML = currentVideo.title;
    }
}

// remove the loading spinner and create the video player once all the images have shown up
let importantImages = 0;
let loadedImages = 0;
let imagesComplete = false;
function checkImageCompletion() {
    if (loadedImages == importantImages && !imagesComplete) {
        imagesComplete = true;
        console.log("all images loaded");
        document.querySelector("#initial-loading-spinner")?.remove();
        const container = document.querySelector(
            "#container-container"
        ) as HTMLElement;
        container.style.display = "initial";
    }
}
for (const img of Array.from(document.querySelectorAll("img.wait-for-load"))) {
    importantImages += 1;
    if ((img as HTMLImageElement).complete) {
        loadedImages += 1;
        checkImageCompletion();
    } else {
        img.addEventListener("load", () => {
            loadedImages += 1;
            checkImageCompletion();
        });
    }
}
