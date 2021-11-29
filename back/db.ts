import knex from "knex";

import { playlist as initialPlaylist, localPlaylist } from "./playlist";
import logger from "./logger";
import { ChatMessage, Video } from "../types";

const playlistDB = knex({
    client: "sqlite3",
    connection: {
        filename: "./back/playlist.db",
    },
});

async function buildPlaylistDB() {
    const playlistTableExists = await playlistDB.schema.hasTable("playlist");
    if (!playlistTableExists) {
        logger.debug("creating and populating table 'playlist'");
        await playlistDB.schema.createTable("playlist", (table) => {
            table.increments();
            table.string("src").notNullable();
            table.string("title").notNullable();
            table.boolean("captions").notNullable();
            table.string("provider"); // only for youtube and vimeo
            table.string("type"); // only for local files
            table.integer("size"); // only for local files
        });
        for (const video of initialPlaylist) {
            await playlistDB.table<Video>("playlist").insert(video);
        }
    } else {
        logger.debug("found table 'playlist'");
    }
    // ensure local videos are in the table no matter what, since this is the only
    // place they can be added
    for (const video of localPlaylist) {
        if (
            !Number(
                (
                    await playlistDB
                        .table("playlist")
                        .count({ count: "*" })
                        .where({ src: video.src })
                )[0].count
            )
        ) {
            await playlistDB.table<Video>("playlist").insert(video);
        }
    }
}

const playlistDBBuilt = buildPlaylistDB();

async function getPlaylist(): Promise<Video[]> {
    await playlistDBBuilt;
    return await playlistDB
        .select(["src", "title", "captions", "type", "provider", "size"])
        .from<Video>("playlist")
        .orderBy("id");
}

async function addToPlaylist(v: Video) {
    await playlistDBBuilt;
    const existingCount = Number(
        (await playlistDB.table("playlist").count({ count: "*" }))[0].count
    );
    logger.debug("playlist has " + existingCount + " videos; adding one more");
    if (existingCount < 100) {
        await playlistDB.table<Video>("playlist").insert(v);
    }
}

const messageDB = knex({
    client: "sqlite3",
    connection: {
        filename: "./back/messages.db",
    },
});

async function buildMessagesDB() {
    const messagesTableExists = await messageDB.schema.hasTable("messages");
    if (!messagesTableExists) {
        logger.debug("creating table 'messages'");
        await messageDB.schema.createTable("messages", (table) => {
            table.increments();
            table.timestamp("createdAt").notNullable().index("chrono");

            table.boolean("isAnnouncement").notNullable();
            table.string("messageHTML").notNullable();

            // the following are null if announcement is false:
            table.string("senderID");
            table.string("senderName");
            table.string("senderAvatarURL");
        });
    } else {
        logger.debug("found table 'messages'");
    }
}

const messagesDBBuilt = buildMessagesDB();

async function addMessage(m: ChatMessage) {
    await messagesDBBuilt;
    await messageDB
        .table<ChatMessage & { createdAt: Date }>("messages")
        .insert({ ...m, createdAt: new Date() });
}

async function getRecentMessages(howMany: number = 20): Promise<ChatMessage[]> {
    await messagesDBBuilt;
    return (
        await messageDB
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
