import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("users", (table) => {
        table.increments("id");
        table.timestamp("createdAt").notNullable();
        table.string("lastUsername");
        table.string("lastAvatar");
        table.integer("watchTime").notNullable().defaultTo(0);
        table.string("email");
        table.string("passwordHash");
    });
    await knex.schema.createTable("tokens", (table) => {
        table.string("token").primary();
        table.timestamp("createdAt").notNullable();
        table.foreign("user").references("id").inTable("users").notNullable();
    });
    await knex.schema.createTable("rooms", (table) => {
        table.increments("id");
        table.string("name").notNullable();
        table
            .foreign("creator")
            .references("id")
            .inTable("users")
            .notNullable();
        table.integer("watchTime").notNullable().defaultTo(0);
    });
    await knex.schema.createTable("roomsToFolders", (table) => {
        table.primary(["room, folder"]);
        table.foreign("room").references("id").inTable("rooms").notNullable();
        table
            .foreign("playlist")
            .references("folder")
            .inTable("playlist")
            .notNullable();
    });
    await knex.schema.createTable("usersToProps", (table) => {
        table.primary(["user", "scene"]);
        table.foreign("user").references("id").inTable("users").notNullable();
        table.string("scene").notNullable();
        table.string("prop").notNullable();
    });
    await knex.schema.createTable("usersToRooms", (table) => {
        table.primary(["user", "room"]);
        table.foreign("user").references("id").inTable("users").notNullable();
        table.foreign("room").references("id").inTable("rooms").notNullable();
        table.integer("watchTime").notNullable().defaultTo(0);
    });
    await knex.schema.createTable("avatars", (table) => {
        table.increments("id");
        table.string("folder").notNullable();
        table.string("filename").notNullable();
        table.foreign("uploader").references("id").inTable("users");
    });
    await knex.schema.createTable("avatarsToRooms", (table) => {
        table.primary(["room", "avatar"]);
        table.foreign("room").references("id").inTable("rooms").notNullable();
        table
            .foreign("avatar")
            .references("id")
            .inTable("avatars")
            .notNullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("roomsToFolders");
    await knex.schema.dropTableIfExists("usersToProps");
    await knex.schema.dropTableIfExists("usersToRooms");
    await knex.schema.dropTableIfExists("avatarsToRooms");
    await knex.schema.dropTableIfExists("avatars");
    await knex.schema.dropTableIfExists("tokens");
    await knex.schema.dropTableIfExists("rooms");
    await knex.schema.dropTableIfExists("users");
}
