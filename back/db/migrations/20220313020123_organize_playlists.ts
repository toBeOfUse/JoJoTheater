import { Knex } from "knex";
import { PlaylistRecord, Video } from "../../../constants/types";

/**
 * There are a lot of raw statements here because knex was trying to do
 * complicated things with temporary tables that weren't working, sadly
 */
export async function up(knex: Knex): Promise<void> {
    // create new "playlists" table
    await knex.schema.createTable("playlists", (table) => {
        table.increments();
        table.string("name").notNullable();
        table.string("description");
        table.string("filePhoto");
        table.integer("creatorID").references("id").inTable("users");
        table.timestamp("createdAt").notNullable();
        table.float("version").notNullable().defaultTo(1.0);
        table.boolean("publicallyEditable").notNullable().defaultTo(false);
    });
    await knex.raw("alter table playlist rename to videos;");
    // grab all the old "folders" to be turned into new "playlists"
    const oldFolders = (
        await knex.table<Video>("videos").select("folder").distinct("folder")
    ).map((v) => v.folder);
    // create a new playlist for each old "folder"
    const newFolders: Record<string, number> = {};
    for (const folder of oldFolders) {
        const newID = await knex
            .table<PlaylistRecord>("playlists")
            .insert({
                name: folder,
                description: "",
                createdAt: Date.now(),
            })
            .returning(["id"]);
        newFolders[folder] = newID[0].id;
    }
    await knex.raw(
        "alter table videos add playlistID integer references playlists(id);"
    );
    await knex.raw(
        "alter table videos add position integer default 0 not null;"
    );
    // grab all the videos and fill in the "position" and "playlistID" fields
    const videos = await knex
        .table<Video & { folder: string }>("videos")
        .select("*")
        .orderBy("folder", "id");
    let lastFolder = "";
    let count = 0;
    for (const video of videos) {
        if (video.folder == lastFolder) {
            count += 1;
        } else {
            count = 0;
        }
        lastFolder = video.folder;
        await knex
            .table<Video & { folder: string; position: number }>("videos")
            .where({ id: video.id })
            .update({ playlistID: newFolders[video.folder], position: count });
    }
    await knex.raw("drop index by_folder;");
    await knex.raw("alter table videos drop column folder;");
}

export async function down(knex: Knex): Promise<void> {
    console.log("good luck");
}
