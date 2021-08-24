import { Server as SocketServer, Socket } from "socket.io";
import { Server } from "http";
import escapeHTML from "escape-html";
import { Video, playlist as defaultPlaylist } from "./playlist";
import { ChatUserInfo, ChatMessage, ChatAnnouncement } from "../types";
import fetch from "node-fetch";

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

interface playerState {
    playing: boolean;
    currentTimeMs: number;
    currentItem: number;
}

class AudienceMember {
    private socket: Socket;
    name: string = "";
    id: string;
    lastRecordedLatency: number = -1;
    chatInfo: ChatUserInfo | undefined = undefined;
    private static pingID = 0;

    constructor(socket: Socket) {
        this.socket = socket;
        this.id = socket.id;
        this.socket.onAny((eventName: string, ...args) => {
            if (!eventName.startsWith("pong")) {
                console.log(eventName + " event", args);
            }
        });
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
    }

    updateLatency(): Promise<number> {
        return new Promise((resolve) => {
            this.socket.emit("ping", AudienceMember.pingID);
            const pingTime = Date.now();
            this.socket.once("pong_" + AudienceMember.pingID, () => {
                const pongTime = Date.now();
                this.lastRecordedLatency = pongTime - pingTime;
                resolve(pingTime);
            });
            AudienceMember.pingID++;
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
    lastKnownState: playerState = {
        playing: false,
        currentItem: 0,
        currentTimeMs: 0,
    };
    lastKnownStateTime: number = Date.now();
    chatHistory: (ChatMessage | ChatAnnouncement)[] = [];

    get currentState(): playerState {
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
            const remoteIP = socket.handshake.headers["X-Real-IP"];
            if (remoteIP) {
                fetch(`https://ipinfo.io/${remoteIP}/geo`)
                    .then((res) => res.json())
                    .then((json) =>
                        console.log(
                            `new client appears to be from ${json.city}, ${json.region}, ${json.country}`
                        )
                    );
            }
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
        this.measureLatency();
        setInterval(() => this.measureLatency(), 20000);
    }

    async measureLatency() {
        if (!this.audience.length) {
            return;
        }
        for (const member of this.audience) {
            await member.updateLatency();
        }
        console.log("measured latencies in ms: ");
        console.log(this.audience.map((a) => a.lastRecordedLatency).join(", "));
    }

    emitAll(event: ServerSentEvent, ...args: any[]) {
        this.audience.forEach((a) => a.emit(event, ...args));
    }

    addMember(member: AudienceMember) {
        this.audience.push(member);
        member.on("state_change_request", (newState: playerState) => {
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

export default function init(server: Server) {
    const io = new SocketServer(server);
    new Theater(io);
}
