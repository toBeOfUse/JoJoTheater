import { Knex } from "knex";
import { User } from "../../../constants/types";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("messages", (table) => {
        table.integer("userID").references("id").inTable("users");
    });
    const connectionIDs = await knex<{ senderID: string }>("messages").distinct(
        ["senderID"]
    );
    for (const connectionID of connectionIDs) {
        const user = await knex<User>("users").insert(
            { createdAt: new Date(), watchTime: 0 },
            ["id"]
        );
        await knex("messages")
            .where({ senderID: connectionID.senderID })
            .update({ userID: user[0].id });
    }
    await knex.schema.alterTable("messages", (table) => {
        table.dropColumn("senderID");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("messages", (table) => {
        table.dropColumn("userID");
        table.string("senderID"); // obviously not a complete fix...
    });
}
