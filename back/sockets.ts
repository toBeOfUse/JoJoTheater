import { Server as SocketServer, Socket } from "socket.io";
import fetch from "node-fetch";
import { Server } from "http";
import URL from "url";
import type { Express } from "express";
import escapeHTML from "escape-html";

import {
    getPlaylist,
    addToPlaylist,
    getRecentMessages,
    addMessage,
} from "./db";
import {
    ChatMessage,
    VideoState as PlayerState,
    StateChangeRequest,
    StateElements,
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
    | "request_state_report"
    | "alert";

type ClientSentEvent =
    | "state_change_request"
    | "add_video"
    | "user_info_set"
    | "wrote_message"
    | "disconnect"
    | "error_report"
    | "state_report";

interface ConnectionStatus {
    chatName: string;
    uptimeMs: number;
    latestPing: number;
    avgPing: number;
    pingHistogram: [number[], string[]];
    location: string;
    playerState: PlayerState | undefined;
}

interface ChatUserInfo {
    id: string;
    name: string;
    avatarURL: string;
    // if they are resuming a previous login session (this is indicated by the
    // client) and so we do not need to announce them
    resumed: boolean;
}

class AudienceMember {
    private socket: Socket;
    location: string = "";
    id: string;
    lastLatencies: number[] = [];
    chatInfo: ChatUserInfo | undefined = undefined;
    connected: Date = new Date();

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

    async getConnectionInfo(): Promise<ConnectionStatus> {
        const playerState = await this.getClientState();
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

    getClientState(): Promise<PlayerState | undefined> {
        const request = new Promise<PlayerState>((resolve) => {
            this.socket.once("state_report", (state: PlayerState) => {
                resolve(state);
            });
            setTimeout(() => {
                // TODO: remove listener on timeout
                resolve(undefined as any);
            }, 2000);
        });
        this.emit("request_state_report");
        return request;
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
    lastKnownState: PlayerState = {
        playing: false,
        currentVideoIndex: 0,
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

    constructor(io: SocketServer) {
        io.on("connection", (socket: Socket) => {
            const newMember = new AudienceMember(socket);
            newMember.emit("id_set", socket.id);
            getPlaylist().then((playlist) => {
                newMember.emit("playlist_set", playlist);
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
            this.checkSynchronization();
        });
    }

    emitAll(event: ServerSentEvent, ...args: any[]) {
        this.audience.forEach((a) => a.emit(event, ...args));
    }

    sendToChat(message: ChatMessage) {
        addMessage(message);
        if (message.isAnnouncement) {
            logger.debug("emitting chat annoucement:");
            logger.debug(JSON.stringify(message));
            this.emitAll("chat_announcement", message.messageHTML);
        } else {
            logger.debug("emitting chat message:");
            logger.debug(JSON.stringify(message));
            this.emitAll("chat_message", message);
        }
    }

    initializeMember(member: AudienceMember) {
        this.audience.push(member);

        member.on("state_change_request", (newState: StateChangeRequest) => {
            if (newState.whichElement == StateElements.playing) {
                this.lastKnownState.currentTimeMs =
                    this.currentState.currentTimeMs;
                this.lastKnownState.playing = newState.newValue as boolean;
            } else if (newState.whichElement == StateElements.time) {
                this.lastKnownState.playing = false;
                this.lastKnownState.currentTimeMs = newState.newValue as number;
            } else if (newState.whichElement == StateElements.index) {
                this.lastKnownState.currentVideoIndex =
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
                new URL.URL(url); // will throw an error if url is invalid
                if (
                    !url.toLowerCase().includes("youtube.com") &&
                    !url.toLowerCase().includes("vimeo.com")
                ) {
                    throw new Error("url was not a vimeo or youtube url");
                }
                let provider, videoDataURL, videoID;
                if (url.toLowerCase().includes("youtube")) {
                    provider = "youtube";
                    videoDataURL = `https://youtube.com/oembed?url=${url}&format=json`;
                    // from https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
                    const videoIDMatch = url.match(
                        /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/
                    );
                    if (videoIDMatch && videoIDMatch[1]) {
                        videoID = videoIDMatch[1];
                    } else {
                        throw new Error("could not get video id from " + url);
                    }
                } else {
                    provider = "vimeo";
                    videoDataURL = `https://vimeo.com/api/oembed.json?url=${url}`;
                    const uri = new URL.URL(url).pathname;
                    const idMatch = uri.match(/\d+$/);
                    if (idMatch) {
                        videoID = idMatch[0];
                    } else {
                        throw new Error("could not get video id from " + url);
                    }
                }
                const videoData = await (await fetch(videoDataURL)).json();
                const title = videoData.title;
                await addToPlaylist({
                    provider,
                    src: videoID,
                    title,
                    captions: true,
                });
                this.emitAll("playlist_set", await getPlaylist());
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

        getRecentMessages().then((messages) =>
            messages.forEach((m) => {
                member.emit(
                    m.isAnnouncement ? "chat_announcement" : "chat_message",
                    m.isAnnouncement ? m.messageHTML : m
                );
            })
        );

        member.on("disconnect", () => {
            this.removeMember(member);
        });
    }

    async checkSynchronization() {
        while (true) {
            for (const member of this.audience) {
                const memberState = await member.getClientState();
                if (memberState) {
                    const difference = Math.abs(
                        memberState.currentTimeMs -
                            this.currentState.currentTimeMs
                    );
                    if (difference > 1000) {
                        member.emit("state_set", this.currentState);
                        if (difference > 3000) {
                            if (
                                memberState.playing == this.currentState.playing
                            ) {
                                member.emit(
                                    "alert",
                                    "MitchBot is syncing you up"
                                );
                            } else if (
                                this.currentState.playing &&
                                !memberState.playing
                            ) {
                                member.emit(
                                    "alert",
                                    "Your browser is blocking autoplay;" +
                                        " press play to sync up with MitchBot"
                                );
                            }
                        }
                    }
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    removeMember(member: AudienceMember) {
        this.audience = this.audience.filter((a) => a.id != member.id);
    }
}

export default function init(server: Server, app: Express) {
    const io = new SocketServer(server);
    const theater = new Theater(io);
    app.get("/stats", async (_, res) => {
        logger.debug("rendering stats page");
        res.render("connections", {
            connections: await Promise.all(
                theater.audience.map(async (a) => await a.getConnectionInfo())
            ),
            theaterState: theater.currentState,
        });
    });
}
