import { Playlist, playlist } from "../queries";

/**
 * Not strictly a database migration but close enough. Goes through each video in
 * the database, gets its thumbnail, and puts it in the right folder with the right
 * filename. Uses Playlist.getVideoMetadata for videos from outside providers; for
 * local files, looks for an existing .jpg file with the same name as the video file
 * and makes a copy with the correct name, leaving the originals in place.
 */
async function ensureMetadata() {
    const videos = await playlist.getVideos();
    for (const video of videos) {
        console.log("updating thumbnail and duration for " + video.title);
        const { thumbnail, durationSeconds: duration } = await Playlist.getVideoMetadata(video);
        if (thumbnail) {
            await Playlist.saveThumbnail(video.id, thumbnail);
        }
        await playlist.connection("playlist").where({ id: video.id })
            .update({ duration });
    }
}

ensureMetadata().then(() => process.exit(0));
