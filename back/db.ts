import knex from "knex";

import { Video, playlist as initial_playlist } from "./playlist";

const playlistDB = knex({
    client: "sqlite3",
    connection: {
        filename: "./back/playlist.db",
    },
});

async function buildDB() {
    const tableExists = await playlistDB.schema.hasTable("playlist");
    if (!tableExists) {
        console.log("creating table 'playlist'");
        await playlistDB.schema.createTable("playlist", (table) => {
            table.increments();
            table.string("src").notNullable();
            table.string("title").notNullable();
            table.boolean("captions").notNullable();
            table.string("provider"); // only for youtube and vimeo
            table.string("type"); // only for local files
            table.integer("size"); // only for local files
        });
        for (const video of initial_playlist) {
            await playlistDB.table<Video>("playlist").insert(video);
        }
    } else {
        console.log("found table 'playlist'");
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
    await playlistDB.table<Video>("playlist").insert(v);
}

export { getPlaylist, addToPlaylist };
