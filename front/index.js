import "normalize.css";
import "./index.css";
import "../fonts/fonts.css";
import Plyr from "plyr";
import "../node_modules/plyr/dist/plyr.css";

// create playlist

const playlist = [
    {
        type: "video",
        sources: [{ src: "/videos/s01e16.mp4", type: "video/mp4", size: 720 }],
    }
]

let currentPlaylistItem = 0;

let player = undefined;

function initVideoPlayer() {
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
    });

    // log video events

    player.on("canplaythrough", () => console.log("client can play through"));
    player.on("playing", () => {
        console.log("client has started playing")
    });
    player.on("seeking", () => console.log("client is seeking"));
    player.on("seeked", () => {
        console.log("client has seeked");
        console.log("current time is", player.currentTime);
    });
    player.on("pause", () => console.log("client has paused"));

    // give the player something to play
    player.source = playlist[currentPlaylistItem];
}

// remove the loading spinner and create the video player once all the images have shown up
let importantImages = 0;
let loadedImages = 0;
function checkImageCompletion() {
    if (loadedImages == importantImages) {
        console.log("all images loaded");
        document.querySelector("#initial-loading-spinner").remove();
        document.querySelector("#container-container").style.display = "initial";
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
const next = document.querySelector("#next-button");
const prev = document.querySelector("#prev-button");

function renderPlaylistButtons() {
    next.setAttribute("disabled", currentPlaylistItem == playlist.length - 1);
    prev.setAttribute("disabled", currentPlaylistItem == 0);
}

function moveWithinPlaylist(to) {
    if (to > playlist.length - 1 || to < 0) {
        return;
    }
    currentPlaylistItem = to;
    player.source = playlist[to];
    renderPlaylistButtons();
}

next.addEventListener("click", () => {
    moveWithinPlaylist(currentPlaylistItem + 1);
});
prev.addEventListener("click", () => {
    moveWithinPlaylist(currentPlaylistItem - 1);
});

renderPlaylistButtons();
