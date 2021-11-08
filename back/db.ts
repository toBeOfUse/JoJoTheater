import knex from "knex";

import { Video, playlist as initialPlaylist, localPlaylist } from "./playlist";
import logger from "./logger";

const playlistDB = knex({
    client: "sqlite3",
    connection: {
        filename: "./back/playlist.db",
    },
});

async function buildDB() {
    const tableExists = await playlistDB.schema.hasTable("playlist");
    if (!tableExists) {
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

const dbBuilt = buildDB();

async function getPlaylist(): Promise<Video[]> {
    await dbBuilt;
    return await playlistDB
        .select(["src", "title", "captions", "type", "provider", "size"])
        .from<Video>("playlist")
        .orderBy("id");
}

async function addToPlaylist(v: Video) {
    const existingCount = Number(
        (await playlistDB.table("playlist").count({ count: "*" }))[0].count
    );
    logger.debug("playlist has " + existingCount + " videos; adding one more");
    if (existingCount < 100) {
        await playlistDB.table<Video>("playlist").insert(v);
    }
}

export { getPlaylist, addToPlaylist };
