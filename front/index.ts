import "normalize.css";
import "./scss/index.scss";
import "../fonts/fonts.css";
import { io } from "socket.io-client";
import { Video, VideoState } from "../types";
import initChat from "./chat";
import initVideo from "./video";

const socket = io();
socket.on("id_set", (e) => console.log("client has id", e));
socket.on("ping", (pingID) => {
    socket.emit("pong_" + pingID);
});

const player = initVideo(socket);

socket.on("playlist_set", (newPlaylist: Video[]) => {
    player.setPlaylist(newPlaylist);
    renderPlaylist();
});

document.querySelector("#playlist-header")?.addEventListener("click", () => {
    player.playlistShown = !player.playlistShown;
    renderPlaylist();
});
function renderPlaylist() {
    const playlist = player.getPlaylist();
    const cont = document.querySelector("#playlist-container");

    if (!cont) {
        console.error("playlist container element not found!");
        return;
    }

    for (const el of cont.querySelectorAll(".playlist-item")) {
        el.remove();
    }

    const display = player.playlistShown ? "" : "none";
    const header = document.querySelector("#playlist-header");
    if (header) {
        header.innerHTML = player.playlistShown ? "Playlist ▾" : "Playlist ▸";
    }
    for (let i = 0; i < playlist.length; i++) {
        const active =
            i == player.state.currentVideoIndex ? "active" : "not-active";
        const item = document.createElement("div");
        item.setAttribute("class", "playlist-item " + active);
        const icon = document.createElement("img");
        if (!playlist[i].provider) {
            icon.src = "images/video-file.svg";
        } else if (playlist[i].provider == "youtube") {
            icon.src = "images/youtube.svg";
        } else if (playlist[i].provider == "vimeo") {
            icon.src = "images/vimeo.svg";
        }
        icon.setAttribute("class", "playlist-icon");
        item.appendChild(icon);
        const text = document.createTextNode(playlist[i].title);
        item.appendChild(text);
        item.style.display = display;
        if (active == "not-active") {
            item.addEventListener("click", () => {
                const newState: VideoState = {
                    playing: false,
                    currentTimeMs: 0,
                    currentVideoIndex: i,
                };
                socket.emit("state_change_request", newState);
            });
        }

        cont.appendChild(item);
    }
    // add new item field
    const item = document.createElement("div");
    item.style.display = display;
    item.setAttribute("class", "playlist-item playlist-input");
    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.placeholder = "Type a Youtube or Vimeo URL...";
    socket.on("add_video_failed", () => {
        addButton.disabled = false;
        urlInput.disabled = false;
        urlInput.value = "";
        urlInput.placeholder = "That didn't work :( try again?";
    });
    item.appendChild(urlInput);
    const addButton = document.createElement("button");
    addButton.innerHTML = "+";
    addButton.style.marginLeft = "auto";
    addButton.addEventListener("click", () => {
        addButton.disabled = true;
        urlInput.disabled = true;
        socket.emit("add_video", urlInput.value);
    });
    item.appendChild(addButton);
    urlInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            addButton.click();
        }
    });

    cont.appendChild(item);
}

renderPlaylist();

initChat(socket);

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
