interface ChatMessage {
    isAnnouncement: boolean;
    messageHTML: string;
    // the below are missing or null for announcements
    userID?: number;
    senderName?: string;
    senderAvatarURL?: string;
    createdAt: number;
}

interface Subtitles {
    file: string;
    format: string;
    language: string;
}

interface Video {
    id: number;
    src: string;
    title: string;
    /**
     * only for youtube/vimeo/dailymotion
     */
    provider?: string;
    playlistID: number;
    /**
     * in seconds
     */
    duration: number;
    captions: Subtitles[];
}

interface PlaylistRecord {
    id: number;
    name: string;
    description?: string;
    filePhoto?: string;
    creatorID: number;
    createdAt: number;
    version: number;
    publicallyEditable: boolean;
}

interface PlaylistSnapshot extends PlaylistRecord {
    videos: Video[];
    // TODO: data about the creator?
}

interface VideoState {
    playing: boolean;
    video: Video | null;
    currentTimeMs: number;
}

enum ChangeTypes {
    playing,
    video,
    time,
    nextVideo,
    prevVideo,
}

/**
 * `newValue` is required for `playing`, `videoID`, and `time` types
 */
interface StateChangeRequest {
    changeType: ChangeTypes;
    newValue?: boolean | number | Pick<Video, "id" | "playlistID">;
}

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

interface UserSnapshot {
    id: number;
    createdAt: number;
    lastUsername?: string;
    lastAvatarID?: number;
    watchTime: number;
    email?: string;
    passwordHash?: string;
    passwordSalt?: string;
    alsoKnownAs: Record<string, string>;
}

type PublicUser = Omit<UserSnapshot, "email" | "passwordHash" | "passwordSalt">;

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

function deNull(obj: any) {
    if (typeof obj == "object" && obj !== null) {
        for (const prop in obj) {
            if (obj[prop] === null) {
                obj[prop] = undefined;
            } else if (typeof obj[prop] == "object") {
                deNull(obj[prop]);
            }
        }
    }
    return obj;
}

export {
    ChatMessage,
    Video,
    VideoState,
    ChangeTypes,
    StateChangeRequest,
    ChatUserInfo,
    Subscription,
    ConnectionStatus,
    ControlsFlag,
    UserSnapshot,
    PublicUser,
    Token,
    Avatar,
    Subtitles,
    PlaylistRecord,
    PlaylistSnapshot,
    deNull,
};
