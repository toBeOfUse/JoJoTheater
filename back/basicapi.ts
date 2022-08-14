import checkDiskSpace from "check-disk-space";
import type { Express } from "express";
import { is } from "typescript-is";

import {
    APIPath,
    EditProfileBody,
    SigninBody,
    SignupBody,
} from "../constants/endpoints";
import logger from "./logger";
import { getUserMiddleware, User } from "./queries";
import { SceneController } from "./scenes";

function initBasicAPI(app: Express) {
    app.get(APIPath.getIdentity, getUserMiddleware, async (req, res) => {
        if (req.user) {
            res.json(await req.user.getSnapshot());
        } else {
            res.status(404).end();
        }
    });
    app.get(APIPath.getFreeSpace, async (_req, res) => {
        res.json(await checkDiskSpace(__dirname));
    });
    app.get(APIPath.getAllScenes, (_req, res) => {
        res.json({
            scenes: SceneController.scenes,
        });
    });
    // these next three should all send json back to the client of type
    // AuthenticationResult
    app.post(APIPath.signup, getUserMiddleware, async (req, res) => {
        if (!is<SignupBody>(req.body)) {
            console.warn(APIPath.signup + " request with malformed body:");
            console.warn(JSON.stringify(req.body).substring(0, 1000));
            res.status(400).end();
            return;
        }
        if (await User.emailTaken(req.body.email)) {
            res.json({ error: "that EMAIL is taken" });
            return;
        }
        // now that we've ascertained that the request is usable:
        let token = req.token;
        if (!req.user) {
            req.user = await User.createUser({
                ...req.body,
                watchTime: 0,
                official: true,
            });
            token = await req.user.addToken();
        }
        try {
            await req.user.updateLoginCredentials(req.body);
            await req.user.addNames(req.body.alsoKnownAs);
        } catch (e) {
            logger.warn(
                "invalid SignupBody submitted: " +
                    JSON.stringify(req.body).substring(0, 1000)
            );
            logger.warn((e as Error).message || String(e));
            res.status(400).end();
            return;
        }
        await req.user.markOfficial();
        res.json({ token, ...(await req.user.getSnapshot()) });
    });
    app.post(APIPath.editProfile, getUserMiddleware, async (req, res) => {
        if (!is<EditProfileBody>(req.body)) {
            logger.warn(APIPath.editProfile + " request with malformed body:");
            logger.warn(JSON.stringify(req.body).substring(0, 1000));
            res.status(400).end();
            return;
        }
        if (!req.user) {
            logger.warn("Attempt to edit profile without being signed in");
            res.status(403).end();
            return;
        }
        try {
            if (req.body.email) {
                const existing = await User.getUserByEmail(req.body.email);
                if (existing && existing.id != req.user.id) {
                    res.json({ error: "that EMAIL is taken" });
                    return;
                }
            }
            await req.user.updateLoginCredentials(req.body);
            if (req.body.alsoKnownAs) {
                await req.user.addNames(req.body.alsoKnownAs);
            }
        } catch (e) {
            logger.warn(
                "invalid EditProfileBody submitted: " +
                    JSON.stringify(req.body).substring(0, 1000)
            );
            logger.warn((e as Error).message || String(e));
            res.status(400).end();
            return;
        }
        res.json({ token: req.token, ...(await req.user.getSnapshot()) });
    });
    app.post(APIPath.signin, getUserMiddleware, async (req, res) => {
        // TODO: if there are existing records associated with req.user,
        // optionally reassign them to the newly signed-into user (this will
        // require a new property on the SigninBody interface)
        if (!is<SigninBody>(req.body)) {
            logger.warn(APIPath.signin + " request with malformed body:");
            logger.warn(JSON.stringify(req.body).substring(0, 1000));
            res.status(400).end();
            return;
        }
        const user = await User.getUserByEmail(req.body.email);
        if (!user) {
            res.json({ error: "that EMAIL was not found" });
            return;
        }
        const authentic = await user.checkPassword(req.body.password);
        if (!authentic) {
            res.json({ error: "that PASSWORD is incorrect" });
            return;
        } else {
            const token = await user.addToken();
            res.json({ ...(await user.getSnapshot()), token });
        }
    });
    app.post(APIPath.signout, getUserMiddleware, async (req, res) => {
        if (req.user && req.token) {
            const oldToken = req.token;
            const newAuth = await req.user.overwriteSession(oldToken);
            res.json(newAuth);
        } else {
            logger.warn("someone trying to sign out without being signed in?");
            res.status(403);
        }
        res.end();
    });
}
export default initBasicAPI;
