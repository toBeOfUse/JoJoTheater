import { Socket } from "socket.io-client";
import { Video } from "../types";

class Player {
    playlist: Video[] = [];
    playlistShown: boolean = false;
    currentVideoIndex: number = 0;
}
function initVideo(io: Socket): Player {
    return new Player();
}

export default initVideo;
