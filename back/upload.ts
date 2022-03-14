import formidable from "formidable";
import { promises as asyncFS } from "fs";
import path from "path";

import type { RequestHandler } from "express";

import logger from "./logger";
import { password } from "./secrets";
import { Subtitles } from "../constants/types";
import { nanoid } from "nanoid";
import { Playlist } from "./queries";

function getUniqueFilename(nameOrPath: string) {
    const fileext = path.extname(nameOrPath);
    return path.basename(nameOrPath, fileext) + "." + nanoid() + fileext;
}

export default function (options: { maxSizeBytes?: number } = {}) {
    const handler: RequestHandler = (req, res, next) => {
        if (req.url != "/api/upload") {
            next();
            return;
        }
        const form = formidable({
            multiples: true,
            keepExtensions: true,
            maxFileSize: options.maxSizeBytes || 4294967296, // 4gb
        });

        form.on("fileBegin", (_formName, file) => {
            const filePath = path.resolve(
                "./uploads/",
                file.originalFilename ||
                    String(new Date().getTime()) +
                        (file.mimetype?.split("/")[1] || "")
            );
            file.filepath = filePath;
        });

        form.on("file", (_formName, file) => {
            logger.info("received file " + file.filepath);
        });

        form.parse(req, async (err, fields, files) => {
            res.setHeader("Content-Type", "text/plain");
            if (err) {
                res.status(400);
            } else {
                logger.debug("received files:");
                logger.debug(JSON.stringify(files, null, 4));
                const videoFile = files.video as formidable.File;
                const thumbnailFile = files.thumbnail as formidable.File;
                let captionFiles = files.captions;
                let thumbnail;
                if (thumbnailFile) {
                    thumbnail = await asyncFS.readFile(thumbnailFile.filepath);
                }
                res.status(200);
                await asyncFS.writeFile(
                    path.resolve(
                        "./uploads/",
                        videoFile.originalFilename + ".meta.json"
                    ),
                    JSON.stringify(
                        { videoFile, fields, thumbnailFile, captionFiles },
                        null,
                        4
                    )
                );
                const playlistID = Number(fields.playlistID);
                if (
                    fields.password == password &&
                    !Array.isArray(fields.folder) &&
                    !Array.isArray(fields.title) &&
                    !isNaN(playlistID)
                ) {
                    const videoFilename = getUniqueFilename(videoFile.filepath);
                    await asyncFS.rename(
                        videoFile.filepath,
                        path.resolve("./assets/videos/", videoFilename)
                    );
                    let subtitles: Subtitles[] = [];
                    if (captionFiles && !Array.isArray(captionFiles)) {
                        captionFiles = [captionFiles];
                    }
                    if (captionFiles && Array.isArray(captionFiles)) {
                        for (const caption of captionFiles) {
                            const newName = getUniqueFilename(caption.filepath);
                            await asyncFS.rename(
                                caption.filepath,
                                path.resolve("./assets/captions/", newName)
                            );
                            subtitles.push({
                                file: newName,
                                format: "vtt",
                                language: "en",
                            });
                        }
                    }
                    const playlist = await Playlist.getByID(playlistID);
                    if (playlist) {
                        await playlist.addFromFile(
                            {
                                src: "/videos/" + videoFilename,
                                title:
                                    fields.title ||
                                    videoFile.originalFilename ||
                                    "mystery video",
                            },
                            thumbnail,
                            subtitles
                        );
                    }
                    if (thumbnailFile && thumbnail) {
                        await asyncFS.unlink(thumbnailFile.filepath);
                    }
                }
            }
            res.end();
        });
    };
    return handler;
}
