import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("playlist", (table) => {
        table.string("folder").defaultTo("Great Art").index("by_folder");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("playlist", (table) => {
        table.dropColumn("folder");
    });
}
