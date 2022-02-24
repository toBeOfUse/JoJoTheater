import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("rooms", (table) => {
        table.increments("id");
        table.string("name").notNullable();
        table
            .foreign("creatorID")
            .references("id")
            .inTable("users")
            .notNullable();
        table.integer("watchTime").notNullable().defaultTo(0);
        table.boolean("locked").notNullable().defaultTo(false);
        table.string("passwordHash");
        table.string("passwordSalt");
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
    await knex.schema.createTable("usersToRooms", (table) => {
        table.primary(["user", "room"]);
        table.foreign("user").references("id").inTable("users").notNullable();
        table.foreign("room").references("id").inTable("rooms").notNullable();
        table.integer("watchTime").notNullable().defaultTo(0);
    });
    await knex.schema.createTable("avatarsToRooms", (table) => {
        table.primary(["room", "avatar"]);
        table.foreign("room").references("id").inTable("rooms").notNullable();
        table
            .foreign("avatarGroup")
            .references("group")
            .inTable("avatars")
            .notNullable();
    });
    await knex.schema.alterTable("messages", (table) => {
        table.foreign("roomID").references("id").inTable("rooms");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("roomsToFolders");
    await knex.schema.dropTableIfExists("usersToRooms");
    await knex.schema.dropTableIfExists("avatarsToRooms");
    await knex.schema.alterTable("messages", (table) => {
        table.dropColumn("roomID");
    });
    await knex.schema.dropTableIfExists("rooms");
}
