import "normalize.css";
import "./index.scss";
import "../fonts/fonts.css";
import { io } from "socket.io-client";
import { Video } from "../types";
import initChat from "./chat";
import initVideo from "./video";

let popupTimer: NodeJS.Timeout | undefined = undefined;
function displayMessage(message: string) {
    const popup = document.querySelector("#toast") as HTMLDivElement;
    popup.innerHTML = message;
    popup.style.opacity = "1";
    if (popupTimer !== undefined) {
        clearTimeout(popupTimer);
    }
    popupTimer = setTimeout(() => {
        popup.style.opacity = "0";
        popupTimer = undefined;
    }, 4000);
}

const socket = io();
socket.on("id_set", (e) => console.log("client has id", e));
socket.on("ping", (pingID) => {
    socket.emit("pong_" + pingID);
});
socket.on("message", (message) => displayMessage(message));

const player = initVideo(socket);

socket.on("playlist_set", (newPlaylist: Video[]) => {
    player.playlist = newPlaylist;
    renderPlaylist();
});

document.querySelector("#playlist-header")?.addEventListener("click", () => {
    player.playlistShown = !player.playlistShown;
    renderPlaylist();
});
function renderPlaylist() {
    const playlist = player.playlist;
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
        const active = i == player.currentVideoIndex ? "active" : "not-active";
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
                // player.updateState({
                //     playing: false,
                //     currentTimeMs: 0,
                //     currentItem: i,
                // });
                renderPlaylist();
                // socket.emit("state_change_request", player.getCurrentState());
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
    item.appendChild(urlInput);
    const addButton = document.createElement("button");
    addButton.innerHTML = "+";
    addButton.style.marginLeft = "auto";
    addButton.addEventListener("click", () => {
        socket.once("add_video_failed", () => {
            addButton.disabled = false;
            urlInput.disabled = false;
            urlInput.value = "";
            urlInput.placeholder = "That didn't work :( try again?";
        });
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
