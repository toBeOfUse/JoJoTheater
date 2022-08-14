import { deNull } from "./types";

enum APIPath {
    startChatting = "/room/chatLogin",
    stopChatting = "/room/chatLogout",
    sendMessage = "/room/sendMessage",
    addVideo = "/room/addVideo",
    typingStart = "/room/typing",
    changeScene = "/room/changeScene",
    getStats = "/api/stats",
    getMessages = "/room/messages",
    getAllScenes = "/api/scenes",
    getRoomScenes = "/room/scenes",
    optimizedImage = "/imgopt",
    switchProps = "/room/propSwitch",
    getAvatars = "/room/avatars",
    getIdentity = "/api/identity",
    setIdle = "/room/idle",
    getFreeSpace = "/api/gb",
    signup = "/api/signup",
    signin = "/api/signin",
    editProfile = "/api/editProfile",
    signout = "/api/signout",
}

interface PostBody {}
interface GetBody
    extends Record<string, string | number | boolean | undefined> {}

abstract class Endpoint<BodyType> {
    path: APIPath;
    roomDependent: boolean;
    chatDependent: boolean;
    static dir: Partial<Record<APIPath, Endpoint<PostBody>>> = {};
    constructor(
        path: APIPath,
        options: { roomDependent: boolean; chatDependent: boolean }
    ) {
        this.path = path;
        this.roomDependent = options.roomDependent;
        this.chatDependent = options.chatDependent;
        Endpoint.dir[path] = this;
    }
    abstract dispatch(
        token: string,
        body: BodyType,
        connectionID?: string,
        headers?: Record<string, string>
    ): Promise<Record<string, any>>;
}

class PostEndpoint<BodyType extends PostBody> extends Endpoint<BodyType> {
    async dispatch(
        token: string,
        body: BodyType,
        connectionID?: string,
        headers: Record<string, string> = {}
    ) {
        if ((this.roomDependent || this.chatDependent) && !token) {
            throw (
                "Missing identification token for room-dependent endpoint " +
                this.path
            );
        }
        const response = await fetch(this.path, {
            method: "POST",
            headers: {
                "MB-Token": token,
                "MB-Connection": connectionID || "none",
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
            return deNull(JSON.parse(text));
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
        connectionID?: string,
        headers: Record<string, string> = {}
    ) {
        if ((this.roomDependent || this.chatDependent) && !token) {
            throw (
                "Missing authentication token for room-dependent endpoint " +
                this.path
            );
        }
        const response = await fetch(this.fullPath(body), {
            headers: {
                "MB-Token": token,
                "MB-Connection": connectionID || "none",
                ...headers,
            },
        });
        const text = await response.text();
        try {
            const obj = JSON.parse(text);
            return deNull(obj);
        } catch {
            return text;
        }
    }
}

interface ChatLogInBody extends PostBody {
    name: string;
    avatarID: number;
    resumed: boolean;
}
interface SendMessageBody extends PostBody {
    messageText: string;
}
interface AddVideoBody extends PostBody {
    playlistID: number;
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
interface SignupBody extends PostBody {
    email: string;
    password: string;
    alsoKnownAs: Record<string, string>;
}
type EditProfileBody = Partial<SignupBody>;
interface SigninBody extends PostBody {
    email: string;
    password: string;
}

// TODO: extra "admin only" permissions for like stats and uploads
const fullyThere = { roomDependent: true, chatDependent: true };
const halfwayThere = { roomDependent: true, chatDependent: false };
const anywhere = { roomDependent: false, chatDependent: false };

new PostEndpoint<ChatLogInBody>(APIPath.startChatting, halfwayThere);
new PostEndpoint<SendMessageBody>(APIPath.sendMessage, fullyThere);
new PostEndpoint<{}>(APIPath.stopChatting, fullyThere);
new PostEndpoint<AddVideoBody>(APIPath.addVideo, halfwayThere);
new PostEndpoint<ChangeSceneBody>(APIPath.changeScene, fullyThere);
new PostEndpoint<{}>(APIPath.typingStart, fullyThere);
new GetEndpoint<{}>(APIPath.getStats, halfwayThere);
new GetEndpoint<{}>(APIPath.getMessages, halfwayThere);
new GetEndpoint<{}>(APIPath.getAllScenes, anywhere);
new GetEndpoint<{ roomID: number }>(APIPath.getRoomScenes, halfwayThere);
new GetEndpoint<OptimizedImageBody>(APIPath.optimizedImage, anywhere);
new PostEndpoint<{}>(APIPath.switchProps, fullyThere);
new GetEndpoint<{ room: string }>(APIPath.getAvatars, halfwayThere);
new GetEndpoint<{}>(APIPath.getIdentity, anywhere);
new PostEndpoint<{ idle: boolean }>(APIPath.setIdle, fullyThere);
new GetEndpoint<{}>(APIPath.getFreeSpace, anywhere);
new PostEndpoint<SignupBody>(APIPath.signup, anywhere);
new PostEndpoint<SigninBody>(APIPath.signin, anywhere);
new PostEndpoint<{}>(APIPath.signout, anywhere);
new PostEndpoint<EditProfileBody>(APIPath.editProfile, anywhere);

const endpoints = Endpoint.dir as Record<APIPath, Endpoint<PostBody | GetBody>>;

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
    ChatLogInBody as LogInBody,
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
    SignupBody,
    SigninBody,
    EditProfileBody,
};
