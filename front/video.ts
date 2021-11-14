import { Socket } from "socket.io-client";
import { Video, VideoState } from "../types";

abstract class VideoController {
    abstract videoElement: HTMLElement;
    abstract setState(playlist: Video[], v: VideoState): void;
    abstract remove(): void;
}

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

class HTML5VideoController extends VideoController {
    videoElement: HTMLVideoElement;
    prevSrc: string = "";
    constructor() {
        super();
        const video = document.createElement("video");
        video.src = "";
        video.id = "player";
        video.controls = false;
        const container = document.querySelector("#video-container");
        if (!container) {
            console.error("could not select video container");
        } else {
            container.prepend(video);
        }
        this.videoElement = video;
    }

    setState(playlist: Video[], v: VideoState) {
        const currentSource = playlist[v.currentVideoIndex];
        if (currentSource.src != this.prevSrc) {
            this.videoElement.src = currentSource.src;
        }
        this.videoElement.currentTime = v.currentTimeMs / 1000;
        if (v.playing && this.videoElement.paused) {
            this.videoElement.play();
        } else if (!v.playing) {
            this.videoElement.pause();
        }
    }

    remove() {
        this.videoElement.remove();
    }
}

function initializePlayerInterface(io: Socket) {
    io.on("message", (message: string) => displayMessage(message));
}

class Player {
    playlist: Video[] = [];
    playlistShown: boolean = false;
    state: VideoState = {
        playing: false,
        currentVideoIndex: 0,
        currentTimeMs: 0,
    };
    controller: VideoController | null = null;
    constructor(io: Socket) {
        io.on("state_set", (new_state: VideoState) => {
            this.state = new_state;
            if (this.playlist.length > 0) {
                this.create_controller();
            }
            this.controller?.setState(this.playlist, this.state);
        });
        io.on("playlist_set", (newPlaylist: Video[]) => {
            this.playlist = newPlaylist;
            if (this.playlist.length > 0) {
                this.create_controller();
            }
            this.controller?.setState(this.playlist, this.state);
        });
    }
    create_controller() {
        if (
            !this.playlist[this.state.currentVideoIndex].provider &&
            !(this.controller instanceof HTML5VideoController)
        ) {
            this.controller = new HTML5VideoController();
            this.controller.setState(this.playlist, this.state);
        }
    }
}

function initVideo(io: Socket): Player {
    initializePlayerInterface(io);
    return new Player(io);
}

export default initVideo;
