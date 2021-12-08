import { Socket } from "socket.io-client";
import fscreen from "fscreen";
import VimeoPlayer from "@vimeo/player";
import { Video, VideoState, StateChangeRequest, StateElements } from "../types";

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
    videoContainer: document.querySelector(
        "#video-container"
    ) as HTMLDivElement,
    controlsContainer: document.querySelector(
        "#controls-overlay"
    ) as HTMLDivElement,
    loadingSpinner: document.querySelector(
        "#video-loading-spinner"
    ) as SVGElement,
};

function setSeekDisplay(percentWatched: number) {
    if (!userIsSeeking) {
        DOMControls.seek.value = String(percentWatched);
    }
}

function setTimeDisplay(currentTimeS: number, durationS: number) {
    DOMControls.timeDisplay.innerHTML =
        secondsToHMS(currentTimeS) + " / " + secondsToHMS(durationS);
}

function setTimeAndSeek(currentTimeS: number, durationS: number) {
    if (!isNaN(currentTimeS) && !isNaN(durationS) && durationS != 0) {
        setTimeDisplay(currentTimeS, durationS);
        setSeekDisplay((currentTimeS / durationS) * 100);
    } else {
        setTimeDisplay(0, 0);
        setSeekDisplay(0);
    }
}

function setAspectRatio(aspect: number) {
    const neededPadding = (1 / aspect) * 100;
    // max out container aspect ratio at 4:3 to keep videos from going off the top
    // and bottom of the screen
    DOMControls.videoContainer.style.paddingTop =
        Math.min(neededPadding, 75) + "%";
}

function showSpinner() {
    DOMControls.loadingSpinner.style.display = "unset";
    const animateElement = DOMControls.loadingSpinner.querySelector(
        "animateTransform"
    ) as any;
    animateElement.beginElement();
}

function hideSpinner() {
    if (DOMControls.loadingSpinner.style.display == "none") {
        return;
    }
    const animateElement = DOMControls.loadingSpinner.querySelector(
        "animateTransform"
    ) as any;
    const stop = () => {
        animateElement.endElement();
        DOMControls.loadingSpinner.style.display = "none";
    };
    if ("onrepeat" in animateElement) {
        (animateElement as any).onrepeat = stop;
    } else {
        stop();
    }
}

function playButtonIcon(setTo: "play" | "pause") {
    if (setTo == "play") {
        DOMControls.playPauseImage.src = "/images/play.svg";
    } else {
        DOMControls.playPauseImage.src = "/images/pause.svg";
    }
}

/**
 * Responsible for creating and removing the DOM element that will directly display
 * the video (i. e. a <video> tag or an iframe containing embedded video), applying
 * the state held by an instance of Player to it, and updating the play/pause button
 * image, the seek slider, and the duration/current time display as the underlying
 * video state changes. Subclassed to deal with different elements and APIs for
 * different video sources.
 */
abstract class VideoController {
    abstract videoElement: HTMLElement;
    abstract get currentTimeMs(): number;
    abstract get durationMs(): number;
    abstract setState(source: Video, v: VideoState): void;
    abstract isPlaying(): Promise<boolean>;
    abstract remove(): void;
    // called directly from onclick listener to signal user intent to autoplay blockers
    abstract manuallyPressPlay(): void;
    abstract videoReady: Promise<void>;
}

class HTML5VideoController extends VideoController {
    videoElement: HTMLVideoElement;
    videoReady: Promise<void>;
    prevSrc: string = "";
    get currentTimeMs(): number {
        return this.videoElement?.currentTime * 1000 || 0;
    }
    get durationMs(): number {
        return this.videoElement?.duration * 1000 || 0;
    }
    constructor(source: Video, state: VideoState) {
        super();
        const video = document.createElement("video");
        video.src = "";
        video.id = "player";
        video.controls = false;
        DOMControls.videoContainer.prepend(video);
        this.videoElement = video;
        this.videoElement.addEventListener("loadedmetadata", () => {
            setAspectRatio(
                this.videoElement.videoWidth / this.videoElement.videoHeight
            );
        });
        this.videoReady = new Promise((resolve) => {
            this.videoElement.addEventListener("loadeddata", () => {
                resolve();
            });
        });
        this.videoElement.addEventListener("durationchange", () => {
            setTimeAndSeek(video.currentTime, video.duration);
        });
        this.videoElement.addEventListener("timeupdate", () => {
            setTimeAndSeek(video.currentTime, video.duration);
        });
        this.videoElement.addEventListener("play", () =>
            playButtonIcon("pause")
        );
        this.videoElement.addEventListener("pause", () =>
            playButtonIcon("play")
        );
        this.videoElement.addEventListener("ended", () =>
            playButtonIcon("play")
        );
        // this.videoElement.addEventListener("waiting", () =>
        //     displayMessage("Buffering...")
        // );
        this.videoElement.volume = 1;
        this.setState(source, state);
    }

    setState(currentSource: Video, v: VideoState) {
        if (currentSource.src != this.prevSrc) {
            console.log("changing <video> src");
            setSeekDisplay(0);
            this.videoElement.src = currentSource.src;
            this.prevSrc = currentSource.src;
        }
        console.log("setting video current time to", v.currentTimeMs / 1000);
        if (
            Math.abs(this.videoElement.currentTime * 1000 - v.currentTimeMs) >
            1000
        ) {
            this.videoElement.currentTime = v.currentTimeMs / 1000;
        }
        if (v.playing && this.videoElement.paused && !this.videoElement.ended) {
            try {
                this.videoElement.play();
            } catch (e) {
                console.error("could not play");
                console.error(e);
            }
        } else if (!v.playing) {
            this.videoElement.pause();
        }
    }

    manuallyPressPlay() {
        if (!this.videoElement.ended) {
            this.videoElement.play();
        }
    }

    async isPlaying() {
        return !this.videoElement.paused;
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
    videoReady: Promise<void>;
    _videoReady: boolean = false;
    prevSrc: string;
    timeUpdate: NodeJS.Timeout | undefined;

    constructor(currentSource: Video, state: VideoState) {
        super();
        this.videoElement = document.createElement("div");
        this.videoElement.id = "youtube-embed-location";
        const container = document.querySelector("#video-container");
        if (!container) {
            console.error("could not select video container");
        } else {
            container.prepend(this.videoElement);
        }
        console.log("creating new YT.Player");
        this.videoReady = new Promise(async (resolve) => {
            await youtubeAPIReady;
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
                    showinfo: 0,
                },
                events: {
                    onReady: () => {
                        this._videoReady = true;
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
                            "YT player state change to " + ytstate[event.data]
                        );
                        console.log(event);
                        if (event.data == 0 || event.data == 2) {
                            playButtonIcon("play");
                        } else if (event.data == 1 || event.data == 3) {
                            playButtonIcon("pause");
                            if (event.data == 3) {
                                // displayMessage("Buffering...");
                            }
                        }
                    },
                },
            });
            this.timeUpdate = setInterval(async () => {
                await this.videoReady;
                if (this.YTPlayer) {
                    const duration = this.YTPlayer.getDuration();
                    const current = this.YTPlayer.getCurrentTime();
                    setTimeAndSeek(current, duration);
                }
            }, 500);
        });
        this.prevSrc = currentSource.src;
        this.setState(currentSource, state);
    }

    get currentTimeMs(): number {
        if (!this.YTPlayer || !this._videoReady) {
            return 0;
        } else {
            return this.YTPlayer.getCurrentTime() * 1000;
        }
    }

    get durationMs(): number {
        if (!this.YTPlayer || !this._videoReady) {
            return 0;
        } else {
            return this.YTPlayer.getDuration() * 1000;
        }
    }

    async isPlaying() {
        if (!this.YTPlayer || !this._videoReady) {
            return false;
        } else {
            return this.YTPlayer.getPlayerState() == 1;
        }
    }

    manuallyPressPlay() {
        if (
            this.YTPlayer &&
            this._videoReady &&
            this.YTPlayer.getPlayerState() != YT.PlayerState.ENDED
        ) {
            this.YTPlayer.playVideo();
        }
    }

    async setState(currentSource: Video, v: VideoState) {
        await this.videoReady;
        if (!this.YTPlayer) {
            return; // something went terribly wrong in the constructor
        }
        if (currentSource.src != this.prevSrc) {
            this.prevSrc = currentSource.src;

            console.log("changing source for YT.Player");
            await this.videoReady;
            this.YTPlayer?.cueVideoById(currentSource.src);
        }
        this.YTPlayer.setVolume(100);
        if (Math.abs(this.currentTimeMs - v.currentTimeMs) > 1000) {
            this.YTPlayer.seekTo(v.currentTimeMs / 1000, true);
        }
        if (
            v.playing &&
            this.YTPlayer.getPlayerState() != YT.PlayerState.PLAYING &&
            this.YTPlayer.getPlayerState() != YT.PlayerState.ENDED
        ) {
            this.YTPlayer.playVideo();
        } else if (
            !v.playing &&
            this.YTPlayer.getPlayerState() == YT.PlayerState.PLAYING
        ) {
            this.YTPlayer.pauseVideo();
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

class VimeoVideoController extends VideoController {
    videoElement: HTMLDivElement;
    vimeoPlayer: VimeoPlayer;
    prevSrc: string = "";
    cachedDurationMs: number = 0;
    cachedCurrentTimeMs: number = 0;
    videoReady: Promise<void>;

    constructor(currentSource: Video, state: VideoState) {
        super();
        this.videoElement = document.createElement("div");
        this.videoElement.id = "vimeo-embed-location";
        const container = document.querySelector("#video-container");
        if (!container) {
            console.error("could not select video container");
        } else {
            container.prepend(this.videoElement);
        }
        this.vimeoPlayer = new VimeoPlayer("vimeo-embed-location", {
            id: Number(currentSource.src),
            controls: false,
            responsive: true,
            loop: false,
        });
        this.vimeoPlayer.on("timeupdate", (e) => {
            setTimeAndSeek(e.seconds, e.duration);
            this.cachedDurationMs = e.duration * 1000;
            this.cachedCurrentTimeMs = e.seconds * 1000;
        });
        this.vimeoPlayer.on("play", () => playButtonIcon("pause"));
        this.vimeoPlayer.on("pause", () => playButtonIcon("play"));
        this.vimeoPlayer.on("ended", () => playButtonIcon("play"));
        this.vimeoPlayer.setVolume(1);
        this.videoReady = new Promise<void>((resolve) => {
            this.vimeoPlayer.on("loaded", resolve);
        });
        this.setState(currentSource, state);
    }

    get durationMs(): number {
        return this.cachedDurationMs;
    }

    get currentTimeMs(): number {
        return this.cachedCurrentTimeMs;
    }

    async isPlaying() {
        if (!this.vimeoPlayer) {
            return false;
        } else {
            return !(await this.vimeoPlayer.getPaused());
        }
    }

    async setState(currentSource: Video, v: VideoState) {
        if (currentSource.src != this.prevSrc) {
            this.prevSrc = currentSource.src;
            this.vimeoPlayer.loadVideo(Number(currentSource.src));
        }
        const isPaused = await this.vimeoPlayer.getPaused();
        const isEnded = await this.vimeoPlayer.getEnded();
        if (v.playing && isPaused && !isEnded) {
            await this.vimeoPlayer.play();
        } else if (!v.playing && !isPaused) {
            await this.vimeoPlayer.pause();
        }
        const playerCurrentTime = await this.vimeoPlayer.getCurrentTime();
        if (Math.abs(playerCurrentTime * 1000 - v.currentTimeMs) > 1000) {
            this.vimeoPlayer.setCurrentTime(
                Math.min(v.currentTimeMs / 1000, this.cachedDurationMs)
            );
        }
    }

    manuallyPressPlay() {
        if (this.cachedCurrentTimeMs != this.cachedDurationMs) {
            this.vimeoPlayer.play();
        }
    }

    remove() {
        if (this.vimeoPlayer) {
            this.vimeoPlayer.destroy();
        }
        if (this.videoElement) {
            this.videoElement.remove();
        }
    }
}

/**
 * Function that creates listeners for events that occur on the DOMControls elements,
 * to send the appropriate messages back to the server to request changes in the
 * video state and enter and exit fullscreen mode, as well as directly triggering the
 * player to play the first time so that autoplay blocking will see that the user is
 * specifically trying to play the video.
 * @param io Socket.io client used for communicating with the server
 * @param player instance of Player used to determine the current player state, so
 * we have a basis for our modifications
 */
function initializePlayerInterface(io: Socket, player: Player) {
    io.on("alert", (message: string) => displayMessage(message));
    DOMControls.playPause.addEventListener("click", () => {
        const changeRequest: StateChangeRequest = {
            whichElement: StateElements.playing,
            newValue: !player.state.playing,
        };
        io.emit("state_change_request", changeRequest);
        // signal direct user intent to autoplay blockers
        if (changeRequest.newValue && player.controller) {
            player.controller.manuallyPressPlay();
        }
    });
    // store whether the player was playing, pre-seek and restore in endSeek?
    const beginSeek = () => {
        userIsSeeking = true;
        const changeRequest: StateChangeRequest = {
            whichElement: StateElements.playing,
            newValue: false,
        };
        io.emit("state_change_request", changeRequest);
    };
    const performSeek = () => {
        if (userIsSeeking && player.controller) {
            const newTimeMs =
                (Number(DOMControls.seek.value) / 100) *
                player.controller?.durationMs;
            const changeRequest: StateChangeRequest = {
                whichElement: StateElements.time,
                newValue: newTimeMs,
            };
            io.emit("state_change_request", changeRequest);
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
    let runningFadeoutTimer: NodeJS.Timeout | undefined = undefined;
    DOMControls.videoContainer.addEventListener("mousemove", () => {
        if (runningFadeoutTimer) {
            clearTimeout(runningFadeoutTimer);
        }
        DOMControls.controlsContainer.classList.remove("fadedOut");
        runningFadeoutTimer = setTimeout(() => {
            DOMControls.controlsContainer.classList.add("fadedOut");
        }, 3000);
    });
    let currentlyFullscreen = false;
    fscreen.addEventListener("fullscreenchange", () => {
        if (fscreen.fullscreenElement) {
            currentlyFullscreen = true;
            DOMControls.fullscreenImage.src = "/images/exitfullscreen.svg";
            DOMControls.videoContainer.classList.add("fullscreen");
        } else {
            currentlyFullscreen = false;
            DOMControls.fullscreenImage.src = "/images/enterfullscreen.svg";
            DOMControls.videoContainer.classList.remove("fullscreen");
        }
    });
    DOMControls.fullscreen.addEventListener("click", () => {
        if (!currentlyFullscreen) {
            try {
                fscreen.requestFullscreen(DOMControls.videoContainer);
            } catch {
                displayMessage("fullscreen blocked by your device");
            }
        } else if (currentlyFullscreen) {
            fscreen.exitFullscreen();
        }
    });
}

/**
 * Responsible for holding the current state of the video being played and the
 * controller that's playing it, as well as distributing state updates from the
 * server to the controller and resetting the DOM when we are "between controllers."
 */
class Player {
    private playlist: Video[] = []; // use getter/setter
    playlistShown: boolean = false;
    state: VideoState = {
        playing: false,
        currentVideoIndex: -1,
        currentTimeMs: 0,
    };
    controller: VideoController | null = null;
    constructor(io: Socket) {
        io.on("state_set", (new_state: VideoState) => {
            const sourceChanged =
                this.state.currentVideoIndex != new_state.currentVideoIndex;
            this.state = new_state;
            if (sourceChanged) {
                setTimeAndSeek(0, 0);
                setAspectRatio(16 / 9);
                playButtonIcon("play");
            }
            this.updateController(sourceChanged);
        });
    }
    setPlaylist(newPlaylist: Video[]) {
        const oldSource = this.playlist[this.state.currentVideoIndex]?.src;
        const newSource = newPlaylist[this.state.currentVideoIndex].src;
        this.playlist = newPlaylist;
        if (oldSource != newSource) {
            this.updateController(true);
        }
    }
    getPlaylist(): Video[] {
        return this.playlist;
    }
    updateController(sourceChanged: boolean) {
        const currentSource = this.playlist[this.state.currentVideoIndex];
        if (!currentSource) {
            return;
        }
        if (sourceChanged) {
            const currentProvider = currentSource.provider;
            const controllerTypes = {
                youtube: YoutubeVideoController,
                vimeo: VimeoVideoController,
            };
            const NeededController =
                controllerTypes[
                    String(currentProvider) as keyof typeof controllerTypes
                ] || HTML5VideoController;

            if (!(this.controller instanceof NeededController)) {
                showSpinner();
                if (this.controller) {
                    this.controller.remove();
                }
                this.controller = new NeededController(
                    currentSource,
                    this.state
                );
                this.controller.videoReady.then(hideSpinner);
            }
        }
        this.controller?.setState(currentSource, this.state);
    }
}

function initVideo(io: Socket): Player {
    const player = new Player(io);
    initializePlayerInterface(io, player);
    io.on("request_state_report", async () => {
        let state;
        if (!player.controller) {
            state = undefined;
        } else {
            state = {
                playing: await player.controller.isPlaying(),
                currentTimeMs: player.controller.currentTimeMs,
                currentVideoIndex: player.state.currentVideoIndex,
            };
        }
        io.emit("state_report", state);
    });
    return player;
}

export default initVideo;
