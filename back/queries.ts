import EventEmitter from "events";
import path from "path";
import fs from "fs";

import knex, { Knex } from "knex";
import fetch from "node-fetch";
import execa from "execa";
import getVideoID from "get-video-id";

import logger from "./logger";
import { ChatMessage, Video, UserSubmittedFolderName } from "../types";
import { youtubeAPIKey } from "./secrets";

const streamsDB = knex({
    client: "sqlite3",
    connection: {
        filename: "./back/db/streams.db",
    },
});

/**
 * Database table wrapper that automatically fills in the metadata for any urls or
 * files that you wish to add and also emits a "video_added" event when a new video
 * is successfully added.
 */
class Playlist extends EventEmitter {
    connection: Knex;
    static thumbnailPath = path.join(__dirname, "../assets/images/thumbnails/");

    constructor(dbConnection: Knex) {
        super();
        this.connection = dbConnection;
    }

    async getVideoByID(id: number): Promise<Video | undefined> {
        return (
            await this.connection
                .select("*")
                .from<Video>("playlist")
                .where({ id })
        )[0];
    }

    async getVideos(): Promise<Video[]> {
        return await this.connection
            .select("*")
            .from<Video>("playlist")
            .orderBy("folder", "id");
    }

    async getNextVideo(v: Video | null): Promise<Video | undefined> {
        if (!v) {
            return undefined;
        }
        return await this.connection
            .select("*")
            .from<Video>("playlist")
            .where({ folder: v.folder })
            .andWhere("id", ">", v.id)
            .orderBy("id")
            .first();
    }

    async getPrevVideo(v: Video | null): Promise<Video | undefined> {
        if (!v) {
            return undefined;
        }
        return await this.connection
            .select("*")
            .from<Video>("playlist")
            .where({ folder: v.folder })
            .andWhere("id", "<", v.id)
            .orderBy("id", "desc")
            .first();
    }

    async addFromURL(url: string) {
        const providerInfo = getVideoID(url);
        if (!providerInfo.service || !providerInfo.id) {
            throw "url was not parseable by npm package get-video-id";
        }

        const rawVideo: Omit<Video, "id" | "duration" | "title" | "thumbnail"> =
            {
                provider: providerInfo.service,
                src: providerInfo.id,
                captions: true,
                folder: UserSubmittedFolderName,
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
        });
    }

    async addFromFile(
        video: Pick<Video, "src" | "title" | "folder">,
        thumbnail: Buffer | undefined = undefined
    ) {
        const metadata = await Playlist.getVideoMetadata({
            src: video.src,
            provider: undefined,
        });
        await this.addRawVideo({
            ...video,
            captions: false,
            duration: metadata.durationSeconds,
            thumbnail: thumbnail || metadata.thumbnail,
        });
    }

    async addRawVideo(
        v: Omit<Video, "id"> & { thumbnail: Buffer | undefined }
    ) {
        const existingCount = Number(
            (await this.connection.table("playlist").count({ count: "*" }))[0]
                .count
        );
        const alreadyHaveVideo = (
            await this.connection
                .table("playlist")
                .count({ count: "*" })
                .where("src", v.src)
        )[0].count;
        if (existingCount < 100 || alreadyHaveVideo) {
            if (alreadyHaveVideo) {
                logger.debug("deleting and replacing video with src " + v.src);
                await this.connection
                    .table("playlist")
                    .where("src", v.src)
                    .del();
            } else {
                logger.debug(
                    "playlist has " + existingCount + " videos; adding one more"
                );
            }
            const { thumbnail, ...videoRecord } = v;
            const ids = await this.connection
                .table<Video>("playlist")
                .insert(videoRecord);
            if (thumbnail) {
                Playlist.saveThumbnail(ids[0], thumbnail);
            }
            this.emit("video_added");
        }
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
            const comps = Array.from(durationString.matchAll(/\d+/g)).reverse();
            let duration = 0;
            let acc = 1;
            for (const comp of comps) {
                duration += Number(comp) * acc;
                acc *= 60;
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
    await streamsDB
        .table<ChatMessage & { createdAt: Date }>("messages")
        .insert({ ...m, createdAt: new Date() });
}

async function getRecentMessages(howMany: number = 20): Promise<ChatMessage[]> {
    return (
        await streamsDB
            .table<ChatMessage>("messages")
            .select([
                "isAnnouncement",
                "messageHTML",
                "senderID",
                "senderName",
                "senderAvatarURL",
            ])
            .orderBy("createdAt", "desc")
            .limit(howMany)
    ).reverse();
}

/**
 * Serves as the global singleton playlist object at the moment. Could be divided up
 * into multiple instances of the playlist class later.
 */
const playlist = new Playlist(streamsDB);

export { Playlist, playlist, getRecentMessages, addMessage };
