import { Server as SocketServer, Socket } from "socket.io";
import { Server } from "http";
import { Video, playlist as defaultPlaylist } from "./playlist";

type ServerSentEvent =
    | "ping"
    | "id_set"
    | "playlist_set"
    | "message"
    | "state_set";

type ClientSentEvent = "state_change_request" | "state_update_request";

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
    private static pingID = 0;

    constructor(socket: Socket) {
        this.socket = socket;
        this.id = socket.id;
        this.socket.onAny((eventName: string, ...args) => {
            if (!eventName.startsWith("pong")) {
                console.log(eventName + " event", args);
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

    get currentState(): playerState {
        return {
            ...this.lastKnownState,
            currentTimeMs: this.lastKnownState.playing
                ? this.lastKnownState.currentTimeMs +
                  Date.now() -
                  this.lastKnownStateTime
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
        member.on("state_change_request", (newState) => {
            this.lastKnownState = newState;
            this.lastKnownStateTime = Date.now();
            this.audience
                .filter((a) => a.id != member.id)
                .forEach((a) => a.emit("state_set", newState));
        });
        member.on("state_update_request", () => {
            member.emit("state_set", this.currentState);
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
