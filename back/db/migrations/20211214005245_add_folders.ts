import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    knex.schema.alterTable("playlist", (table) => {
        table.string("folder").defaultTo("Great Art");
    });
}

export async function down(knex: Knex): Promise<void> {
    knex.schema.alterTable("playlist", (table) => {
        table.dropColumn("folder");
    });
}
