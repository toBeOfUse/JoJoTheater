import { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
    // Ensures seed entries
    await knex("playlist")
        .insert([
            {
                src: "GU4DJf2_jqE",
                provider: "youtube",
                title: "《双镜 Couple of Mirrors》EP01: 3，2，1",
                captions: true,
                folder: "Couple of Mirrors",
            },
            {
                src: "8zqUunbOsoQ",
                provider: "youtube",
                title: "《双镜 Couple of Mirrors》EP02: In the cold rainy night",
                captions: true,
                folder: "Couple of Mirrors",
            },
            {
                src: "SCp4a42sdWc",
                provider: "youtube",
                title: "《双镜 Couple of Mirrors》EP03: When the gun is fired",
                captions: true,
                folder: "Couple of Mirrors",
            },
            {
                src: "6btkPmu8j9M",
                provider: "youtube",
                title: "《双镜 Couple of Mirrors》EP04: Welcome to My World",
                captions: true,
                folder: "Couple of Mirrors",
            },
            {
                src: "Qx896VPc0LM",
                provider: "youtube",
                title: "《双镜 Couple of Mirrors》EP05: The Scene of the Third Crime",
                captions: true,
                folder: "Couple of Mirrors",
            },
            {
                src: "/videos/tutue1.mp4",
                title: "Princess Tutu S01E01: The Duck and the Prince",
                captions: false,
                type: "video/mp4",
                size: 720,
                folder: "Princess Tutu",
            },
            {
                src: "/videos/tutue2.mp4",
                title: "Princess Tutu S01E02: Pieces of the Heart",
                captions: false,
                type: "video/mp4",
                size: 720,
                folder: "Princess Tutu",
            },
            {
                src: "/videos/tutue03.mp4",
                title: "Princess Tutu S01E03: A Princess's Oath",
                captions: false,
                type: "video/mp4",
                size: 720,
                folder: "Princess Tutu",
            },
            {
                src: "/videos/tutue04.mp4",
                title: "Princess Tutu S01E04: Giselle",
                captions: false,
                type: "video/mp4",
                size: 720,
                folder: "Princess Tutu",
            },
            {
                src: "33548881",
                title: "Girl Walk // All Day: Chapter 5",
                provider: "vimeo",
                captions: false,
                folder: "MitchBot Recommends",
            },
            {
                src: "33560398",
                title: "Girl Walk // All Day: Chapter 6",
                provider: "vimeo",
                captions: false,
                folder: "MitchBot Recommends",
            },
            {
                src: "33807212",
                title: "Girl Walk // All Day: Chapter 7",
                provider: "vimeo",
                captions: false,
                folder: "MitchBot Recommends",
            },
            {
                src: "nBHkIWAJitg",
                title: "Handsome Dancer - Coincidance",
                captions: false,
                provider: "youtube",
                folder: "The Unfiltered Id of the Audience",
            },
            {
                src: "yE5DiniY45w",
                title: "Pop Danthology 2012 - Mashup of 50+ Pop Songs",
                captions: false,
                provider: "youtube",
                folder: "The Unfiltered Id of the Audience",
            },
            {
                src: "3L7VJl76i9U",
                title: "Crybaby Learns to Swim",
                captions: false,
                provider: "youtube",
                folder: "The Unfiltered Id of the Audience",
            },
        ])
        .onConflict()
        .ignore();
}
