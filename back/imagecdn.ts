import type { RequestHandler } from "express";
import path from "path";
import sharp from "sharp";
import sanitizeFilename from "sanitize-filename";
import fs from "fs";
import logger from "./logger";

type Format = "avif" | "webp" | "png" | "jpeg";
function chooseFormat(accept: string | undefined, imagePath: string): Format {
    let type: Format;
    if (accept && accept.includes("image/avif")) {
        type = "avif";
    } else if (accept && accept.includes("image/webp")) {
        type = "webp";
    } else {
        if (imagePath.endsWith(".png")) {
            type = "png";
        } else {
            type = "jpeg";
        }
    }
    return type;
}

/**
 * Handler for requests for optimized images, which go through the endpoint /imgopt.
 * Reads the Accept header of the request to serve the most optimized supported file
 * format. In addition, it takes the following query string parameters:
 *
 * `path` (required): string path to the base image, based on the ./assets/
 * directory. This will have to be URL-encoded on the client side with e. g. the
 * encodeURIComponent function.
 *
 * `width` (required): number denoting the width of the image that the client needs
 * or the string `"max"`. The actual image returned will either have a larger width
 * taken from config.widths or be the same size as the base image.
 *
 * `flip` (optional): if this parameter is set to `"true"`, the returned image will be
 * mirrored horizontally.
 *
 * `ratio` (optional): string in the form `"x:y"` (like `"16:9"`) describing an
 * aspect ratio for the image to be cropped to.
 *
 * Example URL:
 *
 * `/imgopt?path=%2Fimages%2Favatars%2Fkermit.jpg&width=450&flip=true&ratio=1:1`
 *
 */
export default function (
    config: { widths: number[] } = {
        widths: [50, 100, 250, 500, 1000],
    }
): RequestHandler {
    return async (req, res, next) => {
        /**
         * Logs an error, ends the request, and returns true if `check` is false.
         */
        function checkParam(paramName: string, check: boolean) {
            if (!check) {
                let error = `/imgopt error: invalid parameter for ${paramName}: ${req.query[paramName]}. `;
                error += `full request url was ${req.url}`;
                logger.error(error);
                res.status(400);
                res.end();
            }
            return !check;
        }

        if (!req.path.startsWith("/imgopt")) {
            next();
            return;
        }

        if (checkParam("path", typeof req.query.path === "string")) return;
        let imagePath = path.join("./assets/", req.query.path as string);
        const format = chooseFormat(req.headers.accept, imagePath);
        res.setHeader("Content-Type", "image/" + format);
        // TODO: set cache control headers to max caching

        let cacheName = "";
        for (const query in req.query) {
            cacheName += query + "." + req.query[query] + ".";
        }
        cacheName += format;
        cacheName = sanitizeFilename(cacheName);
        const cachePath = path.resolve(__dirname, "../cache/" + cacheName);
        if (fs.existsSync(cachePath)) {
            res.sendFile(cachePath);
            return;
        }

        const imageStats = (await fs.promises
            .stat(imagePath)
            .catch(() => false)) as fs.Stats | false;
        if (!imageStats) {
            // fallback for non-existent thumbnails that... shouldn't... be needed
            // much longer
            if ((req.query.path as string).startsWith("/images/thumbnails/")) {
                const thumbnailFallback = path.join(
                    __dirname,
                    "../assets/images/video-file.svg"
                );
                logger.warn(
                    "missing thumbnail at path: " +
                        req.query.path +
                        " - serving " +
                        thumbnailFallback +
                        " instead"
                );
                res.status(200);
                res.sendFile(thumbnailFallback);
                return;
            } else {
                checkParam("path", false);
                return;
            }
        }

        const requestedWidth =
            req.query.width == "max"
                ? Infinity
                : Number(req.query.width as string);
        if (checkParam("width", !isNaN(requestedWidth))) return;

        // will be clipped to source image width
        let width = config.widths.find((n) => n > requestedWidth) || Infinity;

        let image = sharp(imagePath);
        let imageMeta;
        try {
            imageMeta = await image.metadata();
        } catch {
            logger.error(
                "/imgopt error: file exists, but sharp is unable" +
                    " to get image metadata for the following: " +
                    imagePath +
                    " . full request url was " +
                    req.url
            );
            res.status(500);
            res.end();
            return;
        }
        width = Math.min(imageMeta.width as number, width);
        image = image.resize(width)[format]();

        const flipped = req.query.flip == "true";
        if (flipped) {
            image = image.flop();
        }

        const aspectRatio = req.query.ratio;
        if (aspectRatio) {
            // TODO: enable cropping to smaller aspect ratios as well as larger ones
            const comps = (aspectRatio as string).split(":").map(Number);
            const validity =
                comps.length == 2 && !isNaN(comps[0]) && !isNaN(comps[1]);
            if (checkParam("ratio", validity)) {
                return;
            }
            const height = Math.round(width * (comps[1] / comps[0]));
            image = image.resize({ width, height });
        }
        let result;
        try {
            result = await image.toBuffer();
        } catch {
            logger.error(
                "/imgopt error: sharp unable to produce image " +
                    "in response to the following: " +
                    req.url
            );
            res.status(500);
            res.end();
            return;
        }
        const origKB = imageStats.size / 1024;
        const newKB = result.byteLength / 1024;
        const difference = (origKB - newKB).toFixed(2);
        const percentDifference = ((1 - newKB / origKB) * 100).toFixed(2);
        logger.info(
            `/imgopt shrunk ${origKB.toFixed(2)}kb image ` +
                `by ${difference}kb (${percentDifference}%)`
        );
        res.status(200);
        res.end(result);
        fs.promises.writeFile(cachePath, result).catch((e) => {
            logger.error(e);
            logger.error("unable to write file to " + cachePath);
        });
    };
}
