import { Knex } from "knex";
import { Video } from "../../../types";
import { Playlist } from "../../queries";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("playlist", (table) => {
        table.integer("duration").defaultTo(-1);
    });
    await knex
        .select("src", "provider", "id", "title")
        .where({ duration: -1 })
        .from<Video>("playlist")
        .then(async (result) => {
            for (const video of result) {
                console.log(
                    `fetching duration for video ${video.title} with src ${video.src}`
                );
                const duration = await Playlist.getVideoDuration(video);
                console.log("it appears to be", duration, "seconds");
                await knex("playlist")
                    .where({ id: video.id })
                    .update({ duration });
            }
        });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("playlist", (table) => {
        table.dropColumn("duration");
    });
}
