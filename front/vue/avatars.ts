enum Direction {
    left,
    right,
    forward,
}

const { left, right, forward } = Direction;

class Avatar {
    filename: string;
    facing: Direction;
    transparent: boolean;
    constructor(
        filename: string,
        facing: Direction,
        transparent: boolean = false
    ) {
        this.filename = filename;
        this.facing = facing;
        this.transparent = transparent;
    }
    get path() {
        return (
            "/images/avatars/" +
            this.filename +
            (this.transparent ? ".png" : ".jpg")
        );
    }
}

const avatars = [
    // page 1: server emojis
    new Avatar("nymface", right),
    new Avatar("purpleface", right, true),
    new Avatar("yuuri", left),
    new Avatar("coop", forward),
    new Avatar("gayknife", right, true),
    new Avatar("scream", right),
    new Avatar("rosie", left),
    new Avatar("nonut", right),
    new Avatar("strongseal", right),
    new Avatar("fear", right),
    new Avatar("yeehaw", left, true),
    new Avatar("sparklewink", right),
    // page 2: muppets
    new Avatar("kermit", right),
    new Avatar("rowlf", right),
    new Avatar("rizzo", right),
    new Avatar("scrooge", left),
    new Avatar("beaker", left),
    new Avatar("animal", left),
    new Avatar("scrunch", right),
    new Avatar("statler", left),
    new Avatar("waldorf", forward),
    new Avatar("misspiggy", forward),
    new Avatar("gonzo", right),
    new Avatar("timcurry", left),
    // page 3: characters from princess tutu
    new Avatar("ahiru", right),
    new Avatar("anteaterina", right),
    new Avatar("drosselmeyer", forward),
    new Avatar("duck", left),
    new Avatar("edel", forward),
    new Avatar("moon", left),
    new Avatar("fakir", forward),
    new Avatar("mytho", forward),
    new Avatar("neko", forward),
    new Avatar("rue", right),
    new Avatar("shard", left),
    new Avatar("princess", forward),
];

export { avatars };
