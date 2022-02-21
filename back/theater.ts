import { Server as SocketServer, Socket } from "socket.io";
import fetch from "node-fetch";
import { Server } from "http";
import type { Express, Request, RequestHandler, Response } from "express";
import escapeHTML from "escape-html";
import { nanoid } from "nanoid";

import {
    Playlist,
    playlist,
    getRecentMessages,
    addMessage,
    getSession,
    saveSession,
    clearSession,
} from "./queries";
import {
    ChatMessage,
    VideoState as PlayerState,
    StateChangeRequest,
    ChangeTypes,
    ChatUserInfo,
    Subscription,
    Video,
    ConnectionStatus,
} from "../types";
import logger from "./logger";
import { password } from "./secrets";
import { scenes, SceneController } from "./scenes";
import {
    AddVideoBody,
    APIPath,
    ChangeSceneBody,
    endpoints,
    GetEndpoint,
    LogInBody,
    SendMessageBody,
} from "../endpoints";
import { assertType, is } from "typescript-is";
// import { avatars } from "../front/vue/avatars";

type ServerSentEvent =
    | "ping"
    | "grant_token"
    | "playlist_set"
    | "chat_message"
    | "chat_announcement"
    | "state_set"
    | "set_controls_flag"
    | "audience_info_set"
    | "request_state_report"
    | "alert";

type ClientSentEvent =
    | "state_change_request"
    | "disconnect"
    | "error_report"
    | "state_report"
    | "state_update_request"
    | "ready_for";

class AudienceMember {
    private socket: Socket;
    location: string = "";
    id: string;
    token: string;
    lastLatencies: number[] = [];
    chatInfo: ChatUserInfo | undefined = undefined;
    connected: Date = new Date();
    subscriptions: Set<Subscription> = new Set();
    lastClientState: (PlayerState & { receivedTimeISO: string }) | undefined =
        undefined;

    get loggedIn(): boolean {
        return !!this.chatInfo;
    }

    get lastRecordedLatency(): number {
        return this.lastLatencies[this.lastLatencies.length - 1];
    }

    get meanLatency(): number {
        return (
            this.lastLatencies.reduce((acc, v) => acc + v, 0) /
            this.lastLatencies.length
        );
    }

    /**
     * currently unused, fun tho
     */
    get latencyHistogram(): [number[], string[]] {
        if (this.lastLatencies.length < 2) {
            return [[], []];
        }
        const numIntervals = 8;
        const min = Math.min(...this.lastLatencies);
        const max = Math.max(...this.lastLatencies);
        const range = max - min + 1;
        const intervalSize = range / numIntervals;
        const labels: string[] = [];
        for (let i = 0; i < numIntervals; i++) {
            labels.push((min + i * intervalSize).toFixed(0) + "ms");
        }
        const result: number[] = Array(numIntervals).fill(0);
        for (const ping of this.lastLatencies) {
            const bucket = Math.floor((ping - min) / intervalSize);
            result[bucket] += 1;
        }
        return [result, labels];
    }

    get uptimeMs(): number {
        return Date.now() - this.connected.getTime();
    }

    getConnectionInfo(): ConnectionStatus {
        const playerState = this.lastClientState;
        if (playerState && playerState.currentTimeMs) {
            playerState.currentTimeMs = Math.round(playerState.currentTimeMs);
        }
        return {
            chatName: this.chatInfo?.name || "",
            uptimeMs: this.uptimeMs,
            latestPing: this.lastRecordedLatency,
            avgPing: this.meanLatency,
            pingHistory: this.lastLatencies.slice(-10),
            location: this.location,
            playerState,
        };
    }

    constructor(socket: Socket) {
        this.socket = socket;
        this.id = socket.id;
        this.token = nanoid();
        this.emit("grant_token", this.token);
        saveSession(this.token, this.id);
        this.socket.onAny((eventName: string) => {
            if (
                eventName !== "pong" &&
                eventName != "state_report" &&
                eventName != "typing_start"
            ) {
                logger.debug(eventName + " event from id " + this.id);
            }
        });
        this.startPinging();
        this.socket.on("state_report", (state: PlayerState) => {
            this.lastClientState = {
                ...state,
                receivedTimeISO: new Date().toISOString(),
            };
        });
        socket.on("disconnect", () => {
            clearSession(this.token);
        });
        this.socket.on("ready_for", (sub: Subscription) => {
            this.subscriptions.add(sub);
        });
        socket.on("error_report", (error_desc: string) => {
            logger.error(`client side error from ${this.id}: ${error_desc}`);
        });
        const remoteIP = socket.handshake.headers["x-real-ip"] as string;
        if (remoteIP) {
            fetch(`https://ipinfo.io/${remoteIP.split(":")[0]}/geo`)
                .then((res) => res.json())
                .then((json) => {
                    this.location = `${json.city}, ${json.region}, ${json.country}`;
                    logger.info(
                        `new client appears to be from ${this.location}`
                    );
                });
        }
    }

    startPinging() {
        let pingTime = NaN;
        const ping = () => {
            pingTime = Date.now();
            this.socket.emit("ping");
        };
        const pongHandler = () => {
            const pongTime = Date.now();
            this.lastLatencies.push(pongTime - pingTime);
            if (this.lastLatencies.length > 100) {
                this.lastLatencies = this.lastLatencies.slice(-100);
            }
        };
        this.socket.on("pong", pongHandler);
        ping();
        const updateInterval = setInterval(ping, 20000);
        this.on("disconnect", () => clearInterval(updateInterval));
    }

    emit(event: ServerSentEvent, ...args: any[]) {
        this.socket.emit(event, ...args);
    }

    on(event: ClientSentEvent, listener: (...args: any[]) => void) {
        this.socket.on(event, listener);
    }
}

type APIHandler =
    | ((req: Request, res: Response, member: AudienceMember | null) => void)
    | ((req: Request, res: Response, member: AudienceMember) => void);

class Theater {
    audience: AudienceMember[] = [];
    playlist: Playlist;
    graphics: SceneController;
    apiHandlers: Partial<Record<APIPath, APIHandler>>;

    _baseState: PlayerState = {
        playing: false,
        video: null,
        currentTimeMs: 0,
    } as const;
    /**
     * What the Theater looked like the last time the video state was explicitly set.
     * Use `currentState` to get a version of this with an up-to-date currentTimeMs.
     * Must be replaced rather than mutated in order to trigger the setter and update
     * the last-modified timestamp.
     */
    get baseState(): Readonly<PlayerState> {
        return this._baseState;
    }
    set baseState(newValue: PlayerState) {
        this._baseState = newValue;
        this.baseStateTimestamp = Date.now();
    }
    /**
     * The time at which the video state was last explicitly set. Automatically kept
     * up to date by the baseState setter.
     */
    baseStateTimestamp: number = Date.now();

    nextVideoTimer: NodeJS.Timeout | null = null;

    get currentState(): PlayerState {
        return {
            ...this.baseState,
            currentTimeMs: this.baseState.playing
                ? this.baseState.currentTimeMs +
                  (Date.now() - this.baseStateTimestamp)
                : this.baseState.currentTimeMs,
        };
    }

    constructor(
        io: SocketServer,
        playlist: Playlist,
        graphics: SceneController
    ) {
        this.graphics = graphics;
        // this will propogate all changes in our SceneController object to the
        // front-end:
        this.graphics.on("change", () => {
            this.emitAll("audience_info_set", this.graphics.outputGraphics);
        });
        this.playlist = playlist;
        this.playlist.getVideos().then((videos) => {
            this.baseState = { ...this.currentState, video: videos[0] };
            this.audience.forEach((a) =>
                a.emit("state_set", this.currentState)
            );
        });
        this.playlist.on("video_added", async () => {
            const receivers = this.audience.filter((a) =>
                a.subscriptions.has(Subscription.playlist)
            );
            receivers.forEach(async (r) =>
                r.emit("playlist_set", await this.playlist.getVideos())
            );
        });
        io.on("connection", (socket: Socket) => {
            const newMember = new AudienceMember(socket);
            this.initializeMember(newMember);
            logger.info(
                "new client added: " + this.audience.length + " total connected"
            );
        });
        this.apiHandlers = {
            [APIPath.logIn]: this.logIn,
            [APIPath.sendMessage]: this.sendMessage,
            [APIPath.logOut]: this.logOut,
            [APIPath.addVideo]: this.addVideo,
            [APIPath.typingStart]: this.typingStart,
            [APIPath.changeScene]: this.changeScene,
            [APIPath.getMessages]: this.getMessages,
            [APIPath.getStats]: this.getStats,
            [APIPath.getScenes]: this.getScenes,
            [APIPath.switchProps]: this.newProps,
        };
    }

    emitAll(event: ServerSentEvent, ...args: any[]) {
        this.audience.forEach((a) => a.emit(event, ...args));
    }

    async sendToChat(message: ChatMessage) {
        await addMessage(message);
        const receivers = this.audience.filter((a) =>
            a.subscriptions.has(Subscription.chat)
        );
        if (message.isAnnouncement) {
            logger.debug("emitting chat announcement:");
            logger.debug(JSON.stringify(message));
            receivers.forEach((a) =>
                a.emit("chat_announcement", message.messageHTML)
            );
        } else {
            logger.debug("emitting chat message:");
            logger.debug(JSON.stringify(message));
            receivers.forEach((a) => a.emit("chat_message", message));
        }
    }

    logIn(req: Request, res: Response, member: AudienceMember) {
        if (!member) {
            console.warn("logIn called without AudienceMember argument");
            res.status(400);
            res.end();
            return;
        }
        const info = assertType<LogInBody>(req.body);
        if (
            member.chatInfo &&
            member.chatInfo.avatarURL == info.avatarURL &&
            member.chatInfo.name == info.name
        ) {
            logger.warn(
                "user re-logging in with identical info; " +
                    "possible front-end glitch"
            );
            // kind of a hack, but in the case of a duplicate login we are
            // marking the second one as resuming a session so that an
            // announcement doesn't get sent out announcing a new one
            info.resumed = true;
        } else if (
            info.avatarURL.startsWith("/images/avatars/") &&
            info.name.trim().length < 30
        ) {
            info.name = info.name.trim();
            info.name = escapeHTML(info.name);
            member.chatInfo = { ...info, id: member.id };
            logger.debug(
                "audience member successfully set their chat info to:"
            );
            logger.debug(JSON.stringify(info));
            if (!info.resumed) {
                const announcement = {
                    isAnnouncement: true,
                    messageHTML: `<strong>${member.chatInfo.name}</strong> joined the Chat.`,
                };
                this.sendToChat(announcement);
            }
            this.graphics.addInhabitant(member.chatInfo);
            // just in case
            member.subscriptions.add(Subscription.chat);
            res.status(200);
            res.end();
        } else {
            logger.warn("chat info rejected:");
            logger.warn(JSON.stringify(info).substring(0, 1000));
            res.status(400);
            res.end();
        }
    }

    sendMessage(req: Request, res: Response, member: AudienceMember) {
        if (!member.chatInfo) {
            logger.warn("chat message from un-logged-in user " + member.id);
        } else if (is<SendMessageBody>(req.body)) {
            // just in case
            member.subscriptions.add(Subscription.chat);
            const messageText = req.body.messageText.trim();
            if (member.chatInfo && messageText) {
                const message: ChatMessage = {
                    isAnnouncement: false,
                    messageHTML: escapeHTML(messageText),
                    senderID: member.chatInfo.id,
                    senderName: member.chatInfo.name,
                    senderAvatarURL: member.chatInfo.avatarURL,
                };
                this.sendToChat(message).then(() => {
                    res.status(200);
                    res.end();
                });
                // if (/\bhm+\b/.test(message.messageHTML)) {
                //     setTimeout(() => {
                //         const villagerMessage: ChatMessage = {
                //             isAnnouncement: false,
                //             messageHTML: "<em>hmmm...</em>",
                //             senderID: "fake-villager-user",
                //             senderName: "Minecraft Villager",
                //             senderAvatarURL: "/images/avatars/villager.jpg",
                //         };
                //         this.sendToChat(villagerMessage);
                //     }, 500);
                // }
                this.graphics.stopTyping(member.id);
            }
        } else {
            logger.warn(
                "chat message failed validation: " +
                    JSON.stringify(req.body).slice(0, 1000)
            );
        }
    }

    addVideo(req: Request, res: Response, member: AudienceMember) {
        if (is<AddVideoBody>(req.body)) {
            const url = req.body.url;
            logger.debug(
                "attempting to add video with url " + url + " to playlist"
            );
            this.playlist
                .addFromURL(url)
                .then(() => {
                    res.status(200);
                    res.end();
                })
                .catch((e) => {
                    logger.warn("could not get video from url " + url);
                    logger.warn(e);
                    res.status(400);
                    res.end();
                });
        }
    }

    typingStart(req: Request, res: Response, member: AudienceMember) {
        this.graphics.startTyping(member.id);
        res.status(200);
        res.end();
    }

    changeScene(req: Request, res: Response, member: AudienceMember) {
        if (
            is<ChangeSceneBody>(req.body) &&
            SceneController.scenes.includes(req.body.newScene)
        ) {
            this.graphics = SceneController.switchedProps(
                this.graphics,
                req.body.newScene
            );
            this.graphics.on("change", () => {
                this.emitAll("audience_info_set", this.graphics.outputGraphics);
            });
            this.graphics.emit("change");
            this.sendToChat({
                isAnnouncement: true,
                messageHTML: `<strong>${member.chatInfo?.name}</strong> ushered in a change of scene.`,
            });
            res.status(200);
            res.end();
        } else {
            res.status(400);
            res.end();
        }
    }

    newProps(_req: Request, res: Response, member: AudienceMember) {
        this.graphics.changeInhabitantProps(member.id);
        res.status(200);
        res.end();
    }

    logOut(_req: Request, res: Response, member: AudienceMember) {
        logger.debug(`member ${member.chatInfo?.name} logged out`);
        this.graphics.removeInhabitant(member.id);
        member.chatInfo = undefined;
        res.status(200);
        res.end();
    }

    getStats(req: Request, res: Response) {
        if (req.header("Admin") != password) {
            console.warn("Incorrectly passworded request for stats");
            res.status(403);
            res.end();
            return;
        }
        res.status(200);
        res.json({
            players: this.audience.map((a) => a.getConnectionInfo()),
            server: this.currentState,
        });
        res.end();
    }

    async getMessages(_req: Request, res: Response) {
        res.status(200);
        res.json({ messages: await getRecentMessages(50) });
        res.end();
    }

    getScenes(_req: Request, res: Response) {
        res.status(200);
        res.json({
            scenes: SceneController.scenes,
            currentScene: this.graphics.currentScene,
        });
        res.end();
    }

    handleAPICall(req: Request, res: Response) {
        if (req.path in this.apiHandlers) {
            const handler = (
                this.apiHandlers[req.path as APIPath] as APIHandler
            ).bind(this);
            let member;
            const auth = req.header("Auth");
            if (!is<string>(auth)) {
                member = null;
            } else {
                const memberID = getSession(auth);
                member = this.audience.find((m) => m.id == memberID);
            }
            if (
                member?.loggedIn ||
                !endpoints[req.path as APIPath].mustBeInChat
            ) {
                try {
                    handler(req, res, (member || null) as any);
                } catch (e: any) {
                    logger.warn(
                        "exception during " + handler.name + " api handler"
                    );
                    logger.warn(e.message && e.message());
                    logger.warn(e.stack);
                    res.status(400);
                    res.end();
                }
            } else {
                logger.warn(
                    "received unauthenticated request for secure path " +
                        req.path
                );
                res.status(403);
                res.end();
            }
        } else {
            logger.warn("received request for unknown path " + req.path);
            res.status(404);
            res.end();
        }
    }

    initializeMember(member: AudienceMember) {
        this.audience.push(member);

        this.monitorSynchronization(member);

        member.emit("state_set", this.currentState);

        member.on("ready_for", (sub: Subscription) => {
            if (sub == Subscription.chat) {
                getRecentMessages().then((messages) =>
                    messages.forEach((m) => {
                        member.emit(
                            m.isAnnouncement
                                ? "chat_announcement"
                                : "chat_message",
                            m.isAnnouncement ? m.messageHTML : m
                        );
                    })
                );
            } else if (sub == Subscription.audience) {
                member.emit("audience_info_set", this.graphics.outputGraphics);
            } else if (sub == Subscription.playlist) {
                this.playlist.getVideos().then((videos) => {
                    member.emit("playlist_set", videos);
                });
            }
        });

        member.on("state_update_request", async () => {
            member.emit("state_set", this.currentState);
        });

        member.on(
            "state_change_request",
            async (change: StateChangeRequest) => {
                if (!member.loggedIn) {
                    member.emit(
                        "alert",
                        "Log in to the chat to  be allowed to control the video 👀"
                    );
                    member.emit("state_set", this.currentState);
                    return;
                }
                const newState: any = {};
                if (change.changeType == ChangeTypes.playing) {
                    newState.currentTimeMs = this.currentState.currentTimeMs;
                    const oldState = this.currentState.playing;
                    newState.playing = change.newValue as boolean;
                    this.baseState = { ...this.currentState, ...newState };
                    this.broadcastState();
                    if (oldState != change.newValue) {
                        this.emitAll("set_controls_flag", {
                            target: "play",
                            imagePath: member.chatInfo?.avatarURL,
                        });
                    }
                } else if (change.changeType == ChangeTypes.time) {
                    newState.playing = false;
                    newState.currentTimeMs = change.newValue as number;
                    const oldTime = this.currentState.currentTimeMs;
                    this.baseState = { ...this.currentState, ...newState };
                    this.broadcastState();
                    const currentDuration = this.currentState.video?.duration;
                    if (
                        this.currentState.video &&
                        currentDuration !== undefined
                    ) {
                        this.emitAll("set_controls_flag", {
                            target: "seek",
                            imagePath: member.chatInfo?.avatarURL,
                            startPos: oldTime / 1000 / currentDuration,
                            endPos:
                                newState.currentTimeMs / 1000 / currentDuration,
                        });
                    }
                } else if (change.changeType == ChangeTypes.videoID) {
                    const newVideoID = change.newValue as number;
                    const newVideo = await this.playlist.getVideoByID(
                        newVideoID
                    );
                    if (newVideo) {
                        this.startNewVideo(newVideo);
                    } else {
                        logger.warn(
                            "client requested video with unknown id" +
                                newVideoID
                        );
                    }
                } else if (change.changeType == ChangeTypes.nextVideo) {
                    this.startNewVideo(
                        await this.playlist.getNextVideo(this.baseState.video)
                    );
                    this.emitAll("set_controls_flag", {
                        target: "next_video",
                        imagePath: member.chatInfo?.avatarURL,
                    });
                } else if (change.changeType == ChangeTypes.prevVideo) {
                    this.startNewVideo(
                        await this.playlist.getPrevVideo(this.baseState.video)
                    );
                    this.emitAll("set_controls_flag", {
                        target: "prev_video",
                        imagePath: member.chatInfo?.avatarURL,
                    });
                }

                this.setNextVideoTimer();
            }
        );

        member.on("disconnect", () => {
            this.removeMember(member);
            this.graphics.removeInhabitant(member.id);
            logger.info(
                "client disconnected: " + this.audience.length + " remaining"
            );
            if (this.audience.length === 0 && this.currentState.playing) {
                logger.debug("pausing video as no one is left to watch");
                this.baseState = {
                    ...this.currentState,
                    playing: false,
                };
            }
        });
    }

    setNextVideoTimer() {
        if (this.nextVideoTimer) {
            clearTimeout(this.nextVideoTimer);
        }
        if (this.baseState.video && this.baseState.playing) {
            const timeUntil = Math.max(
                this.baseState.video.duration * 1000 -
                    this.currentState.currentTimeMs,
                0
            );
            logger.debug(
                "setting timer to switch to next video in " + timeUntil + "ms"
            );
            this.nextVideoTimer = setTimeout(async () => {
                const nextVideo = await this.playlist.getNextVideo(
                    this.baseState.video
                );
                if (nextVideo) {
                    this.startNewVideo(nextVideo);
                } else {
                    this.baseState = { ...this.currentState, playing: false };
                    this.broadcastState();
                }
            }, timeUntil);
        }
    }

    async startNewVideo(v: Video | undefined) {
        if (v) {
            this.baseState = {
                video: v,
                currentTimeMs: 0,
                playing: false,
            };
            this.broadcastState();
        }
    }

    async broadcastState() {
        logger.debug("emitting accepted player state:");
        logger.debug(JSON.stringify(this.currentState));
        this.emitAll("state_set", this.currentState);
    }

    async monitorSynchronization(member: AudienceMember) {
        let toldThemToPlay = 0;
        // the frontend is programmed to emit a "state_report" every 5 seconds
        member.on("state_report", (memberState: PlayerState) => {
            if (memberState) {
                const difference = Math.abs(
                    memberState.currentTimeMs - this.currentState.currentTimeMs
                );
                // priorities here: first try to ensure that they are watching the
                // right video; then make sure that they are playing/paused just like
                // the server, telling them to manually hit play if it seems to be
                // necessary; then make sure they are seeked to the right time.
                if (memberState.video?.id != this.currentState.video?.id) {
                    member.emit("state_set", this.currentState);
                } else if (memberState.playing != this.currentState.playing) {
                    member.emit("state_set", this.currentState);
                    if (!memberState.playing && this.currentState.playing) {
                        toldThemToPlay++;
                        if (toldThemToPlay > 2) {
                            member.emit(
                                "alert",
                                "Your browser is blocking autoplay;" +
                                    " press play to sync up with MitchBot"
                            );
                            toldThemToPlay = 0;
                        }
                    }
                } else if (difference > 1000) {
                    logger.debug(
                        `correcting currentTime for player ${member.id}, ` +
                            `who is off by ${difference} ms`
                    );
                    member.emit("state_set", this.currentState);
                    if (difference > 3000) {
                        member.emit("alert", "MitchBot is syncing you up");
                    }
                }
            }
        });
    }

    removeMember(member: AudienceMember) {
        this.audience = this.audience.filter((a) => a.id != member.id);
    }
}

export default function init(server: Server, app: Express) {
    const io = new SocketServer(server);
    const graphics = new SceneController(scenes.lilypads);

    // for (let i = 0; i < 10; i++) {
    //     graphics.addInhabitant({
    //         id: "test" + i,
    //         name: "Test User " + i,
    //         avatarURL: avatars[Math.floor(Math.random() * avatars.length)].path,
    //         resumed: false,
    //     });
    // }

    const theater = new Theater(io, playlist, graphics);

    for (const endpoint of Object.values(APIPath)) {
        // a kludge, but, the optimize image endpoint is handled by back/optimizeimages.ts
        if (endpoint != endpoints[APIPath.optimizedImage].path) {
            app[endpoints[endpoint] instanceof GetEndpoint ? "get" : "post"](
                endpoint,
                (req: Request, res: Response) => theater.handleAPICall(req, res)
            );
        }
    }
}
