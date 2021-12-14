module.exports = {
    development: {
        client: "sqlite3",
        connection: {
            filename: "./playlist.db",
        },
        migrations: {
            tableName: "knex_migrations",
            directory: "./migrations/",
        },
        seed: {
            directory: "./seeds/",
        },
    },

    production: {
        client: "sqlite3",
        connection: {
            filename: "./playlist.db",
        },
        migrations: {
            tableName: "knex_migrations",
            directory: "./migrations/",
        },
        seed: {
            directory: "./seeds/",
        },
    },
};
