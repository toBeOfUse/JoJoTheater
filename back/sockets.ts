import { Server as SocketServer, Socket } from "socket.io";
import type { Express } from "express";
import escapeHTML from "escape-html";
import { Video, playlist as defaultPlaylist } from "./playlist";
import { ChatUserInfo, ChatMessage, ChatAnnouncement } from "../types";
import fetch from "node-fetch";
import { Server } from "http";

type ServerSentEvent =
    | "ping"
    | "id_set"
    | "playlist_set"
    | "chat_message"
    | "chat_announcement"
    | "state_set";

type ClientSentEvent =
    | "state_change_request"
    | "state_update_request"
    | "user_info_set"
    | "wrote_message";

interface PlayerState {
    playing: boolean;
    currentTimeMs: number;
    currentItem: number;
}

interface ConnectionStatus {
    chatName: string;
    uptimeMs: number;
    latestPing: number;
    avgPing: number;
    pingStdDev: number;
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

    get lastRecordedLatency(): number {
        return this.lastLatencies[this.lastLatencies.length - 1];
    }

    get meanLatency(): number {
        return (
            this.lastLatencies.reduce((acc, v) => acc + v, 0) /
            this.lastLatencies.length
        );
    }

    get latencyStdDev(): number {
        const mean = this.meanLatency;
        let variance = 0;
        this.lastLatencies.forEach((l) => (variance += (l - mean) ** 2));
        variance /= this.lastLatencies.length;
        return Math.sqrt(variance);
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
            pingStdDev: this.latencyStdDev,
            location: this.location,
        };
    }

    constructor(socket: Socket) {
        this.socket = socket;
        this.id = socket.id;
        this.socket.onAny((eventName: string, ...args) => {
            if (!eventName.startsWith("pong")) {
                console.log(eventName + " event", args);
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
                this.chatInfo = info;
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
    playlist: Video[] = defaultPlaylist;
    lastKnownState: PlayerState = {
        playing: false,
        currentItem: 0,
        currentTimeMs: 0,
    };
    lastKnownStateTime: number = Date.now();
    chatHistory: (ChatMessage | ChatAnnouncement)[] = [];

    get currentState(): PlayerState {
        return {
            ...this.lastKnownState,
            currentTimeMs: this.lastKnownState.playing
                ? this.lastKnownState.currentTimeMs +
                  (Date.now() - this.lastKnownStateTime)
                : this.lastKnownState.currentTimeMs,
        };
    }

    constructor(io: SocketServer) {
        io.on("connection", (socket: Socket) => {
            const newMember = new AudienceMember(socket);
            newMember.emit("id_set", socket.id);
            newMember.emit("playlist_set", this.playlist);
            newMember.emit("state_set", this.currentState);
            this.addMember(newMember);
            console.log(
                "new client added: " + this.audience.length + " total connected"
            );
            socket.on("disconnect", () => {
                this.removeMember(newMember);
                console.log(
                    "client removed: " +
                        this.audience.length +
                        " total connected"
                );
            });
            if (this.audience.length === 0) {
                this.lastKnownState = { ...this.currentState, playing: false };
                this.lastKnownStateTime = Date.now();
            }
        });
    }

    emitAll(event: ServerSentEvent, ...args: any[]) {
        this.audience.forEach((a) => a.emit(event, ...args));
    }

    addMember(member: AudienceMember) {
        this.audience.push(member);
        member.on("state_change_request", (newState: PlayerState) => {
            this.lastKnownState = newState;
            this.lastKnownStateTime = Date.now();
            this.audience
                .filter((a) => a.id != member.id)
                .forEach((a) => a.emit("state_set", newState));
        });
        member.on("state_update_request", () => {
            member.emit("state_set", this.currentState);
        });
        member.on("user_info_set", () => {
            if (member.chatInfo) {
                // whether to save these in chatHistory or not. decisions, decisions
                this.emitAll(
                    "chat_announcement",
                    `<strong>${member.chatInfo.name}</strong> joined the Chat.`
                );
            }
        });
        member.on("wrote_message", (messageText: string) => {
            if (member.chatInfo) {
                const message: ChatMessage = {
                    messageHTML: escapeHTML(messageText),
                    sender: member.chatInfo,
                    senderID: member.id,
                };
                this.chatHistory.push(message);
                this.emitAll("chat_message", message);
                if (/\bhm+\b/.test(message.messageHTML)) {
                    setTimeout(() => {
                        const villagerMessage: ChatMessage = {
                            messageHTML: "<em>hmmm...</em>",
                            sender: {
                                name: "Minecraft Villager",
                                avatarURL: "/images/avatars/villager.jpg",
                            },
                            senderID: "fake-user-villager",
                        };
                        this.emitAll("chat_message", villagerMessage);
                        this.chatHistory.push(villagerMessage);
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
