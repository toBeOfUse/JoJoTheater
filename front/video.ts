import { Socket } from "socket.io-client";
import fscreen from "fscreen";
import VimeoPlayer from "@vimeo/player";
import { Video, VideoState, StateChangeRequest, StateElements } from "../types";
interface ActionableVideoState extends Omit<VideoState, "video"> {
    video: Video;
}

function secondsToHMS(seconds: number) {
    if (seconds < 3600) {
        return new Date(seconds * 1000).toISOString().substring(14, 14 + 5);
    } else {
        return new Date(seconds * 1000).toISOString().substring(11, 11 + 8);
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
    bigLoadingSpinner: document.querySelector(
        "#big-loading-spinner"
    ) as SVGElement,
    smallLoadingSpinner: document.querySelector(
        "#small-loading-spinner"
    ) as HTMLDivElement,
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

function showBigSpinner() {
    DOMControls.bigLoadingSpinner.style.display = "unset";
    const animateElement = DOMControls.bigLoadingSpinner.querySelector(
        "animateTransform"
    ) as any;
    animateElement.beginElement();
}

function hideBigSpinner() {
    if (DOMControls.bigLoadingSpinner.style.display == "none") {
        return;
    }
    const animateElement = DOMControls.bigLoadingSpinner.querySelector(
        "animateTransform"
    ) as any;
    const stop = () => {
        animateElement.endElement();
        DOMControls.bigLoadingSpinner.style.display = "none";
    };
    if ("onrepeat" in animateElement) {
        (animateElement as any).onrepeat = stop;
    } else {
        stop();
    }
}

function showSmallSpinner() {
    DOMControls.smallLoadingSpinner.style.display = "flex";
}

function hideSmallSpinner() {
    DOMControls.smallLoadingSpinner.style.display = "none";
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
 * image, the seek slider, the duration/current time display, and the buffering
 * (small) spinner as the underlying video state changes. Subclassed to deal with
 * different elements and APIs for different video sources.
 */
abstract class VideoController {
    abstract videoElement: HTMLElement;
    abstract get currentTimeMs(): number;
    abstract get durationMs(): number;
    abstract setState(v: ActionableVideoState): void;
    abstract isPlaying(): Promise<boolean>;
    abstract remove(): void;
    /**
     * called directly from onclick listener to signal user intent to autoplay
     * blockers
     * */
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
    constructor(state: ActionableVideoState) {
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
        this.videoElement.addEventListener("waiting", showSmallSpinner);
        this.videoElement.addEventListener("canplay", hideSmallSpinner);
        this.videoElement.volume = 1;
        if (state.video) {
            this.setState(state as ActionableVideoState);
        }
    }

    setState(v: ActionableVideoState) {
        if (v.video?.src != this.prevSrc) {
            console.log("changing <video> src");
            setSeekDisplay(0);
            this.videoElement.src = v.video.src;
            this.prevSrc = v.video.src;
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
        return !this.videoElement.paused && !this.videoElement.ended;
    }

    remove() {
        this.videoElement.remove();
    }
}

let injectedYoutubeScript = false;
const youtubeAPIReady = new Promise<void>((resolve, reject) => {
    (<any>window).onYouTubeIframeAPIReady = () => {
        console.log("youtube api ready");
        resolve();
    };
});

class YoutubeVideoController extends VideoController {
    videoElement: HTMLDivElement;
    YTPlayer: YT.Player | null = null;
    videoReady: Promise<void>;
    _videoReady: boolean = false;
    prevSrc: string;
    timeUpdate: NodeJS.Timeout | undefined;

    constructor(state: ActionableVideoState) {
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
        if (!injectedYoutubeScript) {
            injectedYoutubeScript = true;
            // from https://developers.google.com/youtube/iframe_api_reference
            let tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            let firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }
        this.videoReady = new Promise(async (resolve) => {
            await youtubeAPIReady;
            this.YTPlayer = new YT.Player("youtube-embed-location", {
                height: "100%",
                width: "100%",
                videoId: state.video.src,
                playerVars: {
                    playsinline: 1,
                    cc_load_policy: state.video.captions ? 1 : 0,
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
                        if (
                            event.data == 0 ||
                            event.data == 2 ||
                            event.data == -1
                        ) {
                            playButtonIcon("play");
                        } else if (event.data == 1 || event.data == 3) {
                            playButtonIcon("pause");
                        }
                        // we don't show a spinner for buffering here because youtube has its own
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
        this.prevSrc = state.video.src;
        this.setState(state);
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

    async setState(v: ActionableVideoState) {
        await this.videoReady;
        if (!this.YTPlayer) {
            return; // something went terribly wrong in the constructor
        }
        this.YTPlayer.setVolume(100); // TODO: volume controls?
        if (v.video.src != this.prevSrc) {
            this.prevSrc = v.video.src;
            this.YTPlayer?.cueVideoById(v.video.src);
        }
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

    constructor(state: ActionableVideoState) {
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
            id: Number(state.video.src),
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
        this.vimeoPlayer.on("bufferstart", showSmallSpinner);
        this.vimeoPlayer.on("bufferend", hideSmallSpinner);
        this.vimeoPlayer.setVolume(1);
        this.videoReady = new Promise<void>((resolve) => {
            this.vimeoPlayer.on("loaded", resolve);
        });
        this.setState(state);
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
            const paused = await this.vimeoPlayer.getPaused();
            const ended = await this.vimeoPlayer.getEnded();
            return !paused && !ended;
        }
    }

    async setState(v: ActionableVideoState) {
        if (v.video.src != this.prevSrc) {
            this.prevSrc = v.video.src;
            this.vimeoPlayer.loadVideo(Number(v.video.src));
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

let injectedDailymotionScript = false;
class DailymotionVideoController extends VideoController {
    videoElement: HTMLElement;
    videoReady: Promise<void>;
    dailymotionPlayer: DMPlayer | null = null;
    prevSrc: string;

    cachedCurrentTimeMs: number = 0;
    cachedDurationMs: number = 0;

    constructor(initialState: ActionableVideoState) {
        super();
        this.prevSrc = initialState.video.src;
        this.videoElement = document.createElement("div");
        this.videoElement.id = "dailymotion-embed-location";
        const container = document.querySelector("#video-container");
        if (!container) {
            throw new Error("could not select video container");
        } else {
            container.prepend(this.videoElement);
        }
        playButtonIcon("play");
        const apiReady = new Promise<void>((resolve) => {
            if (!injectedDailymotionScript) {
                const scriptElement = document.createElement("script");
                scriptElement.onload = () => resolve();
                scriptElement.src =
                    "https://geo.dailymotion.com/libs/player/x73cp.js";
                document.head.prepend(scriptElement);
            } else {
                resolve();
            }
        });
        this.videoReady = new Promise(async (resolve) => {
            await apiReady;
            this.dailymotionPlayer = await dailymotion.createPlayer(
                "dailymotion-embed-location",
                { video: initialState.video.src, autostart: "off" }
            );
            (window as any).dmcheat = this.dailymotionPlayer;
            this.dailymotionPlayer.on(dailymotion.events.VIDEO_PLAYING, () => {
                playButtonIcon("pause");
                hideSmallSpinner();
            });
            this.dailymotionPlayer.on(dailymotion.events.VIDEO_PAUSE, () => {
                playButtonIcon("play");
            });
            this.dailymotionPlayer.on(dailymotion.events.VIDEO_END, () => {
                playButtonIcon("play");
            });
            this.dailymotionPlayer.on(
                dailymotion.events.VIDEO_BUFFERING,
                showSmallSpinner
            );
            this.dailymotionPlayer.on(
                dailymotion.events.VIDEO_DURATIONCHANGE,
                (state: DMState) => {
                    setTimeAndSeek(state.videoTime, state.videoDuration);
                    this.cachedDurationMs = state.videoDuration * 1000;
                }
            );
            this.dailymotionPlayer.on(
                dailymotion.events.VIDEO_TIMECHANGE,
                (state: DMState) => {
                    setTimeAndSeek(state.videoTime, state.videoDuration);
                    this.cachedCurrentTimeMs = state.videoTime * 1000;
                }
            );
            resolve();
        });
        this.setState(initialState);
    }

    get currentTimeMs(): number {
        if (!this.dailymotionPlayer) {
            return 0;
        } else {
            return this.cachedCurrentTimeMs;
        }
    }

    get durationMs(): number {
        if (!this.dailymotionPlayer) {
            return 0;
        } else {
            return this.cachedDurationMs;
        }
    }

    async isPlaying(): Promise<boolean> {
        return (
            this.dailymotionPlayer !== null &&
            (await this.dailymotionPlayer.getState()).playerIsPlaying
        );
    }

    manuallyPressPlay(): void {
        if (this.dailymotionPlayer) {
            this.dailymotionPlayer.play();
            this.dailymotionPlayer.setMute(false);
        }
    }

    async setState(v: ActionableVideoState) {
        await this.videoReady;
        if (!this.dailymotionPlayer) {
            return;
        }
        this.dailymotionPlayer.setVolume(1);
        this.dailymotionPlayer.setMute(false);
        if (v.video.src != this.prevSrc) {
            console.log("changing dailymotion source");
            this.prevSrc = v.video.src;
            this.dailymotionPlayer.loadContent({ video: v.video.src });
        }
        console.log(
            "determining whether to seek. server, local:",
            v.currentTimeMs,
            this.currentTimeMs
        );
        if (Math.abs(this.currentTimeMs - v.currentTimeMs) > 1000) {
            console.log("seeking dailymotion");
            this.dailymotionPlayer.seek(v.currentTimeMs / 1000);
        }
        if (v.playing && !(await this.isPlaying())) {
            console.log("playing dailymotion");
            this.dailymotionPlayer.play();
        } else if (!v.playing && (await this.isPlaying())) {
            console.log("pausing dailymotion");
            this.dailymotionPlayer.pause();
        }
        if ((await this.dailymotionPlayer.getState()).playerIsMuted) {
            // the dailymotion player mutes itself in order to be able to play
            // without user interaction initiating it; if this is happening, we need
            // to ensure the video is paused, provoking the player into interacting
            // with it, which will allow the call to setMute at the beginning of this
            // method to actually work
            this.dailymotionPlayer.pause();
        }
    }

    remove(): void {
        if (this.videoElement) {
            this.videoElement.remove();
        }
        if (this.dailymotionPlayer) {
            this.dailymotionPlayer.destroy();
        }
    }
}

/**
 * Function that creates listeners for events that occur on the DOMControls elements,
 * to send the appropriate messages back to the server to request changes in the
 * video state and enter and exit fullscreen mode, as well as directly triggering the
 * player to play sometimes so that autoplay blocking will see that the user is
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
    document.addEventListener("keydown", (e) => {
        if (
            e.code.toLowerCase() == "space" &&
            (!e.target ||
                ((e.target as HTMLElement).tagName.toLowerCase() != "input" &&
                    (e.target as HTMLElement).tagName.toLowerCase() !=
                        "textarea"))
        ) {
            e.preventDefault();
            DOMControls.playPause.click();
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
 * controller that's playing it, as well as passing state updates from the
 * server to the controller and resetting the DOM when we are "between controllers."
 */
class Player {
    state: VideoState = {
        playing: false,
        video: null,
        currentTimeMs: 0,
    };
    controller: VideoController | null = null;
    get currentVideo(): Video | null {
        return this.state.video;
    }
    constructor(io: Socket) {
        io.on("state_set", (new_state: VideoState) => {
            const sourceChanged = this.state.video?.id != new_state.video?.id;
            this.state = new_state;
            if (sourceChanged) {
                setTimeAndSeek(0, 0);
                setAspectRatio(16 / 9);
                playButtonIcon("play");
            }
            this.updateController(sourceChanged);
        });
    }
    updateController(sourceChanged: boolean) {
        if (!this.state.video) {
            return;
        }
        const currentState = this.state as ActionableVideoState;
        if (sourceChanged) {
            const currentProvider = currentState.video.provider;
            const controllerTypes = {
                youtube: YoutubeVideoController,
                vimeo: VimeoVideoController,
                dailymotion: DailymotionVideoController,
            };
            const NeededController =
                controllerTypes[
                    String(currentProvider) as keyof typeof controllerTypes
                ] || HTML5VideoController;

            if (!(this.controller instanceof NeededController)) {
                showBigSpinner();
                if (this.controller) {
                    this.controller.remove();
                }
                this.controller = new NeededController(currentState);
                this.controller.videoReady.then(hideBigSpinner);
            }
        }
        this.controller?.setState(currentState);
    }
}

function initVideo(io: Socket): Player {
    const player = new Player(io);
    initializePlayerInterface(io, player);
    const createStateReport = async () => {
        let state: VideoState | undefined;
        if (!player.controller) {
            state = undefined;
        } else {
            state = {
                playing: await player.controller.isPlaying(),
                currentTimeMs: player.controller.currentTimeMs,
                video: player.state.video,
            };
        }
        io.emit("state_report", state);
    };
    io.on("request_state_report", createStateReport);
    setInterval(createStateReport, 5000);
    return player;
}

export default initVideo;
