import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    if (!(await knex.schema.hasTable("messages"))) {
        await knex.schema.createTable("messages", (table) => {
            table.increments();
            table.timestamp("createdAt").notNullable().index("chrono");

            table.boolean("isAnnouncement").notNullable();
            table.string("messageHTML").notNullable();

            // the following are null if isAnnouncement is true:
            table.string("senderID");
            table.string("senderName");
            table.string("senderAvatarURL");
        });
    }
    if (!(await knex.schema.hasTable("playlist"))) {
        await knex.schema.createTable("playlist", (table) => {
            table.increments().index();
            table.string("src").notNullable();
            table.string("title").notNullable();
            table.boolean("captions").notNullable();
            table.string("provider"); // only for youtube and vimeo
            table.string("type"); // only for local files
            table.integer("size"); // only for local files
            table.string("folder").notNullable().index("folders");
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable("playlist");
    await knex.schema.dropTable("messages");
}
