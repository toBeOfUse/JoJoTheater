import formidable from "formidable";
import { writeFile, renameSync } from "fs";
import path from "path";

import type { Express } from "express";

import logger from "./logger";
import { Playlist, playlist } from "./queries";
import { password } from "./secrets";
import { UserSubmittedFolderName } from "../types";

export default function (app: Express) {
    app.post("/api/upload", (req, res) => {
        const form = formidable({
            multiples: false,
            keepExtensions: true,
            maxFileSize: 4294967296, // 4gb
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
            if (err || Array.isArray(files.file)) {
                res.status(400);
            } else {
                const file = files.file; // sigh
                res.status(200);
                writeFile(
                    path.resolve("./uploads/", file.originalFilename + ".json"),
                    JSON.stringify({ file, fields }, null, 4),
                    () => null
                );
                if (
                    fields.password == password &&
                    !Array.isArray(fields.folder) &&
                    !Array.isArray(fields.title)
                ) {
                    const filename = path.basename(file.filepath);
                    renameSync(
                        file.filepath,
                        path.resolve("./assets/videos/", filename)
                    );
                    const rawVideo = {
                        captions: false,
                        folder: fields.folder || UserSubmittedFolderName,
                        src: "/videos/" + file.originalFilename,
                        title:
                            fields.title ||
                            file.originalFilename ||
                            "mystery video",
                    };
                    const { durationSeconds: duration } =
                        await Playlist.getVideoMetadata(rawVideo);
                    playlist.addRawVideo({
                        ...rawVideo,
                        duration,
                        thumbnail: undefined,
                    });
                }
            }
            res.end();
        });
    });
}
