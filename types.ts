interface ChatMessage {
    isAnnouncement: boolean;
    messageHTML: string;
    // the below are missing or null for announcements
    senderID?: string;
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

interface ChatUserInfo {
    id: string;
    name: string;
    avatarURL: string;
    // if they are resuming a previous login session (this is indicated by the
    // client) and so we do not need to announce them
    resumed: boolean;
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
    pingHistogram: [number[], string[]];
    location: string;
    playerState: VideoState | undefined;
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
};
