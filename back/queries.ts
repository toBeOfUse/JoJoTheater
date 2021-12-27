import EventEmitter from "events";
import URL from "url";

import knex, { Knex } from "knex";
import fetch from "node-fetch";

import logger from "./logger";
import { ChatMessage, Video, UserSubmittedFolderName } from "../types";

const streamsDB = knex({
    client: "sqlite3",
    connection: {
        filename: "./back/db/streams.db",
    },
});

/**
 * Simple database wrapper that also emits a "video_added" event when a new video is
 * successfully added.
 */
class Playlist extends EventEmitter {
    connection: Knex;
    constructor(dbConnection: Knex) {
        super();
        this.connection = dbConnection;
    }
    async getVideos(): Promise<Video[]> {
        return await this.connection
            .select([
                "id",
                "src",
                "title",
                "captions",
                "type",
                "provider",
                "size",
                "folder",
            ])
            .from<Video>("playlist")
            .orderBy("folder", "id");
    }

    async addFromURL(url: string) {
        new URL.URL(url);
        if (
            !url.toLowerCase().includes("youtube.com") &&
            !url.toLowerCase().includes("vimeo.com")
        ) {
            throw new Error("url was not a vimeo or youtube url");
        }
        let provider, videoDataURL, videoID;
        if (url.toLowerCase().includes("youtube")) {
            provider = "youtube";
            videoDataURL = `https://youtube.com/oembed?url=${url}&format=json`;
            // from https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
            const videoIDMatch = url.match(
                /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/
            );
            if (videoIDMatch && videoIDMatch[1]) {
                videoID = videoIDMatch[1];
            } else {
                throw new Error("could not get video id from " + url);
            }
        } else {
            provider = "vimeo";
            videoDataURL = `https://vimeo.com/api/oembed.json?url=${url}`;
            const uri = new URL.URL(url).pathname;
            const idMatch = uri.match(/\d+$/);
            if (idMatch) {
                videoID = idMatch[0];
            } else {
                throw new Error("could not get video id from " + url);
            }
        }
        const videoData = await (await fetch(videoDataURL)).json();
        const title = videoData.title;
        await this.addRawVideo({
            provider,
            src: videoID,
            title,
            captions: true,
            folder: UserSubmittedFolderName,
        });
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
