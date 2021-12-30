import fs from "fs";
import path from "path";
import { Playlist, playlist } from "../../queries";

/**
 * Not strictly a database migration but close enough. Goes through each video in
 * the database, gets its thumbnail, and puts it in the right folder with the right
 * filename. Uses Playlist.getVideoMetadata for videos from outside providers; for
 * local files, looks for an existing .jpg file with the same name as the video file
 * and makes a copy with the correct name, leaving the originals in place.
 */
async function addThumbnails() {
    const videos = await playlist.getVideos();
    for (const video of videos) {
        if (video.provider) {
            const { thumbnail } = await Playlist.getVideoMetadata(video);
            if (thumbnail) {
                await Playlist.saveThumbnail(video.id, thumbnail);
            }
        } else {
            const filename = path.parse(video.src).name;
            const thumbnailSource = path.join(
                Playlist.thumbnailPath,
                filename + ".jpg"
            );
            if (fs.existsSync(thumbnailSource)) {
                fs.copyFileSync(
                    thumbnailSource,
                    path.join(Playlist.thumbnailPath, video.id + ".jpg")
                );
            }
        }
    }
}

addThumbnails().then(() => process.exit(0));
