module.exports = {
    development: {
        client: "sqlite3",
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

    production: {
        client: "sqlite3",
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
