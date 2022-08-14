import { Video } from "../../constants/types";
import { Playlist, streamsDB } from "../queries";

/**
 * Not strictly a database migration but close enough. Goes through each video in
 * the database, gets its thumbnail, and puts it in the right folder with the right
 * filename. Uses Playlist.getVideoMetadata for videos from outside providers; for
 * local files, looks for an existing .jpg file with the same name as the video file
 * and makes a copy with the correct name, leaving the originals in place.
 */
async function ensureMetadata() {
    const videos = await streamsDB.table<Video>("videos").select("*");
    for (const video of videos) {
        console.log("updating thumbnail and duration for " + video.title);
        const { thumbnail, durationSeconds: duration } =
            await Playlist.getVideoMetadata(video);
        let thumbnailFilename;
        if (thumbnail) {
            thumbnailFilename = await Playlist.saveThumbnail(thumbnail);
        }
        await streamsDB
            .table<Video>("videos")
            .where({ id: video.id })
            .update({ duration, thumbnailFilename });
    }
}

ensureMetadata().then(() => process.exit(0));
