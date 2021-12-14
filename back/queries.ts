import knex from "knex";
import logger from "./logger";
import { ChatMessage, Video } from "../types";

const streamsDB = knex({
    client: "sqlite3",
    connection: {
        filename: "./back/db/streams.db",
    },
});

async function getPlaylist(): Promise<Video[]> {
    return await streamsDB
        .select([
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

async function addToPlaylist(v: Video) {
    const existingCount = Number(
        (await streamsDB.table("playlist").count({ count: "*" }))[0].count
    );
    const alreadyHaveVideo = (
        await streamsDB
            .table("playlist")
            .count({ count: "*" })
            .where("src", v.src)
    )[0].count;
    if (existingCount < 100 || alreadyHaveVideo) {
        if (alreadyHaveVideo) {
            logger.debug("deleting and replacing video with src " + v.src);
            await streamsDB.table("playlist").where("src", v.src).del();
        } else {
            logger.debug(
                "playlist has " + existingCount + " videos; adding one more"
            );
        }
        await streamsDB.table<Video>("playlist").insert(v);
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

export { getPlaylist, addToPlaylist, getRecentMessages, addMessage };
