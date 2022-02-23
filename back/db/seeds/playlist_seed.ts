import { Knex } from "knex";
import { Video, UserSubmittedFolderName } from "../../../constants/types";

export async function seed(knex: Knex): Promise<void> {
    // Ensures seed entries
    await knex<Video>("playlist")
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
                captions: false,
                provider: "youtube",
                src: "NHZr6P1csiY",
                title: "and the day goes on - bill wurtz",
                folder: "MitchBot Recommends",
            },
            {
                captions: false,
                provider: "youtube",
                src: "mpkf_p71rKY",
                title: "might quit - bill wurtz",
                folder: "MitchBot Recommends",
            },
            {
                src: "nBHkIWAJitg",
                title: "Handsome Dancer - Coincidance",
                captions: false,
                provider: "youtube",
                folder: UserSubmittedFolderName,
            },
            {
                src: "yE5DiniY45w",
                title: "Pop Danthology 2012 - Mashup of 50+ Pop Songs",
                captions: false,
                provider: "youtube",
                folder: UserSubmittedFolderName,
            },
            {
                src: "3L7VJl76i9U",
                title: "Crybaby Learns to Swim",
                captions: false,
                provider: "youtube",
                folder: UserSubmittedFolderName,
            },
            {
                captions: false,
                provider: "youtube",
                src: "4Rr-ra5Sobk",
                title: "small woof",
                folder: UserSubmittedFolderName,
            },
            {
                captions: false,
                provider: "youtube",
                src: "VuE4qxOcluk",
                title: "75 Big Mouth Billy Bass fish sing Bee Gees' 'Stayin Alive,' Talking Heads' 'Once in a Lifetime'",
                folder: UserSubmittedFolderName,
            },
            {
                captions: false,
                provider: "youtube",
                src: "guMbC8Gig6I",
                title: "Taskmaster’s Most Romantic Moments",
                folder: UserSubmittedFolderName,
            },
        ])
        .onConflict()
        .ignore();
}
