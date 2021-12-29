import EventEmitter from "events";
import path from "path";

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
 * Simple database table wrapper that also emits a "video_added" event when a new
 * video is successfully added.
 */
class Playlist extends EventEmitter {
    connection: Knex;

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
        return (
            await this.connection
                .select("*")
                .from<Video>("playlist")
                .where({ folder: v.folder })
                .andWhere("id", ">", v.id)
                .limit(1)
        )[0];
    }

    async addFromURL(url: string) {
        const metadata = getVideoID(url);
        if (!metadata.service || !metadata.id) {
            throw new Error(
                "url was not parseable by npm package get-video-id"
            );
        }
        // TODO: unify fetching video title (currently here) and video duration
        // (currently in getVideoDuration) ideally into one API request
        let videoDataURL;
        if (metadata.service == "youtube") {
            videoDataURL = `https://youtube.com/oembed?url=${url}&format=json`;
        } else if (metadata.service == "vimeo") {
            videoDataURL = `https://vimeo.com/api/oembed.json?url=${url}`;
        } else if (metadata.service == "dailymotion") {
            videoDataURL = `https://www.dailymotion.com/services/oembed?url=${url}`;
        } else {
            throw new Error("url was not a vimeo, youtube, or dailymotion url");
        }
        const videoData = await (await fetch(videoDataURL)).json();
        const title = videoData.title;
        const rawVideo: Omit<Video, "id" | "duration"> = {
            provider: metadata.service,
            src: metadata.id,
            title,
            captions: true,
            folder: UserSubmittedFolderName,
        };
        const duration = await Playlist.getVideoDuration(rawVideo);
        await this.addRawVideo({ ...rawVideo, duration });
    }

    async addRawVideo(v: Omit<Video, "id">) {
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
            await this.connection.table<Video>("playlist").insert(v);
            this.emit("video_added");
        }
    }
    /**
     * Gets video length in seconds
     */
    static async getVideoDuration(
        video: Pick<Video, "src" | "provider">
    ): Promise<number> {
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
            return Number(info.format.duration);
        } else if (video.provider == "youtube") {
            const apiCall =
                `https://youtube.googleapis.com/youtube/v3/videos?` +
                `part=contentDetails&id=${video.src}&key=${youtubeAPIKey}`;
            const data = await (await fetch(apiCall)).json();
            const durationString = data.items[0].contentDetails
                .duration as string;
            const comps = Array.from(durationString.matchAll(/\d+/g)).reverse();
            let result = 0;
            let acc = 1;
            for (const comp of comps) {
                result += Number(comp) * acc;
                acc *= 60;
            }
            return result;
        } else if (video.provider == "vimeo") {
            const apiCall = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${video.src}`;
            const data = await (await fetch(apiCall)).json();
            return data.duration;
        } else if (video.provider == "dailymotion") {
            const apiCall = `https://api.dailymotion.com/video/${video.src}&fields=duration`;
            const data = await (await fetch(apiCall)).json();
            return data.duration;
        } else {
            throw new Error("unrecognized video provider");
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
