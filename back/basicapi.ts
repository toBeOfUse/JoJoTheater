import checkDiskSpace from "check-disk-space";
import type { Express } from "express";
import { nanoid } from "nanoid";
import { is } from "typescript-is";

import { APIPath, SigninBody, SignupBody } from "../constants/endpoints";
import logger from "./logger";
import { getUserMiddleware, User } from "./queries";
import { SceneController } from "./scenes";

function initBasicAPI(app: Express) {
    app.get(APIPath.getIdentity, getUserMiddleware, async (req, res) => {
        if (req.user) {
            res.json(await req.user.getSnapshot());
        } else {
            res.status(404);
            res.end();
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
            res.status(400);
            res.end();
            return;
        }
        if (await User.emailTaken(req.body.email)) {
            res.json({ error: "that EMAIL is taken" });
            return;
        }
        if (
            req.body.email.length > 254 ||
            req.body.password.length > 300 ||
            Object.values(req.body.alsoKnownAs).some((n) => n.length > 200) ||
            Object.keys(req.body.alsoKnownAs).some((n) => n.length > 50)
        ) {
            res.status(403);
            res.end();
            return;
        }
        // now that we've ascertained that the request is usable:
        let token = req.header("Auth") as string;
        if (!req.user) {
            req.user = await User.createUser({
                ...req.body,
                watchTime: 0,
                official: true,
            });
            token = await req.user.addToken();
        }
        await req.user.updateLoginCredentials(req.body);
        await req.user.markOfficial();
        await req.user.addNames(req.body.alsoKnownAs);
        res.json({ token, ...(await req.user.getSnapshot()) });
    });
    app.post(APIPath.signin, getUserMiddleware, async (req, res) => {
        // TODO: if there are existing records associated with req.user,
        // optionally reassign them to the newly signed-into user (this will
        // require a new property on the SigninBody interface)
        if (!is<SigninBody>(req.body)) {
            logger.warn(APIPath.signin + " request with malformed body:");
            logger.warn(JSON.stringify(req.body).substring(0, 1000));
            res.status(400);
            res.end();
            return;
        }
        const user = await User.getUserByLogin(req.body);
        if (is<{ error: string }>(user)) {
            res.json(user);
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
        }
        res.end();
    });
}
export default initBasicAPI;
