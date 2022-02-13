import { ChatUserInfo } from "./types";

enum APIPath {
    logIn = "/logIn",
    logOut = "/logOut",
    sendMessage = "/sendMessage",
    addVideo = "/addVideo",
}

interface RequestBody {}

abstract class Endpoint<BodyType> {
    path: APIPath;
    needsAuthentication: boolean;
    constructor(path: APIPath, needsAuthentication: boolean) {
        this.path = path;
        this.needsAuthentication = needsAuthentication;
    }
    abstract dispatch(body: BodyType, token: string): Record<string, any>;
}

class PostEndpoint<BodyType> extends Endpoint<BodyType> {
    async dispatch(body: BodyType, token: string = "") {
        if (this.needsAuthentication && !token) {
            throw (
                "Missing authentication token for secure endpoint " + this.path
            );
        }
        const response = await fetch(this.path, {
            method: "POST",
            headers: { Auth: token, "Content-Type": "application/json" },
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

interface LogInBody extends RequestBody, Omit<ChatUserInfo, "id"> {}
interface SendMessageBody extends RequestBody {
    messageText: string;
}
interface AddVideoBody extends RequestBody {
    url: string;
}

const LogInEndpoint = new PostEndpoint<LogInBody>(APIPath.logIn, true);
const SendMessageEndpoint = new PostEndpoint<SendMessageBody>(
    APIPath.sendMessage,
    true
);
const LogOutEndpoint = new PostEndpoint<{}>(APIPath.logOut, true);
const AddVideoEndpoint = new PostEndpoint<AddVideoBody>(APIPath.addVideo, true);

const endpoints: Record<APIPath, Endpoint<RequestBody>> = {
    [APIPath.logIn]: LogInEndpoint,
    [APIPath.sendMessage]: SendMessageEndpoint,
    [APIPath.logOut]: LogOutEndpoint,
    [APIPath.addVideo]: AddVideoEndpoint,
};

export {
    LogInBody,
    LogInEndpoint,
    SendMessageEndpoint,
    SendMessageBody,
    LogOutEndpoint,
    APIPath,
    endpoints,
};
