import "normalize.css";
import "./index.css";
import "../fonts/fonts.css";
import Plyr from "plyr";
import "../node_modules/plyr/dist/plyr.css";
import { io } from "socket.io-client";

let socket;

let playlist = [];
let currentPlaylistItem = 0;

let player = undefined;

const next = document.querySelector("#next-button");
const prev = document.querySelector("#prev-button");

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

function setCurrentSource() {
    if (!player) {
        return;
    }
    const newSource = {
        type: "video",
        title: playlist[currentPlaylistItem].title,
        sources: [playlist[currentPlaylistItem]],
    };
    player.source = newSource;
    renderPlaylistButtons();
    document.querySelector("#video-title").innerHTML = newSource.title;
}

function initVideoPlayer() {
    socket = io();
    socket.on("id_set", (e) => console.log("client has id", e));
    socket.onAny(function () {
        console.log(arguments);
    });

    player = new Plyr("#video-player", {
        title: "JOJO",
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

    player.on("canplaythrough", () => {
        socket.emit("change_buffering_state", false);
    });
    player.on("stalled", () => {
        socket.emit("change_buffering_state", true);
    });
    player.on("playing", () => {
        socket.emit("play_request");
    });
    player.on("seeking", () => console.log("client is seeking"));
    player.on("seeked", () => {
        console.log("client has seeked");
        console.log("current time is", player.currentTime);
    });
    player.on("pause", () => {
        socket.emit("pause_request");
    });

    socket.on("playlist_set", (newPlaylist) => {
        playlist = newPlaylist;
        setCurrentSource();
        renderPlaylistButtons();
    });
    socket.on("index_set", (newIndex) => {
        currentPlaylistItem = newIndex;
        setCurrentSource();
        renderPlaylistButtons();
    });
    socket.on("play", () => {
        player.play().catch((err) => {
            console.log(err);
            displayMessage(
                'someone else hit play, but your browser is blocking autoplay - u should click "play" too'
            );
            socket.emit("pause_request");
        });
    });
    socket.on("pause", () => player.pause());
    socket.on("message", (message) => console.log(message));
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

// set up playlist interactivity

function renderPlaylistButtons() {
    next.disabled = currentPlaylistItem == playlist.length - 1;
    prev.disabled = currentPlaylistItem == 0;
}

next.addEventListener("click", () => {
    socket.emit("next_item_request");
});
prev.addEventListener("click", () => {
    socket.emit("prev_item_request");
});

renderPlaylistButtons();
