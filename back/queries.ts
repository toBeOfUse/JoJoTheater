import EventEmitter from "events";
import path from "path";
import fs from "fs";

import knex, { Knex } from "knex";
import fetch from "node-fetch";
import execa from "execa";
import getVideoID from "get-video-id";

import logger from "./logger";
import {
    ChatMessage,
    Video,
    User,
    Token,
    Avatar,
    Subtitles,
    PlaylistRecord,
    PlaylistSnapshot,
} from "../constants/types";
import { youtubeAPIKey } from "./secrets";
import { is } from "typescript-is";

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
 * playlist. TODO: video removal, video re-ordering, metadata changes, and the
 * associated events
 */
class Playlist {
    connection: Knex<any, unknown[]>;
    static thumbnailPath = path.join(__dirname, "../assets/images/thumbnails/");
    record: PlaylistRecord;
    static bus = new EventEmitter();

    get id() {
        return this.record.id;
    }

    constructor(dbConnection: Knex<any, unknown[]>, record: PlaylistRecord) {
        this.connection = dbConnection;
        this.record = record;
    }

    static async getByID(
        id: number,
        dbConnection: Knex<any, unknown[]> = streamsDB
    ): Promise<Playlist | undefined> {
        const record = await dbConnection
            .table<PlaylistRecord>("playlists")
            .select("*")
            .where({ id })
            .first();
        if (!record) {
            return undefined;
        } else {
            return new Playlist(dbConnection, record);
        }
    }

    static async getAll(
        dbConnection: Knex<any, unknown[]> = streamsDB
    ): Promise<Playlist[]> {
        const records = await dbConnection
            .table<PlaylistRecord>("playlists")
            .select("*");
        return records.map((r) => new Playlist(dbConnection, r));
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

    async getSnapshot(): Promise<PlaylistSnapshot> {
        return { ...this.record, videos: await this.getVideos() };
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
        v: Omit<VideoRecord, "id" | "position"> & {
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
            const ids = await this.connection
                .table<VideoRecord>("videos")
                .insert({
                    ...videoRecord,
                    position: existingCount - (alreadyHaveVideo ? 1 : 0),
                });
            if (thumbnail) {
                Playlist.saveThumbnail(ids[0], thumbnail);
            }
            if (captions.length) {
                for (const caption of captions) {
                    await this.saveCaptions(ids[0], caption);
                }
            }
            Playlist.bus.emit("video_added", this.id);
            // TODO: increment version number in .record by 0.1 and update db
            // correspondingly
        }
    }

    saveCaptions(videoID: number, caption: Subtitles) {
        return this.connection
            .table<Subtitles & { video: number }>("subtitles")
            .insert({ ...caption, video: videoID });
    }

    static saveThumbnail(videoID: number, thumbnail: Buffer): Promise<void> {
        return new Promise((resolve, reject) =>
            fs.writeFile(
                path.join(this.thumbnailPath, String(videoID) + ".jpg"),
                thumbnail,
                (err) => {
                    if (err) {
                        logger.error(JSON.stringify(err));
                        reject();
                    } else {
                        resolve();
                    }
                }
            )
        );
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
        if (fs.existsSync(injectionSource)) {
            injectedThumbnail = fs.readFileSync(injectionSource);
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

// TODO: "User" model instead of these atomized functions

async function saveUser(user: Omit<User, "id" | "createdAt">) {
    return (
        await streamsDB
            .table<User>("users")
            .insert(
                {
                    ...user,
                    createdAt: new Date(),
                },
                ["id", "createdAt"]
            )
            .onConflict(["id"])
            .merge()
    )[0];
}

/**
 * basically for npcs
 */
async function ensureUserIDs(ids: number[]) {
    await streamsDB
        .table<User>("users")
        .insert(
            ids.map((id) => ({ createdAt: new Date(), watchTime: 0, id })),
            ["id", "createdAt"]
        )
        .onConflict(["id"])
        .ignore();
}

async function getUser(token: string): Promise<User | undefined> {
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
        return (
            await streamsDB
                .table<User>("users")
                .where("id", userID[0].userID)
                .select("*")
        )[0];
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

async function saveToken(token: Token) {
    await streamsDB.table<Token>("tokens").insert(token);
}

async function getUserSceneProp(
    user: Pick<User, "id">,
    scene: string
): Promise<string | undefined> {
    const result = await streamsDB
        .table<{ prop: string; userID: number; scene: string }>("usersToProps")
        .where({ userID: user.id, scene: scene })
        .select(["prop"]);
    return result[0]?.prop;
}

async function saveUserSceneProp(
    user: Pick<User, "id">,
    scene: string,
    prop: string
) {
    await streamsDB
        .table<{ prop: string; userID: number; scene: string }>("usersToProps")
        .insert({ prop, scene, userID: user.id })
        .onConflict(["userID", "scene"])
        .merge();
}

export {
    Playlist,
    getRecentMessages,
    addMessage,
    saveUser,
    getUser,
    saveToken,
    getAvatar,
    getAllAvatars,
    getUserSceneProp,
    saveUserSceneProp,
    ensureUserIDs,
    streamsDB,
};
