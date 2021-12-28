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
     * only for youtube/vimeo
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

enum StateElements {
    playing,
    videoID,
    time,
}

interface StateChangeRequest {
    whichElement: StateElements;
    newValue: boolean | number;
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

export {
    ChatMessage,
    Video,
    VideoState,
    StateElements,
    StateChangeRequest,
    ChatUserInfo,
    UserSubmittedFolderName,
    Subscription,
};
