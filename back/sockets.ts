import { Server as SocketServer, Socket } from "socket.io";
import { Server } from "http";

export default function init(server: Server) {
    const io = new SocketServer(server, {
        // ...
    });

    io.on("connection", (socket: Socket) => {
        socket.emit("id_set", socket.id);
    });
}
