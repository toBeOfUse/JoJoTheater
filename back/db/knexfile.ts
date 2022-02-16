import path from "path";
const dbPath = path.resolve(__dirname, "streams.db");

module.exports = {
    development: {
        client: "better-sqlite3",
        connection: {
            filename: dbPath,
        },
        useNullAsDefault: true,
        migrations: {
            tableName: "knex_migrations",
            directory: "./migrations/",
        },
        seed: {
            directory: "./seeds/",
        },
    },

    production: {
        client: "better-sqlite3",
        connection: {
            filename: "./streams.db",
        },
        useNullAsDefault: true,
        migrations: {
            tableName: "knex_migrations",
            directory: "./migrations/",
        },
        seed: {
            directory: "./seeds/",
        },
    },
};
