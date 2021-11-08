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

async function initVideoPlayer() {
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
            "captions",
        ],
        invertTime: false,
        ratio: "16:9",
        disableContextMenu: false,
        captions: { active: true, language: "auto" },
        youtube: { noCookie: true },
    });

    const playerReady = new Promise((resolve, reject) => {
        player.on("ready", () => {
            resolve();
        });
    });

    await playerReady;

    // used for comparisons to detect current item source and title changes
    player.lastItem = null;

    player.currentItem = 0;

    Object.defineProperty(player, "currentTimeMs", {
        get() {
            return this.currentTime * 1000;
        },
        set(newValue) {
            this.currentTime = newValue / 1000;
        },
    });

    player.ableToPlay = true;
    player.updateState = function (state) {
        if (state.playing != this.playing) {
            if (state.playing) {
                const playCall = this.play();
                if (playCall) {
                    // if playCall is a promise
                    playCall.catch(() => {
                        displayMessage(
                            "autoplay is blocked; press play to sync up with the server"
                        );
                        player.ableToPlay = false;
                    });
                }
            } else {
                this.pause();
            }
        }
        if (Math.abs(state.currentTimeMs - this.currentTimeMs) > 500) {
            console.log("updating player current time to", state.currentTimeMs);
            this.currentTimeMs = state.currentTimeMs;
        }
        this.currentItem = state.currentItem;
        if (playlist?.length) {
            if (playlist[this.currentItem].title != player.lastItem?.title) {
                document.querySelector("#video-title").innerHTML =
                    playlist[this.currentItem].title;
            }
            if (playlist[this.currentItem].src != player.lastItem?.src) {
                player.lastItem = playlist[this.currentItem];
                const newSource = {
                    type: "video",
                    title: playlist[this.currentItem].title,
                    sources: [playlist[this.currentItem]],
                };
                console.log("setting video source:");
                console.log(newSource);
                if (playlist[this.currentItem].captions) {
                    player.config.captions.active = true;
                    player.config.youtube.cc_load_policy = 1;
                } else {
                    player.config.captions.active = false;
                    player.config.youtube.cc_load_policy = 0;
                }
                player.source = newSource;
            }
        }
    };

    player.getCurrentState = function () {
        return {
            playing: this.playing,
            currentTimeMs: this.currentTimeMs,
            currentItem: this.currentItem,
            seek: this.seeking,
        };
    };

    player.on("playing", () => {
        console.log("local player emitted 'playing' event");
        if (!player.ableToPlay) {
            player.ableToPlay = true;
            socket.emit("state_update_request");
        } else {
            socket.emit("state_change_request", player.getCurrentState());
        }
    });

    player.on("pause", () => {
        console.log("local player emitted 'pause' event");
        socket.emit("state_change_request", player.getCurrentState());
    });

    player.on("seeked", () => {
        console.log("local player emitted 'seeked' event");
        console.log("current time is", player.currentTimeMs);
        socket.emit("state_change_request", {
            ...player.getCurrentState(),
            seek: true,
        });
    });

    socket.on("state_set", (newState) => {
        console.log("server sent state_set event");
        console.log(newState);
        player.updateState(newState);
        renderPlaylist();
    });
    socket.on("playlist_set", (newPlaylist) => {
        playlist = newPlaylist;
        for (const video of playlist) {
            // keep plyr from getting confused about what kind of video this is
            if (video.provider) {
                delete video.type;
                delete video.size;
            } else {
                delete video.provider;
            }
        }
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
        const header = document.querySelector("#playlist-header");
        header.innerHTML = playlistShown ? "Playlist ▾" : "Playlist ▸";
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
        // add new item field
        const item = document.createElement("div");
        item.style.display = playlistShown ? "flex" : "none";
        item.setAttribute("class", "playlist-item playlist-input");
        const urlInput = document.createElement("input");
        urlInput.setAttribute("type", "text");
        urlInput.setAttribute("placeholder", "Youtube or Vimeo URL...");
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
