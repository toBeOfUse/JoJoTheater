import { Socket } from "socket.io-client";
import fscreen from "fscreen";
import { Video, VideoState } from "../types";

function secondsToHMS(seconds: number) {
    if (seconds < 3600) {
        return new Date(seconds * 1000).toISOString().substr(14, 5);
    } else {
        return new Date(seconds * 1000).toISOString().substr(11, 8);
    }
}

let userIsSeeking = false;

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

const DOMControls = {
    playPause: document.querySelector(
        "#play-pause-button"
    ) as HTMLButtonElement,
    playPauseImage: document.querySelector(
        "#play-pause-image"
    ) as HTMLImageElement,
    seek: document.querySelector("#seek") as HTMLInputElement,
    timeDisplay: document.querySelector("#time-display") as HTMLSpanElement,
    fullscreen: document.querySelector(
        "#fullscreen-button"
    ) as HTMLButtonElement,
    fullscreenImage: document.querySelector(
        "#fullscreen-image"
    ) as HTMLImageElement,
};

/**
 * Responsible for creating and removing the DOM element that will directly display
 * the video (i. e. a <video> tag or an iframe containing embedded video) and
 * applying the state held by an instance of Player to it. Subclassed to deal with
 * aforementioned different elements for different video sources.
 */
abstract class VideoController {
    abstract videoElement: HTMLElement;
    abstract get currentTimeMs(): number;
    abstract get durationMs(): number;
    abstract setState(playlist: Video[], v: VideoState): void;
    abstract remove(): void;
}

class HTML5VideoController extends VideoController {
    videoElement: HTMLVideoElement;
    prevSrc: string = "";
    get currentTimeMs(): number {
        return this.videoElement?.currentTime * 1000 || 0;
    }
    get durationMs(): number {
        return this.videoElement?.duration * 1000 || 0;
    }
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
        this.videoElement.addEventListener("durationchange", () => {
            DOMControls.timeDisplay.innerHTML = secondsToHMS(video.duration);
        });
        this.videoElement.addEventListener("timeupdate", () => {
            DOMControls.seek.value = String(
                (video.currentTime / video.duration) * 100
            );
        });
    }

    setState(playlist: Video[], v: VideoState) {
        const currentSource = playlist[v.currentVideoIndex];
        if (currentSource.src != this.prevSrc) {
            console.log("changing <video> src");
            this.videoElement.src = currentSource.src;
            this.prevSrc = currentSource.src;
        }
        console.log("setting video current time to", v.currentTimeMs / 1000);
        this.videoElement.currentTime = v.currentTimeMs / 1000;
        if (v.playing && this.videoElement.paused) {
            DOMControls.playPauseImage.src = "/images/pause.svg";
            try {
                this.videoElement.play();
            } catch (e) {
                console.error("could not play");
                console.error(e);
            }
        } else if (!v.playing) {
            DOMControls.playPauseImage.src = "/images/play.svg";
            this.videoElement.pause();
        }
    }

    remove() {
        this.videoElement.remove();
    }
}

const youtubeAPIReady = new Promise<void>((resolve, reject) => {
    (<any>window).onYouTubeIframeAPIReady = () => {
        console.log("youtube api ready");
        resolve();
    };
    // from https://developers.google.com/youtube/iframe_api_reference
    let tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    let firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
});

class YoutubeVideoController extends VideoController {
    videoElement: HTMLDivElement;
    YTPlayer: YT.Player | null = null;
    YTPlayerReady: Promise<void> | null = null;
    prevSrc: string = "";
    timeUpdate: NodeJS.Timeout | undefined;

    constructor() {
        super();
        this.videoElement = document.createElement("div");
        this.videoElement.id = "youtube-embed-location";
        const container = document.querySelector("#video-container");
        if (!container) {
            console.error("could not select video container");
        } else {
            container.prepend(this.videoElement);
        }
    }

    get currentTimeMs(): number {
        if (!this.YTPlayer) {
            return 0;
        } else {
            return this.YTPlayer.getCurrentTime() * 1000;
        }
    }

    get durationMs(): number {
        if (!this.YTPlayer) {
            return 0;
        } else {
            return this.YTPlayer.getDuration() * 1000;
        }
    }

    async setState(playlist: Video[], v: VideoState) {
        await youtubeAPIReady;
        const currentSource = playlist[v.currentVideoIndex];
        if (currentSource.src != this.prevSrc) {
            this.prevSrc = currentSource.src;
            if (!this.YTPlayer) {
                console.log("creating new YT.Player");
                this.YTPlayerReady = new Promise((resolve) => {
                    this.YTPlayer = new YT.Player("youtube-embed-location", {
                        height: "100%",
                        width: "100%",
                        videoId: currentSource.src,
                        playerVars: {
                            playsinline: 1,
                            cc_load_policy: currentSource.captions ? 1 : 0,
                            controls: 0,
                            enablejsapi: 1,
                            modestbranding: 1,
                            rel: 0,
                            autoplay: 0,
                        },
                        events: {
                            onReady: () => {
                                resolve();
                            },
                            onStateChange: (event) => {
                                const ytstate = {
                                    "-1": "unstarted",
                                    0: "ended",
                                    1: "playing",
                                    2: "paused",
                                    3: "buffering",
                                    5: "video cued",
                                };
                                console.log(
                                    "YT player state change to " +
                                        ytstate[event.data]
                                );
                                console.log(event);
                            },
                        },
                    });
                    this.timeUpdate = setInterval(async () => {
                        await this.YTPlayerReady;
                        if (this.YTPlayer) {
                            DOMControls.timeDisplay.innerHTML = secondsToHMS(
                                this.YTPlayer.getDuration()
                            );
                            if (!userIsSeeking) {
                                DOMControls.seek.value = String(
                                    (this.YTPlayer.getCurrentTime() /
                                        this.YTPlayer.getDuration()) *
                                        100
                                );
                            }
                        }
                    }, 500);
                });
            } else {
                console.log("changing source for YT.Player");
                await this.YTPlayerReady;
                this.YTPlayer?.cueVideoById(currentSource.src);
            }
        }
        await this.YTPlayerReady;
        this.YTPlayer?.seekTo(v.currentTimeMs / 1000, true);
        if (this.YTPlayer?.getPlayerState() == 0) {
            // if playback has ended
            this.YTPlayer.pauseVideo();
        }
        if (
            v.playing &&
            this.YTPlayer?.getPlayerState() != YT.PlayerState.PLAYING
        ) {
            this.YTPlayer?.playVideo();
            DOMControls.playPauseImage.src = "/images/pause.svg";
        } else if (
            !v.playing &&
            this.YTPlayer?.getPlayerState() == YT.PlayerState.PLAYING
        ) {
            this.YTPlayer.pauseVideo();
            DOMControls.playPauseImage.src = "/images/play.svg";
        }
    }
    remove() {
        if (this.YTPlayer) {
            this.YTPlayer.destroy();
        }
        if (this.videoElement) {
            this.videoElement.remove();
        }
        if (this.timeUpdate) {
            clearInterval(this.timeUpdate);
        }
    }
}

/**
 * Function that creates listeners for events that occur on the DOMControls elements
 * to send the appropriate messages back to the server to request changes in the
 * video state.
 * @param io Socket.io client used for communicating with the server
 * @param player instance of Player used to determine the current player state, so
 * that we can  request specific changes to it
 */
function initializePlayerInterface(io: Socket, player: Player) {
    io.on("message", (message: string) => displayMessage(message));
    DOMControls.playPause.addEventListener("click", () => {
        io.emit("state_change_request", {
            ...player.state,
            currentTimeMs: player.updatedCurrentTimeMs,
            playing: !player.state.playing,
        });
    });
    // store whether the player was playing, pre-seek and restore in endSeek?
    const beginSeek = () => {
        userIsSeeking = true;
        io.emit("state_change_request", {
            ...player.state,
            currentTimeMs: player.updatedCurrentTimeMs,
            playing: false,
        });
    };
    const performSeek = () => {
        if (userIsSeeking && player.controller) {
            const newTimeMs =
                (Number(DOMControls.seek.value) / 100) *
                player.controller?.durationMs;
            io.emit("state_change_request", {
                ...player.state,
                currentTimeMs: newTimeMs,
                playing: false,
            });
        }
    };
    const endSeek = () => {
        userIsSeeking = false;
    };
    DOMControls.seek.addEventListener("mousedown", beginSeek);
    DOMControls.seek.addEventListener("touchstart", beginSeek);
    DOMControls.seek.addEventListener("input", performSeek);
    DOMControls.seek.addEventListener("mouseup", endSeek);
    DOMControls.seek.addEventListener("touchend", endSeek);
    let currentlyFullscreen = false;
    const videoCont = document.querySelector("#video-container");
    fscreen.addEventListener("fullscreenchange", () => {
        if (fscreen.fullscreenElement) {
            currentlyFullscreen = true;
            DOMControls.fullscreenImage.src = "/images/exitfullscreen.svg";
            videoCont?.classList.add("fullscreen");
        } else {
            currentlyFullscreen = false;
            DOMControls.fullscreenImage.src = "/images/enterfullscreen.svg";
            videoCont?.classList.remove("fullscreen");
        }
    });
    DOMControls.fullscreen.addEventListener("click", () => {
        if (videoCont && !currentlyFullscreen) {
            fscreen.requestFullscreen(videoCont);
        } else if (currentlyFullscreen) {
            fscreen.exitFullscreen();
        }
    });
}

/**
 * Responsible for the current state of the video being played. Is a singleton,
 * assuming we only want one video playing at a time, which is all our HTML is set up
 * for. Creates, updates, and destroys instances of VideoController at will to
 * represent itself in the DOM. Receives state updates from the server.
 */
class Player {
    private playlist: Video[] = []; // use getter/setter
    playlistShown: boolean = false;
    state: VideoState = {
        playing: false,
        currentVideoIndex: 0,
        currentTimeMs: 0,
    };
    controller: VideoController | null = null;
    get updatedCurrentTimeMs(): number {
        return this.controller?.currentTimeMs || 0;
    }
    constructor(io: Socket) {
        io.on("state_set", (new_state: VideoState) => {
            this.state = new_state;
            if (this.playlist.length > 0) {
                this.createController();
            }
            this.controller?.setState(this.playlist, this.state);
        });
    }
    setPlaylist(newPlaylist: Video[]) {
        this.playlist = newPlaylist;
        if (this.playlist.length > 0) {
            this.createController();
        }
        this.controller?.setState(this.playlist, this.state);
    }
    getPlaylist(): Video[] {
        return this.playlist;
    }
    createController() {
        if (
            !this.playlist[this.state.currentVideoIndex].provider &&
            !(this.controller instanceof HTML5VideoController)
        ) {
            if (this.controller) {
                this.controller.remove();
            }
            console.log("creating new HTML5VideoController");
            this.controller = new HTML5VideoController();
        } else if (
            this.playlist[this.state.currentVideoIndex].provider == "youtube" &&
            !(this.controller instanceof YoutubeVideoController)
        ) {
            if (this.controller) {
                this.controller.remove();
            }
            console.log("creating new YoutubeVideoController");
            this.controller = new YoutubeVideoController();
        }
    }
}

function initVideo(io: Socket): Player {
    const player = new Player(io);
    initializePlayerInterface(io, player);
    return player;
}

export default initVideo;
