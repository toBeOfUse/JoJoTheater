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

async function initVideoPlayer() {
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

    // set up playlist interactivity
}
