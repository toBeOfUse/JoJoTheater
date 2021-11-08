import { Server as SocketServer, Socket } from "socket.io";
import fetch from "node-fetch";
import { Server } from "http";
import URL from "url";
import type { Express } from "express";
import escapeHTML from "escape-html";

import { getPlaylist, addToPlaylist } from "./db";
import { ChatUserInfo, ChatMessage, ChatAnnouncement } from "../types";

type ServerSentEvent =
    | "ping"
    | "id_set"
    | "playlist_set"
    | "chat_message"
    | "chat_announcement"
    | "add_video_failed"
    | "state_set";

type ClientSentEvent =
    | "state_change_request"
    | "state_update_request"
    | "add_video"
    | "user_info_set"
    | "wrote_message"
    | "disconnect";

interface PlayerState {
    playing: boolean;
    currentTimeMs: number;
    currentItem: number;
    seek: boolean;
}

interface ConnectionStatus {
    chatName: string;
    uptimeMs: number;
    latestPing: number;
    avgPing: number;
    pingHistogram: [number[], string[]];
    location: string;
}

class AudienceMember {
    private socket: Socket;
    location: string = "";
    id: string;
    lastLatencies: number[] = [];
    chatInfo: ChatUserInfo | undefined = undefined;
    connected: Date = new Date();
    private static pingID = 0;

    // managed by the Theater
    announcement: string | undefined = undefined;
    hasSentMessage = false;

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

    get connectionInfo(): ConnectionStatus {
        return {
            chatName: this.chatInfo?.name || "",
            uptimeMs: this.uptimeMs,
            latestPing: this.lastRecordedLatency,
            avgPing: this.meanLatency,
            pingHistogram: this.latencyHistogram,
            location: this.location,
        };
    }

    constructor(socket: Socket) {
        this.socket = socket;
        this.id = socket.id;
        this.socket.onAny((eventName: string, ...args) => {
            if (!eventName.startsWith("pong")) {
                console.log(eventName + " event from " + this.id);
                console.log(args);
            }
        });
        this.updateLatency();
        setInterval(() => this.updateLatency(), 20000);
        this.socket.on("user_info_set", (info: ChatUserInfo) => {
            info.name = info.name.trim();
            if (
                info.avatarURL.startsWith("/images/avatars/") &&
                info.name.length < 30
            ) {
                info.name = escapeHTML(info.name);
                this.chatInfo = { ...info, id: this.id };
            }
        });
        const remoteIP = socket.handshake.headers["x-real-ip"] as string;
        if (remoteIP) {
            fetch(`https://ipinfo.io/${remoteIP.split(":")[0]}/geo`)
                .then((res) => res.json())
                .then((json) => {
                    this.location = `${json.city}, ${json.region}, ${json.country}`;
                    console.log(
                        `new client appears to be from ${this.location}`
                    );
                });
        }
    }

    updateLatency(): Promise<number> {
        return new Promise((resolve) => {
            this.socket.emit("ping", AudienceMember.pingID);
            const pingTime = Date.now();
            this.socket.once("pong_" + AudienceMember.pingID, () => {
                const pongTime = Date.now();
                this.lastLatencies.push(pongTime - pingTime);
                if (this.lastLatencies.length > 100) {
                    this.lastLatencies = this.lastLatencies.slice(-100);
                }
                resolve(pingTime);
            });
            AudienceMember.pingID++;
            AudienceMember.pingID %= 10000;
        });
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
        currentItem: 0,
        currentTimeMs: 0,
        seek: false,
    };
    lastKnownStateTimestamp: number = Date.now();
    chatHistory: (ChatMessage | ChatAnnouncement)[] = [];

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
            console.log(
                "new client added: " + this.audience.length + " total connected"
            );
            newMember.on("disconnect", () => {
                if (this.audience.length === 0) {
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

    sendToChat(message: ChatMessage | ChatAnnouncement) {
        this.chatHistory.push(message);
        if (typeof message == "string" || message instanceof String) {
            this.emitAll("chat_announcement", message);
        } else {
            this.emitAll("chat_message", message);
        }
    }

    initializeMember(member: AudienceMember) {
        this.audience.push(member);

        member.on("state_change_request", (newState: PlayerState) => {
            // ignore redundant requests from clients who in fact just had their
            // state changed to the last known state
            if (
                newState.playing === this.lastKnownState.playing &&
                newState.currentItem === this.lastKnownState.currentItem &&
                Math.abs(
                    this.lastKnownState.currentTimeMs - newState.currentTimeMs
                ) < 1000
            ) {
                return;
            }
            if (
                newState.currentItem == this.currentState.currentItem &&
                Math.abs(
                    newState.currentTimeMs - this.currentState.currentTimeMs
                ) > 1000 &&
                !newState.seek
            ) {
                // if the client is trying to change the time by a lot and they're
                // not explicitly seeking or changing the playlist item, they're
                // probably just lagging and giving an old currentTimeMs value and we
                // need to ignore and correct them
                newState.currentTimeMs = this.currentState.currentTimeMs;
                member.emit("state_set", newState);
            }
            this.lastKnownState = newState;
            this.lastKnownStateTimestamp = Date.now();
            this.audience
                .filter((a) => a.id != member.id)
                .forEach((a) => a.emit("state_set", newState));
        });

        member.on("state_update_request", () => {
            member.emit("state_set", this.currentState);
            getPlaylist().then((playlist) => {
                member.emit("playlist_set", playlist);
            });
        });

        member.on("add_video", async (url: string) => {
            try {
                new URL.URL(url); // will throw an error if url is invalid
                if (
                    !url.toLowerCase().includes("youtube.com") &&
                    !url.toLowerCase().includes("vimeo.com")
                ) {
                    throw new Error("url was not a vimeo or youtube url");
                }
                let provider, videoDataURL;
                if (url.toLowerCase().includes("youtube")) {
                    provider = "youtube";
                    videoDataURL = `https://youtube.com/oembed?url=${url}&format=json`;
                } else {
                    provider = "vimeo";
                    videoDataURL = `https://vimeo.com/api/oembed.json?url=${url}`;
                }
                const videoData = await (await fetch(videoDataURL)).json();
                const title = videoData.title;
                await addToPlaylist({
                    provider,
                    src: url,
                    title,
                    captions: true,
                });
                this.emitAll("playlist_set", await getPlaylist());
            } catch (e) {
                console.log("could not get video from url", url);
                console.log(e);
                member.emit("add_video_failed");
            }
        });

        member.on("user_info_set", () => {
            if (member.chatInfo) {
                const announcement = `<strong>${member.chatInfo.name}</strong> joined the Chat.`;
                this.sendToChat(announcement);
                member.announcement = announcement;
            }
        });

        member.on("wrote_message", (messageText: string) => {
            if (member.chatInfo) {
                member.hasSentMessage = true;
                const message: ChatMessage = {
                    messageHTML: escapeHTML(messageText),
                    sender: member.chatInfo,
                };
                this.sendToChat(message);
                if (/\bhm+\b/.test(message.messageHTML)) {
                    setTimeout(() => {
                        const villagerMessage: ChatMessage = {
                            messageHTML: "<em>hmmm...</em>",
                            sender: {
                                id: "fake-villager-user",
                                name: "Minecraft Villager",
                                avatarURL: "/images/avatars/villager.jpg",
                            },
                        };
                        this.sendToChat(villagerMessage);
                    }, 500);
                }
            }
        });

        this.chatHistory.slice(-20).forEach((m) => {
            member.emit(
                typeof m == "string" || m instanceof String
                    ? "chat_announcement"
                    : "chat_message",
                m
            );
        });

        member.on("disconnect", () => {
            this.removeMember(member);
            // remove the announcement of the member joining from the chat
            // history if they didn't send a message
            if (member.announcement && !member.hasSentMessage) {
                this.chatHistory = this.chatHistory.filter(
                    (v) => v != member.announcement
                );
            }
            console.log(
                "client removed: " + this.audience.length + " total connected"
            );
        });
    }

    removeMember(member: AudienceMember) {
        this.audience = this.audience.filter((a) => a.id != member.id);
    }
}

export default function init(server: Server, app: Express) {
    const io = new SocketServer(server);
    const theater = new Theater(io);
    app.get("/stats", (_, res) => {
        res.render("connections", {
            connections: theater.audience.map((a) => a.connectionInfo),
        });
    });
}
