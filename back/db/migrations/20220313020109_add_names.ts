import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("names", (table) => {
        table.increments();
        table.string("name").notNullable();
        table.string("nameType").notNullable();
        table.integer("userID").references("id").inTable("users").index();
        table.timestamp("createdAt").notNullable();
        table.boolean("latest").notNullable().defaultTo(true);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("names");
}
