import EventEmitter from "events";
import { ChatUserInfo } from "../types";

interface RoomProps {
    folderName: string,
    background: string,
    chairs: string[]
}

const propCollections: Record<string, RoomProps> = {
    basic: {
        background: "background.svg",
        folderName: "basic",
        chairs: ["arm-chair",
            "blue-chair",
            "clawfoot-tub",
            "game-chair",
            "little-car",
            "shopping-cart",
            "tan-chair"]
    }
};

interface RoomInhabitant extends ChatUserInfo {
    typing: boolean;
    lastTypingTimestamp: number;
    chairURL: string;
}

class RoomGraphics extends EventEmitter {
    /**
     * Class that holds all the information needed for rendering the front-end
     * "Audience" component, defined in front/vue/audience.vue. Whenever this
     * information changes, it emits a "change" event; this can be listened for,
     * and when it happens, the server should send a copy of the `inhabitants`
     * property out to all the clients so they can update their Audience
     * components.
     */
    readonly props: RoomProps;
    private chairSequence: string[];
    private usedChairs: number = 0;
    private _inhabitants: RoomInhabitant[] = [];
    get inhabitants() {
        return this._inhabitants;
    }
    constructor(props: RoomProps) {
        super();
        this.props = props;
        this.chairSequence = RoomGraphics.shuffleArray(this.props.chairs);
    }
    static shuffleArray(input: any[]) {
        const array = [...input];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    getPublicPathFor(assetFileName: string) {
        return "/images/rooms/" + this.props.folderName + "/" + assetFileName;
    }
    get background() {
        return this.getPublicPathFor(this.props.background);
    }
    getNewChairURL() {
        const result = this.chairSequence[this.usedChairs];
        this.usedChairs++;
        if (this.usedChairs >= this.chairSequence.length) {
            this.usedChairs = 0;
            this.chairSequence = RoomGraphics.shuffleArray(this.props.chairs);
        }
        return this.getPublicPathFor(result + ".svg");
    }
    addInhabitant(inhabitant: ChatUserInfo) {
        this._inhabitants = [
            { ...inhabitant, typing: false, lastTypingTimestamp: -1, chairURL: this.getNewChairURL() }
        ].concat(this._inhabitants);
        this.emit("change");
    }
    removeInhabitant(userID: string) {
        this._inhabitants = this._inhabitants.filter(i => i.id != userID);
        this.emit("change")
    }
    /**
     * This method will automatically call `stopTyping` if it is not called
     * for five seconds.
     */
    startTyping(userID: string) {
        const typer = this._inhabitants.find(i => i.id == userID);
        if (typer) {
            typer.typing = true;
            typer.lastTypingTimestamp = Date.now();
            this._inhabitants = [
                typer
            ].concat(this._inhabitants.filter(i => i.id != userID));
            this.emit("change");
            setTimeout(() => {
                if (Date.now() - typer.lastTypingTimestamp >= 5000) {
                    this.stopTyping(userID);
                }
            }, 5000);
        }
    }
    /**
     * This only needs to be called externally when an inhabitant sends a
     * message (which naturally should dismiss the typing indicator)
     */
    stopTyping(userID: string) {
        const typer = this._inhabitants.find(i => i.id == userID);
        if (typer && typer.typing) {
            typer.typing = false;
            this.emit("change");
        }
    }
}

export { RoomProps, propCollections, RoomGraphics, RoomInhabitant }
