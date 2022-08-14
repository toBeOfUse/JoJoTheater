import { renameSync } from "fs";
import { Knex } from "knex";
import { nanoid } from "nanoid";
import path from "path";
import { Video } from "../../../constants/types";
import { Playlist } from "../../queries";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("videos", (table) => {
        table.string("thumbnailFilename");
    });
    const videos = await knex.table<Video>("videos").select("*");
    for (const video of videos) {
        const filename = nanoid() + ".jpg";
        try {
            renameSync(
                path.join(Playlist.thumbnailPath, String(video.id) + ".jpg"),
                path.join(Playlist.thumbnailPath, filename)
            );
            await knex
                .table<Video>("videos")
                .update({ thumbnailFilename: filename })
                .where({ id: video.id });
        } catch {
            console.log("couldn't rename a file for video", video);
        }
    }
    await knex.raw("alter table users drop column passwordSalt;");
    await knex.raw(
        "alter table users add official boolean default 0 not null;"
    );
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("videos", (table) => {
        table.dropColumn("thumbnailFilename");
    });
    await knex.schema.alterTable("users", (table) => {
        table.string("passwordSalt");
    });
}
