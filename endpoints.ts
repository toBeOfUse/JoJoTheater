import { ChatUserInfo } from "./types";
import globals from "./front/globals";

enum APIPath {
    logIn = "/api/logIn",
    logOut = "/api/logOut",
    sendMessage = "/api/sendMessage",
    addVideo = "/api/addVideo",
    typingStart = "/events/typing",
    changeScene = "/events/changeScene",
    getStats = "/get/stats",
    getMessages = "/get/messages",
}

interface PostBody {}
interface GetBody extends Record<string, string> {}

abstract class Endpoint<BodyType> {
    path: APIPath;
    mustBeInChat: boolean;
    constructor(path: APIPath, mustBeInChat: boolean) {
        this.path = path;
        this.mustBeInChat = mustBeInChat;
    }
    abstract dispatch(
        body: BodyType,
        headers?: Record<string, string>
    ): Promise<Record<string, any>>;
}

class PostEndpoint<BodyType extends PostBody> extends Endpoint<BodyType> {
    async dispatch(body: BodyType, headers: Record<string, string> = {}) {
        const token = globals.get("token") as string;
        if (this.mustBeInChat && !token) {
            throw (
                "Missing authentication token for secure endpoint " + this.path
            );
        }
        const response = await fetch(this.path, {
            method: "POST",
            headers: {
                Auth: token,
                "Content-Type": "application/json",
                ...headers,
            },
            body: JSON.stringify(body),
        });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }
}

class GetEndpoint<BodyType extends GetBody> extends Endpoint<BodyType> {
    async dispatch(body: BodyType, headers: Record<string, string> = {}) {
        const token = globals.get("token") as string;
        if (this.mustBeInChat && !token) {
            throw (
                "Missing authentication token for secure endpoint " + this.path
            );
        }
        const query = new URLSearchParams(body).toString();
        const response = await fetch(this.path + query, {
            headers: { Auth: token, ...headers },
        });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }
}

interface LogInBody extends PostBody, Omit<ChatUserInfo, "id"> {}
interface SendMessageBody extends PostBody {
    messageText: string;
}
interface AddVideoBody extends PostBody {
    url: string;
}

const endpoints: Record<APIPath, Endpoint<PostBody>> = {
    [APIPath.logIn]: new PostEndpoint<LogInBody>(APIPath.logIn, false),
    [APIPath.sendMessage]: new PostEndpoint<SendMessageBody>(
        APIPath.sendMessage,
        true
    ),
    [APIPath.logOut]: new PostEndpoint<{}>(APIPath.logOut, true),
    [APIPath.addVideo]: new PostEndpoint<AddVideoBody>(APIPath.addVideo, true),
    [APIPath.changeScene]: new PostEndpoint<{}>(APIPath.changeScene, true),
    [APIPath.typingStart]: new PostEndpoint<{}>(APIPath.typingStart, true),
    [APIPath.getStats]: new GetEndpoint<{}>(APIPath.getStats, false),
    [APIPath.getMessages]: new GetEndpoint<{}>(APIPath.getMessages, false),
};

export {
    LogInBody,
    SendMessageBody,
    AddVideoBody,
    APIPath,
    PostEndpoint,
    GetEndpoint,
    endpoints,
};