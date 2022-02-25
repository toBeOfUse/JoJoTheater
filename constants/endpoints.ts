import { ChatUserInfo } from "./types";

enum APIPath {
    logIn = "/api/logIn",
    logOut = "/api/logOut",
    sendMessage = "/api/sendMessage",
    addVideo = "/api/addVideo",
    typingStart = "/events/typing",
    changeScene = "/events/changeScene",
    getStats = "/get/stats",
    getMessages = "/get/messages",
    getScenes = "/get/scenes",
    optimizedImage = "/imgopt",
    switchProps = "/scene/propSwitch",
    getAvatars = "/get/avatars",
    getIdentity = "/get/identity",
}

interface PostBody {}
interface GetBody
    extends Record<string, string | number | boolean | undefined> {}

abstract class Endpoint<BodyType> {
    path: APIPath;
    mustBeInChat: boolean;
    constructor(path: APIPath, mustBeInChat: boolean) {
        this.path = path;
        this.mustBeInChat = mustBeInChat;
    }
    abstract dispatch(
        token: string,
        body: BodyType,
        headers?: Record<string, string>
    ): Promise<Record<string, any>>;
}

class PostEndpoint<BodyType extends PostBody> extends Endpoint<BodyType> {
    async dispatch(
        token: string,
        body: BodyType,
        headers: Record<string, string> = {}
    ) {
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
        if (!response.ok) {
            throw response.statusText;
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }
}

class GetEndpoint<BodyType extends GetBody> extends Endpoint<BodyType> {
    fullPath(body: BodyType) {
        const params = new URLSearchParams();
        for (const key in body) {
            if (body[key] !== undefined) {
                params.append(key, String(body[key]));
            }
        }
        return this.path + "?" + params.toString();
    }
    async dispatch(
        token: string,
        body: BodyType,
        headers: Record<string, string> = {}
    ) {
        if (this.mustBeInChat && !token) {
            throw (
                "Missing authentication token for secure endpoint " + this.path
            );
        }
        const response = await fetch(this.fullPath(body), {
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

interface LogInBody extends PostBody {
    name: string;
    avatarID: number;
    resumed: boolean;
}
interface SendMessageBody extends PostBody {
    messageText: string;
}
interface AddVideoBody extends PostBody {
    url: string;
}
interface ChangeSceneBody extends PostBody {
    newScene: string;
}
interface OptimizedImageBody extends GetBody {
    path: string;
    width: number | "max";
    flip?: boolean;
    ratio?: string;
}

const endpoints: Record<APIPath, Endpoint<PostBody>> = {
    [APIPath.logIn]: new PostEndpoint<LogInBody>(APIPath.logIn, false),
    [APIPath.sendMessage]: new PostEndpoint<SendMessageBody>(
        APIPath.sendMessage,
        true
    ),
    [APIPath.logOut]: new PostEndpoint<{}>(APIPath.logOut, true),
    [APIPath.addVideo]: new PostEndpoint<AddVideoBody>(APIPath.addVideo, true),
    [APIPath.changeScene]: new PostEndpoint<ChangeSceneBody>(
        APIPath.changeScene,
        true
    ),
    [APIPath.typingStart]: new PostEndpoint<{}>(APIPath.typingStart, true),
    [APIPath.getStats]: new GetEndpoint<{}>(APIPath.getStats, false),
    [APIPath.getMessages]: new GetEndpoint<{}>(APIPath.getMessages, false),
    [APIPath.getScenes]: new GetEndpoint<{}>(APIPath.getScenes, false),
    [APIPath.optimizedImage]: new GetEndpoint<OptimizedImageBody>(
        APIPath.optimizedImage,
        false
    ),
    [APIPath.switchProps]: new PostEndpoint<{}>(APIPath.switchProps, true),
    [APIPath.getAvatars]: new GetEndpoint<{ room: string }>(
        APIPath.getAvatars,
        false
    ),
    [APIPath.getIdentity]: new GetEndpoint<{}>(APIPath.getIdentity, false),
};

/**
 * Since the optimized image endpoint is often used by simply setting an img's
 * src attribute to its url, this function might be more convenient than using a
 * GetEndpoint object with its dispatch method. Automatically URL-encodes
 * params.path. Parameters that map to `undefined` will be ignored.
 * @param params: query string parameters, with a non-encoded `path`
 * value that looks like `/images/avatars/muppets/kermit.jpg`
 * @returns a URL that looks like
 * `/imgopt?path=%2Fimages%2Favatars%2Fmuppets%2Fkermit.jpg&width=450&flip=true&ratio=1:1`
 */
function getOptimizedImageURL(params: OptimizedImageBody): string {
    return (
        endpoints[APIPath.optimizedImage] as GetEndpoint<OptimizedImageBody>
    ).fullPath(params);
}

function getAvatarImageURL(avatarFile: string) {
    return "/images/avatars/" + avatarFile;
}

export {
    LogInBody,
    SendMessageBody,
    AddVideoBody,
    ChangeSceneBody,
    APIPath,
    PostEndpoint,
    GetEndpoint,
    endpoints,
    OptimizedImageBody,
    getOptimizedImageURL,
    getAvatarImageURL,
};
