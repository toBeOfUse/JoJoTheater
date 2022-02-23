import EventEmitter from "events";
import path from "path";
import fs from "fs";
import { ChatUserInfo } from "../constants/types";
import logger from "./logger";
import { scenes, Scene } from "../constants/scenes";

interface SceneInhabitant extends ChatUserInfo {
    typing: boolean;
    lastTypingTimestamp: number;
    propsURL: string;
}

interface OutputScene {
    background: string;
    foreground?: string;
    sceneName: string;
    inhabitants: SceneInhabitant[];
    multipleProps: boolean;
}

class SceneController extends EventEmitter {
    /**
     * Class that holds all the information needed for rendering the front-end
     * "Audience" component, defined in front/vue/audience.vue. Whenever this
     * information changes, it emits a "change" event; this can be listened for,
     * and when it happens, the server should send a copy of the `inhabitants`
     * property out to all the clients so they can update their Audience
     * components.
     */
    private scene: Scene;
    private propsSequence: string[];
    private usedProps: number = 0;
    private _inhabitants: SceneInhabitant[] = [];
    get inhabitants() {
        return this._inhabitants;
    }
    constructor(props: Scene) {
        super();
        this.scene = props;
        this.propsSequence = SceneController.shuffleArray(this.scene.props);
    }
    static shuffleArray(input: any[]) {
        const array = [...input];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    static get scenes() {
        return Object.keys(scenes);
    }
    get currentScene() {
        return this.scene.name;
    }
    getPublicPathFor(assetFileName: string) {
        return "/images/scenes/" + this.scene.name + "/" + assetFileName;
    }
    get background() {
        return this.getPublicPathFor(this.scene.background);
    }
    get foreground() {
        if (!this.scene.foreground) {
            return undefined;
        } else {
            return this.getPublicPathFor(this.scene.foreground);
        }
    }
    get outputGraphics(): OutputScene {
        return {
            sceneName: this.currentScene,
            background: this.background,
            foreground: this.foreground,
            inhabitants: this.inhabitants,
            multipleProps: this.scene.props.length > 1,
        };
    }
    getNewPropsURL() {
        const filename = this.propsSequence[this.usedProps];
        this.usedProps++;
        if (this.usedProps >= this.propsSequence.length) {
            this.usedProps = 0;
            this.propsSequence = SceneController.shuffleArray(this.scene.props);
        }
        let publicPath = this.getPublicPathFor(filename + ".svg");
        const localPath = path.resolve(__dirname, "../assets" + publicPath);
        try {
            const stats = fs.statSync(localPath);
            return publicPath + "?v=" + Math.round(stats.mtimeMs);
        } catch {
            logger.error("could not find inhabitant file " + localPath);
            return "";
        }
    }
    static switchedProps(
        oldScene: SceneController,
        to: string | undefined = undefined
    ) {
        if (!to) {
            const availableProps = Object.keys(scenes).filter(
                (c) => scenes[c].name != oldScene.scene.name
            );
            to =
                availableProps[
                    Math.floor(Math.random() * availableProps.length)
                ];
        }
        const newScene = new SceneController(scenes[to]);
        newScene._inhabitants = oldScene._inhabitants.map((i) => ({
            ...i,
            propsURL: newScene.getNewPropsURL(),
        }));
        return newScene;
    }
    addInhabitant(inhabitant: ChatUserInfo) {
        this._inhabitants = [
            {
                ...inhabitant,
                typing: false,
                lastTypingTimestamp: -1,
                propsURL: this.getNewPropsURL(),
            },
        ].concat(this._inhabitants);
        this.emit("change");
    }
    changeInhabitantProps(userID: string) {
        const user = this._inhabitants.find((i) => i.id == userID);
        if (user) {
            user.propsURL = this.getNewPropsURL();
            this.emit("change");
        }
    }
    removeInhabitant(userID: string) {
        this._inhabitants = this._inhabitants.filter((i) => i.id != userID);
        this.emit("change");
    }
    /**
     * This method will automatically call `stopTyping` if it is not called
     * for two seconds.
     */
    startTyping(userID: string) {
        const typer = this._inhabitants.find((i) => i.id == userID);
        if (typer && Date.now() - typer.lastTypingTimestamp > 500) {
            // if they have just started typing - move them to the front of the
            // audience line so that can be seen
            if (!typer.typing) {
                this._inhabitants = [typer].concat(
                    this._inhabitants.filter((i) => i.id != userID)
                );
                typer.typing = true;
                this.emit("change");
            }
            // either way, postpone the typing animation cancel (again)
            typer.lastTypingTimestamp = Date.now();
            setTimeout(() => {
                if (Date.now() - typer.lastTypingTimestamp >= 1900) {
                    this.stopTyping(userID);
                }
            }, 2000);
        }
    }
    /**
     * This only needs to be called externally when an inhabitant sends a
     * message (which naturally should dismiss the typing indicator)
     */
    stopTyping(userID: string) {
        const typer = this._inhabitants.find((i) => i.id == userID);
        if (typer && typer.typing) {
            typer.typing = false;
            this.emit("change");
        }
    }
}

export { Scene, scenes, SceneController, SceneInhabitant, OutputScene };
