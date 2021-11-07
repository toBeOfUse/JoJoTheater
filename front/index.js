import "normalize.css";
import "./index.scss";
import "../fonts/fonts.css";
import Plyr from "plyr";
import "../node_modules/plyr/dist/plyr.css";
import { io } from "socket.io-client";
import initChat from "./chat.ts";

let socket;

let playlist = [];

let player = undefined;

let popupTimer = undefined;
function displayMessage(message) {
    const popup = document.querySelector("#toast");
    popup.innerHTML = message;
    popup.style.opacity = 1;
    if (popupTimer !== undefined) {
        clearTimeout(popupTimer);
    }
    popupTimer = setTimeout(() => {
        popup.style.opacity = 0;
        popupTimer = undefined;
    }, 4000);
}

function initVideoPlayer() {
    socket = io();
    socket.on("id_set", (e) => console.log("client has id", e));
    socket.on("ping", (pingID) => {
        socket.emit("pong_" + pingID);
    });

    player = new Plyr("#video-player", {
        title: "MitchBot Player",
        controls: [
            "play",
            "progress",
            "current-time",
            "mute",
            "volume",
            "fullscreen",
        ],
        invertTime: false,
        ratio: "16:9",
        disableContextMenu: false,
    });

    player.lastPlaylist = playlist;
    player.currentItem = 0;

    Object.defineProperty(player, "currentTimeMs", {
        get() {
            return this.currentTime * 1000;
        },
        set(newValue) {
            this.currentTime = newValue / 1000;
        },
    });

    let waitingForUserInteraction = false;
    let firstPlay = true;
    player.ignoreNext = [];
    player.updateState = function (state) {
        if (state.playing != this.playing) {
            if (state.playing) {
                this.ignoreNext.push("playing");
                this.play().catch(() => {
                    displayMessage(
                        "autoplay is blocked; press play to sync up with the server"
                    );
                    this.ignoreNext.splice(
                        this.ignoreNext.indexOf("playing"),
                        1
                    );
                    waitingForUserInteraction = true;
                });
            } else {
                this.ignoreNext.push("pause");
                this.pause();
            }
        }
        if (Math.abs(state.currentTimeMs - this.currentTimeMs) > 100) {
            console.log("updating player current time to", state.currentTimeMs);
            this.ignoreNext.push("seeked");
            this.ignoreNext.push("playing");
            this.currentTimeMs = state.currentTimeMs;
        }
        if (
            state.currentItem != this.currentItem ||
            playlist != player.lastPlaylist
        ) {
            player.lastPlaylist = playlist;
            this.currentItem = state.currentItem;
            const newSource = {
                type: "video",
                title: playlist[this.currentItem].title,
                sources: [playlist[this.currentItem]],
            };
            player.source = newSource;
            document.querySelector("#video-title").innerHTML = newSource.title;
        }
    };

    player.getCurrentState = function () {
        return {
            playing: this.playing,
            currentTimeMs: this.currentTimeMs,
            currentItem: this.currentItem,
        };
    };

    player.on("playing", () => {
        console.log("local player emitted 'playing' event");
        if (firstPlay) {
            firstPlay = false;
            // we need an extra state update the first time the player starts playing
            // bc sometimes setting the current time in the initial
            // player.updateState() doesn't work bc it's not ready yet. apparently
            socket.emit("state_update_request");
        }
        if (!player.ignoreNext.includes("playing")) {
            if (waitingForUserInteraction) {
                waitingForUserInteraction = false;
                socket.emit("state_update_request");
            } else {
                socket.emit("state_change_request", player.getCurrentState());
            }
        } else {
            console.log("ignoring 'playing' event");
            player.ignoreNext.splice(player.ignoreNext.indexOf("playing"), 1);
        }
    });

    player.on("pause", () => {
        console.log("local player emitted 'pause' event");
        if (!player.ignoreNext.includes("pause")) {
            socket.emit("state_change_request", player.getCurrentState());
        } else {
            player.ignoreNext.splice(player.ignoreNext.indexOf("pause"), 1);
        }
    });

    player.on("seeked", () => {
        console.log("local player emitted 'seeked' event");
        if (!player.ignoreNext.includes("seeked")) {
            socket.emit("state_change_request", player.getCurrentState());
        } else {
            console.log("ignoring 'seeking' event");
            player.ignoreNext.splice(player.ignoreNext.indexOf("seeked"), 1);
        }
    });

    socket.on("state_set", (newState) => {
        console.log("server sent state_set event");
        console.log(newState);
        player.updateState(newState);
        renderPlaylist();
    });
    socket.on("playlist_set", (newPlaylist) => {
        playlist = newPlaylist;
        player.updateState(player.getCurrentState()); // shrug
        renderPlaylist();
    });
    socket.on("message", (message) => displayMessage(message));

    // set up playlist interactivity
    let playlistShown = false;
    document.querySelector("#playlist-header").addEventListener("click", () => {
        playlistShown = !playlistShown;
        renderPlaylist();
    });
    function renderPlaylist() {
        const cont = document.querySelector("#playlist-container");
        for (const el of cont.querySelectorAll(".playlist-item")) {
            el.remove();
        }
        const display = playlistShown ? "block" : "none";
        for (let i = 0; i < playlist.length; i++) {
            const active = i == player.currentItem ? "active" : "not-active";
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
                    player.updateState({
                        playing: false,
                        currentTimeMs: 0,
                        currentItem: i,
                    });
                    renderPlaylist();
                    socket.emit(
                        "state_change_request",
                        player.getCurrentState()
                    );
                });
            }
            cont.appendChild(item);
        }
    }

    renderPlaylist();

    initChat(socket);
}

// remove the loading spinner and create the video player once all the images have shown up
let importantImages = 0;
let loadedImages = 0;
let imagesComplete = false;
function checkImageCompletion() {
    if (loadedImages == importantImages && !imagesComplete) {
        imagesComplete = true;
        console.log("all images loaded");
        document.querySelector("#initial-loading-spinner").remove();
        document.querySelector("#container-container").style.display =
            "initial";
        initVideoPlayer();
    }
}
for (const img of Array.from(document.querySelectorAll(".wait-for-load"))) {
    importantImages += 1;
    if (img.complete) {
        loadedImages += 1;
        checkImageCompletion();
    } else {
        img.addEventListener("load", () => {
            loadedImages += 1;
            checkImageCompletion();
        });
    }
}
