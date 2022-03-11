import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("subtitles", (table) => {
        table.increments("id");
        table.string("file").notNullable();
        table
            .integer("video")
            .references("id")
            .inTable("playlist")
            .notNullable();
        table.string("language").defaultTo("en");
        table.string("format").notNullable();
    });
    await knex.schema.alterTable("playlist", (table) => {
        table.dropColumn("size");
        table.dropColumn("type");
        table.dropColumn("captions");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("subtitles");
}
