import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("avatars", (table) => {
        table.increments("id");
        table.string("group").notNullable();
        table.string("file").notNullable();
        table.integer("uploaderID").references("id").inTable("users");
        table.string("facing").notNullable();
    });
    await knex.schema.createTable("users", (table) => {
        table.increments("id");
        table.timestamp("createdAt").notNullable();
        table.string("lastUsername");
        table.integer("lastAvatarID").references("id").inTable("avatars");
        table.integer("watchTime").notNullable().defaultTo(0);
        table.string("email");
        table.string("passwordHash");
        table.string("passwordSalt");
    });
    await knex.schema.createTable("tokens", (table) => {
        table.string("token").primary();
        table.timestamp("createdAt").notNullable();
        table.integer("userID").references("id").inTable("users").notNullable();
    });
    await knex.schema.createTable("usersToProps", (table) => {
        table.primary(["user", "scene"]);
        table.integer("user").references("id").inTable("users").notNullable();
        table.string("scene").notNullable();
        table.string("prop").notNullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("usersToProps");
    await knex.schema.dropTableIfExists("avatars");
    await knex.schema.dropTableIfExists("tokens");
    await knex.schema.dropTableIfExists("users");
}
