interface ChatUserInfo {
    id: string;
    name: string;
    avatarURL: string;
}

type ChatAnnouncement = string;

interface ChatMessage {
    messageHTML: string;
    sender: ChatUserInfo;
}

export { ChatUserInfo, ChatMessage, ChatAnnouncement };
