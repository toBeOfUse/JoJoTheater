import { Server as SocketServer, Socket } from "socket.io";
import fetch from "node-fetch";
import { Server } from "http";
import type { Express, RequestHandler } from "express";
import escapeHTML from "escape-html";

import { Playlist, playlist, getRecentMessages, addMessage } from "./queries";
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
import { propCollections, RoomController } from "./rooms";

type ServerSentEvent =
    | "ping"
    | "id_set"
    | "playlist_set"
    | "chat_login_successful"
    | "chat_message"
    | "chat_announcement"
    | "add_video_failed"
    | "state_set"
    | "audience_info_set"
    | "request_state_report"
    | "alert";

type ClientSentEvent =
    | "state_change_request"
    | "add_video"
    | "user_info_set"
    | "user_info_clear"
    | "wrote_message"
    | "disconnect"
    | "error_report"
    | "state_report"
    | "state_update_request"
    | "ready_for"
    | "typing_start"
    | "change_room";

class AudienceMember {
    private socket: Socket;
    location: string = "";
    id: string;
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
        this.socket.onAny((eventName: string) => {
            if (eventName !== "pong" &&
                eventName != "state_report"
                && eventName != "typing_start") {
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
        this.socket.on("ready_for", (sub: Subscription) => {
            this.subscriptions.add(sub);
        });
        this.socket.on("user_info_set", (info: ChatUserInfo) => {
            if (
                this.chatInfo &&
                this.chatInfo.avatarURL == info.avatarURL &&
                this.chatInfo.name == info.name &&
                this.chatInfo.id == info.id
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
                this.chatInfo = { ...info, id: this.id };
                logger.debug(
                    "audience member successfully set their chat info to:"
                );
                logger.debug(JSON.stringify(info));
                this.emit("chat_login_successful");
            } else {
                logger.warn("chat info rejected:");
                logger.warn(JSON.stringify(info).substring(0, 1000));
            }
        });
        this.socket.on("user_info_clear", () => {
            this.chatInfo = undefined;
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

class Theater {
    audience: AudienceMember[] = [];
    playlist: Playlist;
    graphics: RoomController;

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

    constructor(io: SocketServer, playlist: Playlist, graphics: RoomController) {
        this.graphics = graphics;
        // this will propogate all changes in our RoomController object to the
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
    }

    emitAll(event: ServerSentEvent, ...args: any[]) {
        this.audience.forEach((a) => a.emit(event, ...args));
    }

    sendToChat(message: ChatMessage) {
        addMessage(message);
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

    initializeMember(member: AudienceMember) {
        this.audience.push(member);

        this.monitorSynchronization(member);

        member.emit("id_set", member.id);

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
                    return;
                }
                const newState: any = {};
                if (change.changeType == ChangeTypes.playing) {
                    newState.currentTimeMs = this.currentState.currentTimeMs;
                    newState.playing = change.newValue as boolean;
                    this.baseState = { ...this.currentState, ...newState };
                    this.broadcastState();
                } else if (change.changeType == ChangeTypes.time) {
                    newState.playing = false;
                    newState.currentTimeMs = change.newValue as number;
                    this.baseState = { ...this.currentState, ...newState };
                    this.broadcastState();
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
                } else if (change.changeType == ChangeTypes.prevVideo) {
                    this.startNewVideo(
                        await this.playlist.getPrevVideo(this.baseState.video)
                    );
                }

                this.setNextVideoTimer();
            }
        );

        member.on("add_video", async (url: string) => {
            if (!member.loggedIn) {
                return;
            }
            logger.debug(
                "attempting to add video with url " + url + " to playlist"
            );
            this.playlist.addFromURL(url).catch((e) => {
                logger.warn("could not get video from url " + url);
                logger.warn(e);
                member.emit("add_video_failed");
            });
        });

        member.on("user_info_set", () => {
            if (member.loggedIn && member.chatInfo) {
                if (!member.chatInfo.resumed) {
                    const announcement = {
                        isAnnouncement: true,
                        messageHTML: `<strong>${member.chatInfo.name}</strong> joined the Chat.`,
                    };
                    this.sendToChat(announcement);
                }
                this.graphics.addInhabitant(member.chatInfo)
            }
        });
        member.on("user_info_clear", () => {
            this.graphics.removeInhabitant(member.id);
        });

        member.on("typing_start", () => {
            this.graphics.startTyping(member.id);
        });

        member.on("change_room", () => {
            if (member.loggedIn) {
                this.graphics = RoomController.switchedProps(this.graphics);
                this.graphics.on("change", () => {
                    this.emitAll("audience_info_set", this.graphics.outputGraphics);
                });
                this.graphics.emit("change");
                this.sendToChat({
                    isAnnouncement: true,
                    messageHTML: `<strong>${member.chatInfo?.name}</strong> ushered in a change of scene.`
                });
            }
        });

        member.on("wrote_message", (messageText: string) => {
            messageText = messageText.trim();
            if (member.chatInfo && messageText) {
                const message: ChatMessage = {
                    isAnnouncement: false,
                    messageHTML: escapeHTML(messageText),
                    senderID: member.chatInfo.id,
                    senderName: member.chatInfo.name,
                    senderAvatarURL: member.chatInfo.avatarURL,
                };
                this.sendToChat(message);
                if (/\bhm+\b/.test(message.messageHTML)) {
                    setTimeout(() => {
                        const villagerMessage: ChatMessage = {
                            isAnnouncement: false,
                            messageHTML: "<em>hmmm...</em>",
                            senderID: "fake-villager-user",
                            senderName: "Minecraft Villager",
                            senderAvatarURL: "/images/avatars/villager.jpg",
                        };
                        this.sendToChat(villagerMessage);
                    }, 500);
                }
                this.graphics.stopTyping(member.id);
            }
        });

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
    const graphics = new RoomController(propCollections.trees);
    const theater = new Theater(io, playlist, graphics);
    const auth: RequestHandler = (req, res, next) => {
        if (req.headers.authorization == password) {
            next();
        } else {
            res.status(403);
            res.end();
        }
    };
    app.get("/api/stats", auth, (_req, res) => {
        res.status(200);
        res.json({
            players: theater.audience.map((a) => a.getConnectionInfo()),
            server: theater.currentState,
        });
        res.end();
    });
    app.get("/api/messages", auth, async (_req, res) => {
        res.status(200);
        res.json(await getRecentMessages(50));
        res.end();
    });
}
