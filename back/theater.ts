import { Server as SocketServer, Socket } from "socket.io";
import fetch from "node-fetch";
import { Server } from "http";
import type { Express } from "express";
import escapeHTML from "escape-html";

import { Playlist, playlist, getRecentMessages, addMessage } from "./queries";
import {
    ChatMessage,
    VideoState as PlayerState,
    StateChangeRequest,
    StateElements,
    ChatUserInfo,
    Subscription,
} from "../types";
import logger from "./logger";

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
    | "ready_for";

interface ConnectionStatus {
    chatName: string;
    uptimeMs: number;
    latestPing: number;
    avgPing: number;
    pingHistogram: [number[], string[]];
    location: string;
    playerState: PlayerState | undefined;
}

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

    get lastRecordedLatency(): number {
        return this.lastLatencies[this.lastLatencies.length - 1];
    }

    get meanLatency(): number {
        return (
            this.lastLatencies.reduce((acc, v) => acc + v, 0) /
            this.lastLatencies.length
        );
    }

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
            pingHistogram: this.latencyHistogram,
            location: this.location,
            playerState,
        };
    }

    constructor(socket: Socket) {
        this.socket = socket;
        this.id = socket.id;
        this.socket.onAny((eventName: string) => {
            if (eventName !== "pong" && eventName != "state_report") {
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
            info.name = info.name.trim();
            if (
                info.avatarURL.startsWith("/images/avatars/") &&
                info.name.length < 30
            ) {
                info.name = escapeHTML(info.name);
                this.chatInfo = { ...info, id: this.id };
                logger.debug(
                    "audience member successfully set their chat info to:"
                );
                logger.debug(JSON.stringify(info));
                this.emit("chat_login_successful");
            } else {
                logger.debug("chat info rejected:");
                logger.debug(JSON.stringify(info).substring(0, 1000));
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
    lastKnownState: PlayerState = {
        playing: false,
        currentVideoID: 0,
        currentTimeMs: 0,
    };
    lastKnownStateTimestamp: number = Date.now();

    get currentState(): PlayerState {
        return {
            ...this.lastKnownState,
            currentTimeMs: this.lastKnownState.playing
                ? this.lastKnownState.currentTimeMs +
                  (Date.now() - this.lastKnownStateTimestamp)
                : this.lastKnownState.currentTimeMs,
        };
    }

    get allUserInfo(): ChatUserInfo[] {
        const info = [];
        for (const user of this.audience) {
            if (user.chatInfo) {
                info.push(user.chatInfo);
            }
        }
        return info;
    }

    constructor(io: SocketServer, playlist: Playlist) {
        this.playlist = playlist;
        this.playlist.getVideos().then((videos) => {
            this.lastKnownState.currentVideoID = videos[0].id;
            this.audience.forEach((a) =>
                a.emit("state_set", this.currentState)
            );
        });
        this.playlist.on("video_added", async () => {
            this.emitAll("playlist_set", await this.playlist.getVideos());
        });
        io.on("connection", (socket: Socket) => {
            // TODO: most of this should logically be in initializeMember()
            const newMember = new AudienceMember(socket);
            newMember.emit("id_set", socket.id);
            this.playlist.getVideos().then((videos) => {
                newMember.emit("playlist_set", videos);
            });

            newMember.emit("state_set", this.currentState);
            this.initializeMember(newMember);
            logger.info(
                "new client added: " + this.audience.length + " total connected"
            );
            newMember.on("disconnect", () => {
                logger.info(
                    "client disconnected: " +
                        this.audience.length +
                        " remaining"
                );
                if (this.audience.length === 0) {
                    logger.debug("pausing video as no one is left to watch");
                    this.lastKnownState = {
                        ...this.currentState,
                        playing: false,
                    };
                    this.lastKnownStateTimestamp = Date.now();
                }
            });
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
            logger.debug("emitting chat annoucement:");
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
                member.emit("audience_info_set", this.allUserInfo);
            } else if (sub == Subscription.playlist) {
                this.playlist.getVideos().then((videos) => {
                    member.emit("playlist_set", videos);
                });
            }
        });

        member.on("state_update_request", async () => {
            // we emit playlist_set to everyone regardless of whether they have
            // Subscription.playlist in their subscriptions because the playlist is
            // also awkwardly used by the base video player to obtain the video
            // source
            member.emit("playlist_set", await this.playlist.getVideos());
            member.emit("state_set", this.currentState);
        });

        member.on("state_change_request", (newState: StateChangeRequest) => {
            if (newState.whichElement == StateElements.playing) {
                this.lastKnownState.currentTimeMs =
                    this.currentState.currentTimeMs;
                this.lastKnownState.playing = newState.newValue as boolean;
            } else if (newState.whichElement == StateElements.time) {
                this.lastKnownState.playing = false;
                this.lastKnownState.currentTimeMs = newState.newValue as number;
            } else if (newState.whichElement == StateElements.videoID) {
                this.lastKnownState.currentVideoID =
                    newState.newValue as number;
                this.lastKnownState.currentTimeMs = 0;
                this.lastKnownState.playing = false;
            }
            this.lastKnownStateTimestamp = Date.now();
            logger.debug("emitting accepted player state:");
            logger.debug(JSON.stringify(this.lastKnownState));
            this.audience.forEach((a) =>
                a.emit("state_set", this.lastKnownState)
            );
        });

        member.on("add_video", async (url: string) => {
            logger.debug(
                "attempting to add video with url " + url + " to playlist"
            );
            try {
                this.playlist.addFromURL(url);
            } catch (e) {
                logger.warn("could not get video from url " + url);
                logger.warn(e);
                member.emit("add_video_failed");
            }
        });

        member.on("user_info_set", () => {
            if (member.chatInfo && !member.chatInfo.resumed) {
                const announcement = {
                    isAnnouncement: true,
                    messageHTML: `<strong>${member.chatInfo.name}</strong> joined the Chat.`,
                };
                this.sendToChat(announcement);
            }
            this.emitAll("audience_info_set", this.allUserInfo);
        });
        member.on("user_info_clear", () => {
            this.emitAll("audience_info_set", this.allUserInfo);
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
            }
        });

        member.on("disconnect", () => {
            this.removeMember(member);
            this.audience
                .filter((a) => a.subscriptions.has(Subscription.audience))
                .forEach((a) => a.emit("audience_info_set", this.allUserInfo));
        });
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
                if (
                    memberState.currentVideoID !=
                    this.currentState.currentVideoID
                ) {
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
                        `correcting currentTime for player ${member.id}, who is off by ${difference} ms`
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
    const theater = new Theater(io, playlist);
    app.get("/stats", async (_, res) => {
        logger.debug("rendering stats page");
        res.render("connections", {
            connections: theater.audience.map((a) => a.getConnectionInfo()),
            theaterState: theater.currentState,
        });
    });
}
