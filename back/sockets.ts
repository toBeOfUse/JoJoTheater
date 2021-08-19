import { Server as SocketServer, Socket } from "socket.io";
import { Server } from "http";
import { Video, playlist as defaultPlaylist } from "./playlist";

type ServerSentEvent =
    | "id_set"
    | "playlist_set"
    | "index_set"
    | "play"
    | "pause"
    | "message";

type ClientSentEvent =
    | "change_buffering_state"
    | "play_request"
    | "pause_request"
    | "next_item_request"
    | "prev_item_request"
    | "autoplay_error";

class AudienceMember {
    private socket: Socket;
    buffering: boolean = false;
    name: string = "";
    id: string;

    constructor(socket: Socket) {
        this.socket = socket;
        this.id = socket.id;
        this.socket.on("change_buffering_state", (new_state: boolean) => {
            this.buffering = new_state;
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
    // only false when content is explicitly paused
    playing: boolean = false;
    playlist: Video[] = defaultPlaylist;
    playlistIndex: number = 0;

    constructor(io: SocketServer) {
        io.on("connection", (socket: Socket) => {
            const newMember = new AudienceMember(socket);
            newMember.emit("id_set", socket.id);
            newMember.emit("playlist_set", this.playlist);
            newMember.emit("index_set", this.playlistIndex);
            this.addMember(newMember);
            console.log(
                "new client added: " + this.audience.length + " total connected"
            );
            this.checkIfCanPlay();
            socket.on("disconnect", () => {
                this.removeMember(newMember);
                console.log(
                    "client removed: " +
                        this.audience.length +
                        " total connected"
                );
            });
        });
    }

    emitAll(event: ServerSentEvent, ...args: any[]) {
        this.audience.forEach((a) => a.emit(event, ...args));
    }

    get allMembersReady(): boolean {
        return this.audience.every((a) => !a.buffering);
    }

    checkIfCanPlay() {
        if (this.allMembersReady && this.playing) {
            this.emitAll("play");
        } else if (!this.allMembersReady) {
            this.emitAll("pause");
            this.notifyOfBuffering();
        }
    }

    notifyOfBuffering() {
        this.audience
            .filter((a) => !a.buffering)
            .forEach((a) =>
                a.emit(
                    "message",
                    "waiting for other people to finish buffering..."
                )
            );
    }

    addMember(member: AudienceMember) {
        this.audience.push(member);
        member.on("change_buffering_state", () => {
            this.checkIfCanPlay();
        });
        member.on("play_request", () => {
            this.play();
        });
        member.on("pause_request", () => {
            this.pause();
        });
        member.on("next_item_request", () => {
            if (this.playlistIndex < this.playlist.length - 1) {
                this.playlistIndex += 1;
                this.emitAll("index_set", this.playlistIndex);
            }
        });
        member.on("prev_item_request", () => {
            if (this.playlistIndex > 0) {
                this.playlistIndex -= 1;
                this.emitAll("index_set", this.playlistIndex);
            }
        });
        member.on("autoplay_error", () => {
            this.audience
                .filter((a) => a.id != member.id)
                .forEach((a) =>
                    a.emit("message", "someone's browser is blocking autoplay")
                );
        });
    }
    removeMember(member: AudienceMember) {
        this.audience = this.audience.filter((a) => a.id != member.id);
    }
    play() {
        if (this.allMembersReady) {
            this.playing = true;
            this.emitAll("play");
        } else {
            this.notifyOfBuffering();
        }
    }
    pause() {
        this.playing = false;
        this.emitAll("pause");
    }
}

export default function init(server: Server) {
    const io = new SocketServer(server);
    new Theater(io);
}
