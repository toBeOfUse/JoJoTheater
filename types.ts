interface ChatMessage {
    isAnnouncement: boolean;
    messageHTML: string;
    // the below are missing or null for announcements
    senderID?: string;
    senderName?: string;
    senderAvatarURL?: string;
}

interface Video {
    src: string;
    type?: string; // only for local files
    size?: number; // only for local files
    title: string;
    provider?: string; // only for youtube/vimeo
    captions: boolean;
    folder: string;
}
interface VideoState {
    playing: boolean;
    currentVideoIndex: number;
    currentTimeMs: number;
}

enum StateElements {
    playing,
    index,
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

export {
    ChatMessage,
    Video,
    VideoState,
    StateElements,
    StateChangeRequest,
    ChatUserInfo,
};
