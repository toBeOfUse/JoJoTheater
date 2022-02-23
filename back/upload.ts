import formidable from "formidable";
import { promises as asyncFS } from "fs";
import path from "path";

import type { RequestHandler } from "express";

import logger from "./logger";
import { playlist } from "./queries";
import { password } from "./secrets";
import { UserSubmittedFolderName } from "../constants/types";

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
                const videoFile = files.video as formidable.File;
                const thumbnailFile = files.thumbnail as formidable.File;
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
                    JSON.stringify({ videoFile, fields }, null, 4)
                );
                if (
                    fields.password == password &&
                    !Array.isArray(fields.folder) &&
                    !Array.isArray(fields.title)
                ) {
                    const filename = path.basename(videoFile.filepath);
                    await asyncFS.rename(
                        videoFile.filepath,
                        path.resolve("./assets/videos/", filename)
                    );
                    await playlist.addFromFile(
                        {
                            src: "/videos/" + videoFile.originalFilename,
                            title:
                                fields.title ||
                                videoFile.originalFilename ||
                                "mystery video",
                            folder: fields.folder || UserSubmittedFolderName,
                        },
                        thumbnail
                    );
                }
            }
            res.end();
        });
    };
    return handler;
}
