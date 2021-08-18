import "normalize.css";
import "./index.css"
import "./fonts/fonts.css";
import Plyr from "plyr";
import "./node_modules/plyr/dist/plyr.css";

const playlist = [
    {
        type: "video",
        sources: [{ src: "/videos/jojo15.mp4", type: "video/mp4", size: 720 }],
        tracks: [{ kind: "subtitles", label: "English subs", srclang: "en", src: "/videos/jojo15.vtt", default: true }]
    }
]

let currentPlaylistItem = 0;

const player = new Plyr("#video-player", {
    title: "JOJO",
    controls: [
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "captions",
        "fullscreen",
        "settings"
    ],
    settings: ["captions"],
    captions: { active: true },
    invertTime: false,
    ratio: "16:9",
});

player.source = playlist[currentPlaylistItem];

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
