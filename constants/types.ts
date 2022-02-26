import type { Socket } from "socket.io-client";
import { APIPath } from "./endpoints";

interface ChatMessage {
    isAnnouncement: boolean;
    messageHTML: string;
    // the below are missing or null for announcements
    userID?: number;
    senderName?: string;
    senderAvatarURL?: string;
}

interface Video {
    id: number;
    src: string;
    /**
     * only for local files; currently unused anyway
     */
    type?: string;
    /**
     * only for local files; currently unused anyway
     */
    size?: number;
    title: string;
    /**
     * only for youtube/vimeo/dailymotion
     */
    provider?: string;
    captions: boolean;
    folder: string;
    /**
     * in seconds
     */
    duration: number;
}

interface VideoState {
    playing: boolean;
    video: Video | null;
    currentTimeMs: number;
}

enum ChangeTypes {
    playing,
    videoID,
    time,
    nextVideo,
    prevVideo,
}

/**
 * `newValue` is required for `playing`, `videoID`, and `time` types
 */
interface StateChangeRequest {
    changeType: ChangeTypes;
    newValue?: boolean | number;
}

const UserSubmittedFolderName = "The Unrestrained Id of the Audience";

enum Subscription {
    audience,
    playlist,
    chat,
}

interface ConnectionStatus {
    chatName: string;
    uptimeMs: number;
    latestPing: number;
    avgPing: number;
    pingHistory: number[];
    location: string;
    playerState: (VideoState & { receivedTimeISO: string }) | undefined;
}

interface ControlsFlag {
    target: "play" | "seek" | "next_video" | "prev_video";
    imagePath: string;
    /**
     * if target == "seek", this is a value between 0 and 1 indicating the
     * pre-seek progress through the video
     */
    startPos?: number;
    /**
     * if target == "seek", this is a value between 0 and 1 indicating the
     * post-seek progress through the video
     */
    endPos?: number;
}

interface User {
    id: number;
    createdAt: Date;
    lastUsername?: string;
    lastAvatarID?: number;
    watchTime: number;
    email?: string;
    passwordHash?: string;
    passwordSalt?: string;
}

interface Token {
    token: string;
    createdAt: Date;
    userID: number;
}

interface Avatar {
    id: number;
    group: string;
    file: string;
    uploaderID: number | null;
    facing: "left" | "right" | "forward";
}

interface ChatUserInfo {
    connectionID: string;
    name: string;
    avatar: Avatar;
    // if they are resuming a previous login session (this is indicated by the
    // client) and so we do not need to announce them
    resumed: boolean;
}

interface ClientGlobalValues {
    loggedIn: boolean;
    inChat: boolean;
    token: string;
}
type GlobalType = any;
type GlobalCallback = (newValue: any) => void;
interface ClientStreamsSocket extends Socket {
    _globals: ClientGlobalValues;
    _listeners: Record<keyof ClientGlobalValues, GlobalCallback[]>;
    setGlobal: (name: string, newValue: GlobalType) => void;
    getGlobal: (name: keyof ClientGlobalValues) => GlobalType;
    watchGlobal: (
        name: keyof ClientGlobalValues,
        callback: GlobalCallback
    ) => void;
    ifAndWhenGlobalAvailable: (
        name: keyof ClientGlobalValues,
        callback: GlobalCallback
    ) => void;
    http: (
        path: APIPath,
        body?: any,
        headers?: Record<string, string>
    ) => Promise<Record<string, any>>;
}

export {
    ChatMessage,
    Video,
    VideoState,
    ChangeTypes,
    StateChangeRequest,
    ChatUserInfo,
    UserSubmittedFolderName,
    Subscription,
    ConnectionStatus,
    ControlsFlag,
    User,
    Token,
    Avatar,
    ClientStreamsSocket as StreamsSocket,
    ClientGlobalValues,
};
