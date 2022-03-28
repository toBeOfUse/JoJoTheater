import EventEmitter from "events";
import path from "path";
import { promises as asyncFS } from "fs";

import knex, { Knex } from "knex";
import fetch from "node-fetch";
import execa from "execa";
import getVideoID from "get-video-id";
import bcrypt from "bcrypt";

import logger from "./logger";
import {
    ChatMessage,
    Video,
    Token,
    Avatar,
    Subtitles,
    PlaylistRecord,
    PlaylistSnapshot,
    UserSnapshot,
    PublicUser,
    UserName,
} from "../constants/types";
import { youtubeAPIKey } from "./secrets";
import { is } from "typescript-is";
import { nanoid } from "nanoid";
import { RequestHandler } from "express";

// sigh
const fileExists = (file: string) =>
    new Promise((resolve) =>
        asyncFS
            .access(file)
            .then(() => resolve(true))
            .catch(() => resolve(false))
    );

// Setup a one time declaration to make knex use number as result type for all
// count and countDistinct invocations (for any table)
declare module "knex/types/result" {
    interface Registry {
        Count: number;
    }
}

const streamsDB = knex({
    client: "better-sqlite3",
    connection: {
        filename: "./back/db/streams.db",
    },
});

type VideoRecord = Omit<Video, "captions"> & { position: number };

/**
 * Database wrapper with static methods for querying for playlists and videos
 * and non-static methods for adding and retrieving videos from a specific
 * playlist. TODO: video removal, video re-ordering, metadata edting, entire
 * playlist deletion...
 */
class Playlist {
    id: number;
    connection: Knex<any, unknown[]>;
    static thumbnailPath = path.join(__dirname, "../assets/images/thumbnails/");

    /**
     * When a playlist changes (i. e. its videos or its metadata are altered),
     * this bus must emit the event "playlist_changed", with the new
     * PlaylistSnapshot for the changed playlist as the event data. This is so
     * that owners of Playlist objects (currently, instances of the Theater
     * class) can update interested parties (WebSocket clients) of the new state
     * of the playlist without all having to fetch said new state individually or
     * coordinate in any way.
     */
    static bus = new EventEmitter();

    private constructor(
        id: number,
        dbConnection: Knex<any, unknown[]> = streamsDB
    ) {
        this.connection = dbConnection;
        this.id = id;
    }

    static async getByID(
        id: number,
        connection: Knex<any, unknown[]> = streamsDB
    ): Promise<Playlist | undefined> {
        const result = new Playlist(id, connection);
        if (await result.exists()) {
            return result;
        } else {
            return undefined;
        }
    }

    static async getAll(
        dbConnection: Knex<any, unknown[]> = streamsDB
    ): Promise<Playlist[]> {
        const records = await dbConnection
            .table<PlaylistRecord>("playlists")
            .select("id");
        return records.map((r) => new Playlist(r.id, dbConnection));
    }

    static async hydrateVideos(
        query: Promise<VideoRecord[]>,
        connection = streamsDB
    ): Promise<Video[]> {
        const videos = await query;
        return await Promise.all(
            videos.map(
                (v) =>
                    new Promise<Video>(async (resolve) => {
                        resolve({
                            ...v,
                            captions: await connection
                                .select(["file", "format", "language"])
                                .from<Subtitles & { video: number }>(
                                    "subtitles"
                                )
                                .where({ video: v.id }),
                            provider: v.provider || undefined,
                        });
                    })
            )
        );
    }

    async exists(): Promise<boolean> {
        return (
            (
                await this.connection
                    .table<PlaylistRecord>("playlists")
                    .count("*", { as: "count" })
                    .where({ id: this.id })
            )[0].count > 0
        );
    }

    async getMetadata(): Promise<PlaylistRecord> {
        return (await this.connection
            .table<PlaylistRecord>("playlists")
            .select("*")
            .where({ id: this.id })
            .first()) as PlaylistRecord;
    }

    async getSnapshot(): Promise<PlaylistSnapshot> {
        return {
            ...(await this.getMetadata()),
            videos: await this.getVideos(),
        };
    }

    static async getVideoByID(
        id: number,
        connection = streamsDB
    ): Promise<Video | undefined> {
        const query = connection
            .select("*")
            .from<VideoRecord>("videos")
            .where({ id });
        return (await Playlist.hydrateVideos(query))[0];
    }

    async getVideos(): Promise<Video[]> {
        const query = this.connection
            .select("*")
            .from<VideoRecord>("videos")
            .where({ playlistID: this.id })
            .orderBy("position", "id");
        return await Playlist.hydrateVideos(query);
    }

    async getNextVideo(v: Video | null): Promise<Video | undefined> {
        if (!v) {
            return undefined;
        }
        const thisPos = await this.connection
            .select("position")
            .from<VideoRecord>("videos")
            .where({ id: v.id })
            .first();
        if (!thisPos) {
            return undefined;
        }
        const query = this.connection
            .select("*")
            .from<VideoRecord>("videos")
            .where({ playlistID: this.id })
            .andWhere("position", ">", thisPos.position)
            .orderBy("position", "id")
            .limit(1);
        return (await Playlist.hydrateVideos(query))[0];
    }

    async getPrevVideo(v: Video | null): Promise<Video | undefined> {
        if (!v) {
            return undefined;
        }
        const thisPos = await this.connection
            .select("position")
            .from<VideoRecord>("videos")
            .where({ id: v.id })
            .first();
        if (!thisPos) {
            return undefined;
        }
        const query = this.connection
            .select("*")
            .from<VideoRecord>("videos")
            .where({ playlistID: this.id })
            .andWhere("position", "<", thisPos.position)
            .orderBy("position", "desc")
            .limit(1);
        return (await Playlist.hydrateVideos(query))[0];
    }

    async addFromURL(url: string) {
        const providerInfo = getVideoID(url);
        if (!providerInfo.service || !providerInfo.id) {
            throw "url was not parseable by npm package get-video-id";
        }

        const rawVideo: Pick<VideoRecord, "provider" | "src"> = {
            provider: providerInfo.service,
            src: providerInfo.id,
        };
        const {
            durationSeconds: duration,
            title,
            thumbnail,
        } = await Playlist.getVideoMetadata(rawVideo);
        await this.addRawVideo({
            ...rawVideo,
            duration,
            title: title || url,
            thumbnail,
            captions: [],
            playlistID: this.id,
        });
    }

    async addFromFile(
        video: Pick<Video, "src" | "title">,
        thumbnail: Buffer | undefined = undefined,
        captions: Subtitles[] = []
    ) {
        const metadata = await Playlist.getVideoMetadata({
            src: video.src,
            provider: undefined,
        });
        await this.addRawVideo({
            captions,
            ...video,
            duration: metadata.durationSeconds,
            thumbnail: thumbnail || metadata.thumbnail,
            playlistID: this.id,
        });
    }

    async addRawVideo(
        v: Omit<VideoRecord, "id" | "position" | "thumbnailFilename"> & {
            thumbnail: Buffer | undefined;
            captions: Subtitles[];
        }
    ) {
        const existingCount = Number(
            (
                await this.connection
                    .table<VideoRecord>("videos")
                    .count({ count: "*" })
                    .where({ playlistID: this.id })
            )[0].count
        );
        const alreadyHaveVideo = (
            await this.connection
                .table("videos")
                .count({ count: "*" })
                .where("src", v.src)
        )[0].count;
        if (existingCount < 100 || alreadyHaveVideo) {
            if (alreadyHaveVideo) {
                logger.debug("deleting and replacing video with src " + v.src);
                await this.connection.table("videos").where("src", v.src).del();
            } else {
                logger.debug(
                    "playlist has " + existingCount + " videos; adding one more"
                );
            }
            const { thumbnail, captions, ...videoRecord } = v;
            let thumbnailFilename;
            if (thumbnail) {
                thumbnailFilename = await Playlist.saveThumbnail(thumbnail);
            }
            const ids = await this.connection
                .table<VideoRecord>("videos")
                .insert({
                    ...videoRecord,
                    thumbnailFilename,
                    position: existingCount - (alreadyHaveVideo ? 1 : 0),
                });
            if (captions.length) {
                for (const caption of captions) {
                    await this.saveCaptions(ids[0], caption);
                }
            }
            this.broadcastChange();
            const metadata = await this.getMetadata();
            this.connection
                .table<PlaylistRecord>("playlists")
                .update({ version: metadata.version + 0.1 })
                .where({ id: this.id })
                .then(() => {
                    this.broadcastChange();
                });
        }
    }

    async broadcastChange() {
        Playlist.bus.emit("playlist_changed", await this.getSnapshot());
    }

    saveCaptions(videoID: number, caption: Subtitles) {
        return this.connection
            .table<Subtitles & { video: number }>("subtitles")
            .insert({ ...caption, video: videoID });
    }

    static async saveThumbnail(thumbnail: Buffer): Promise<string> {
        const filename = nanoid() + ".jpg";
        await asyncFS.writeFile(
            path.join(this.thumbnailPath, filename),
            thumbnail
        );
        return filename;
    }

    static async getVideoMetadata(
        video: Pick<Video, "src" | "provider">
    ): Promise<{
        durationSeconds: number;
        thumbnail: Buffer | undefined;
        title: string | undefined;
    }> {
        let injectedThumbnail: Buffer | undefined = undefined;
        const injectionSource = path.join(
            Playlist.thumbnailPath,
            "/injected/",
            video.src + ".jpg"
        );
        if (await fileExists(injectionSource)) {
            injectedThumbnail = await asyncFS.readFile(injectionSource);
        }
        if (!video.provider) {
            const location = path.join(__dirname, "../assets/", video.src);
            const subproccess = await execa("ffprobe", [
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                location,
            ]);
            const info = JSON.parse(subproccess.stdout);
            return {
                durationSeconds: Number(info.format.duration),
                thumbnail: injectedThumbnail,
                title: undefined,
            };
        } else if (video.provider == "youtube") {
            const apiCall =
                `https://youtube.googleapis.com/youtube/v3/videos?` +
                `part=contentDetails&part=snippet&id=${video.src}&key=${youtubeAPIKey}`;
            const data = (await (await fetch(apiCall)).json()).items[0];
            const durationString = data.contentDetails.duration as string;
            const comps = Array.from(durationString.matchAll(/\d+[HMS]/g));
            let duration = 0;
            for (const comp of comps) {
                const number = comp[0].slice(0, -1);
                const unit = comp[0].slice(-1);
                duration +=
                    Number(number) *
                    ({ S: 1, M: 60, H: 60 ** 2 }[unit] as number);
            }
            if (isNaN(duration)) {
                throw (
                    "unable to parse youtube duration string: " + durationString
                );
            }
            let thumbnail = injectedThumbnail;
            if (!thumbnail) {
                const thumbs = data.snippet.thumbnails;
                let thumbnailURL;
                if ("standard" in thumbs) {
                    thumbnailURL = thumbs.standard.url;
                } else if ("high" in thumbs) {
                    thumbnailURL = thumbs.high.url;
                } else {
                    thumbnailURL = thumbs[Object.keys(thumbs)[0]].url || "";
                }
                thumbnail = await (await fetch(thumbnailURL)).buffer();
            }
            return {
                durationSeconds: duration,
                title: data.snippet.title,
                thumbnail,
            };
        } else if (video.provider == "vimeo") {
            const apiCall = `http://vimeo.com/api/v2/video/${video.src}.json`;
            const data = await (await fetch(apiCall)).json();
            let thumbnail = injectedThumbnail;
            if (!thumbnail) {
                const thumbnailURL = data[0].thumbnail_large;
                thumbnail = await (await fetch(thumbnailURL)).buffer();
            }
            return {
                durationSeconds: data[0].duration,
                title: data[0].title,
                thumbnail,
            };
        } else if (video.provider == "dailymotion") {
            const apiCall = `https://api.dailymotion.com/video/${video.src}&fields=duration,title,thumbnail_480_url`;
            const data = await (await fetch(apiCall)).json();
            let thumbnail = injectedThumbnail;
            if (!thumbnail) {
                const thumbnailURL = data.thumbnail_480_url;
                thumbnail = await (await fetch(thumbnailURL)).buffer();
            }
            return {
                durationSeconds: data.duration,
                title: data.title,
                thumbnail,
            };
        } else {
            throw "unrecognized video provider";
        }
    }
}

async function addMessage(m: ChatMessage) {
    await streamsDB.table<ChatMessage>("messages").insert(m);
}

async function getRecentMessages(howMany: number = 20): Promise<ChatMessage[]> {
    return (
        await streamsDB
            .table<ChatMessage>("messages")
            .select([
                "isAnnouncement",
                "messageHTML",
                "userID",
                "senderName",
                "senderAvatarURL",
                "createdAt",
            ])
            .orderBy("createdAt", "desc")
            .limit(howMany)
    ).reverse();
}

type UserRecord = Omit<UserSnapshot, "alsoKnownAs"> & { passwordHash: string };
class User {
    id: number;
    // TODO: event bus that advertizes record changes and also, log outs and the
    // new temporary user that any connections that refer to the original user
    // should now refer to

    private constructor(id: number) {
        this.id = id;
    }

    static async createUser(
        user: Omit<UserSnapshot, "id" | "createdAt">
    ): Promise<User> {
        const { alsoKnownAs, ...userRecord } = user;
        const newUser = await streamsDB.table<UserRecord>("users").insert(
            {
                ...userRecord,
                createdAt: Date.now(),
            },
            ["id"]
        );
        if (!newUser.length) {
            throw (
                "Could not create new user from " +
                JSON.stringify(user).substring(0, 1000)
            );
        } else {
            return new User(newUser[0].id);
        }
    }

    static async createAnon(): Promise<User> {
        return await User.createUser({
            watchTime: 0,
            alsoKnownAs: {},
            official: false,
        });
    }

    async exists(): Promise<boolean> {
        return (
            (
                await streamsDB
                    .table<UserRecord>("users")
                    .count("*", { as: "count" })
                    .where({ id: this.id })
                    .limit(1)
            )[0].count > 0
        );
    }

    static async getUserByID(id: number): Promise<User | undefined> {
        const user = new User(id);
        if (await user.exists()) {
            return user;
        } else {
            return undefined;
        }
    }

    static async getUserByToken(token: string): Promise<User | undefined> {
        if (!is<string>(token)) {
            return undefined;
        }
        const userID = await streamsDB
            .table<Token>("tokens")
            .where("token", token)
            .select(["userID"]);
        if (!userID.length) {
            return undefined;
        } else {
            return new User(userID[0].userID);
        }
    }

    static async getUserByLogin(login: {
        email: string;
        password: string;
    }): Promise<User | { error: string }> {
        const user = await streamsDB
            .table<UserRecord>("users")
            .select("passwordHash", "id")
            .where({ email: login.email.toLowerCase() })
            .first();
        if (!user || !user.passwordHash) {
            return { error: "email not found" };
        }
        if (await bcrypt.compare(login.password, user.passwordHash)) {
            return new User(user.id);
        } else {
            return { error: "password incorrect" };
        }
    }

    /**
     * basically for npcs. to avoid conflict with real ids, their ids should be negative
     */
    static async ensureUserIDs(ids: number[]) {
        if (ids.some((i) => i >= 0)) {
            logger.warn(
                "ensureUserIDs being called with potentially real IDs:"
            );
            logger.warn(ids.toString());
        }
        await streamsDB
            .table<UserRecord>("users")
            .insert(
                ids.map((id) => ({ createdAt: Date.now(), watchTime: 0, id })),
                ["id", "createdAt"]
            )
            .onConflict(["id"])
            .ignore();
    }

    async addToken(token?: string): Promise<string> {
        if (!token) {
            token = nanoid();
        }
        await streamsDB
            .table<Token>("tokens")
            .insert({ token, userID: this.id, createdAt: new Date() });
        return token;
    }

    async invalidateToken(token: string) {
        await streamsDB.table<Token>("tokens").where({ token }).delete();
    }

    async getSceneProp(scene: string) {
        const result = await streamsDB
            .table<{ prop: string; userID: number; scene: string }>(
                "usersToProps"
            )
            .where({ userID: this.id, scene: scene })
            .select(["prop"]);
        return result[0]?.prop;
    }

    async saveSceneProp(scene: string, prop: string) {
        await streamsDB
            .table<{ prop: string; userID: number; scene: string }>(
                "usersToProps"
            )
            .insert({ prop, scene, userID: this.id })
            .onConflict(["userID", "scene"])
            .merge();
    }

    async updateChatInfo(chat: { name: string; avatarID: number }) {
        await streamsDB
            .table<UserRecord>("users")
            .update({
                lastAvatarID: chat.avatarID,
                lastUsername: chat.name,
            })
            .where({ id: this.id });
    }

    async addNames(names: Record<string, string>) {
        await Promise.all(
            Object.keys(names).map(async (nameType) => {
                const table = streamsDB<UserName>("names");
                await table
                    .update({ latest: false })
                    .where({ nameType, userID: this.id });
                await table.insert({
                    nameType,
                    name: names[nameType],
                    createdAt: Date.now(),
                    latest: true,
                    userID: this.id,
                });
            })
        );
    }

    async updateLoginCredentials(login: { email: string; password: string }) {
        const passwordHash = await bcrypt.hash(login.password, 10);
        await streamsDB
            .table<UserRecord>("users")
            .update({
                email: login.email.toLowerCase(),
                passwordHash,
            })
            .where({ id: this.id });
    }

    async markOfficial() {
        await streamsDB
            .table<UserRecord>("users")
            .update({
                official: true,
            })
            .where({ id: this.id });
    }

    async getSnapshot(): Promise<UserSnapshot> {
        const user = (await streamsDB
            .table<UserRecord>("users")
            .select("*")
            .where({ id: this.id })
            .first()) as UserRecord;
        user.official = Boolean(user.official);
        const { passwordHash, ...saferUser } = user;
        const names = await streamsDB
            .table<UserName>("names")
            .select("nameType", "name")
            .where({ userID: this.id, latest: true })
            .limit(20);
        const alsoKnownAs: Record<string, string> = {};
        for (const name of names) {
            alsoKnownAs[name.nameType] = name.name;
        }
        return { ...saferUser, alsoKnownAs };
    }

    static async emailTaken(email: string): Promise<boolean> {
        const taken = await streamsDB
            .table<UserRecord>("users")
            .count("*", { as: "count" })
            .where({ email: email.toLowerCase() });
        return taken[0].count > 0;
    }

    async getPublicSnapshot(): Promise<PublicUser> {
        const user = await this.getSnapshot();
        if ("email" in user) {
            delete user.email;
        }
        return user;
    }

    async overwriteSession(token: string) {
        await this.invalidateToken(token);
        const newUser = await User.createAnon();
        const newToken = await newUser.addToken();
        User.bus.emit("invalidate_token", {
            old: { token, user: this },
            new: { token: newToken, user: newUser },
        });
        const newAuth: AuthenticationResult = {
            ...(await newUser.getSnapshot()),
            token: newToken,
        };
        return newAuth;
    }
}

async function getAvatar(id: number): Promise<Avatar | undefined> {
    const avatar = await streamsDB
        .table<Avatar>("avatars")
        .where("id", id)
        .select("*");
    return avatar[0];
}

async function getAllAvatars(): Promise<Avatar[]> {
    return await streamsDB.table<Avatar>("avatars").select("*");
}

declare global {
    namespace Express {
        interface Request {
            user?: User;
            token?: string;
            connectionID?: string;
        }
    }
}

const getUserMiddleware: RequestHandler = async (req, _res, next) => {
    const token = req.header("MB-Token");
    const connectionID = req.header("MB-Connection");
    req.token = is<string>(token) ? token : "";
    req.connectionID = is<string>(connectionID) ? connectionID : "";
    if (req.token) {
        req.user = await User.getUserByToken(req.token);
    }
    next();
};

export {
    Playlist,
    getRecentMessages,
    addMessage,
    User,
    getAvatar,
    getAllAvatars,
    streamsDB,
    getUserMiddleware,
};
