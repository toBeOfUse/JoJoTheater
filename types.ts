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
}

export { ChatMessage, Video };
