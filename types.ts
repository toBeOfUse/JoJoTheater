interface ChatUserInfo {
    name: string;
    avatarURL: string;
}

type ChatAnnouncement = string;

interface ChatMessage {
    messageHTML: string;
    sender: ChatUserInfo;
    senderID: string;
}

export { ChatUserInfo, ChatMessage, ChatAnnouncement };
