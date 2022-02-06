enum Direction {
    left,
    right,
    forward,
}

const { left, right, forward } = Direction;

class Avatar {
    filename: string;
    facing: Direction;
    constructor(
        filename: string,
        facing: Direction,
    ) {
        this.filename = filename;
        this.facing = facing;
    }
    get transparent() {
        return this.filename.toLowerCase().endsWith(".png");
    }
    get path() {
        return (
            "/images/avatars/" +
            this.filename
        );
    }
}

const avatars = [
    // pages are 12 images at the moment
    // page 1: server emojis
    new Avatar("treehouse_emoji/nymface.jpg", right),
    new Avatar("treehouse_emoji/purpleface.png", left),
    new Avatar("treehouse_emoji/yuuri.jpg", left),
    new Avatar("treehouse_emoji/coop.jpg", forward),
    new Avatar("treehouse_emoji/gayknife.png", right),
    new Avatar("treehouse_emoji/scream.jpg", right),
    new Avatar("treehouse_emoji/rosie.jpg", left),
    new Avatar("treehouse_emoji/nonut.jpg", right),
    new Avatar("treehouse_emoji/strongseal.jpg", right),
    new Avatar("treehouse_emoji/fear.jpg", right),
    new Avatar("treehouse_emoji/yeehaw.png", left),
    new Avatar("treehouse_emoji/sparklewink.jpg", right),
    // page 2: muppets
    new Avatar("muppets/kermit.jpg", right),
    new Avatar("muppets/rowlf.jpg", right),
    new Avatar("muppets/rizzo.jpg", right),
    new Avatar("muppets/scrooge.jpg", left),
    new Avatar("muppets/beaker.jpg", left),
    new Avatar("muppets/animal.jpg", left),
    new Avatar("muppets/scrunch.jpg", right),
    new Avatar("muppets/statler.jpg", left),
    new Avatar("muppets/waldorf.jpg", forward),
    new Avatar("muppets/misspiggy.jpg", forward),
    new Avatar("muppets/gonzo.jpg", right),
    new Avatar("muppets/timcurry.jpg", left),
    // page 3: characters from princess tutu
    new Avatar("princess_tutu/ahiru.jpg", right),
    new Avatar("princess_tutu/anteaterina.jpg", right),
    new Avatar("princess_tutu/drosselmeyer.jpg", forward),
    new Avatar("princess_tutu/duck.jpg", left),
    new Avatar("princess_tutu/edel.jpg", forward),
    new Avatar("princess_tutu/moon.jpg", left),
    new Avatar("princess_tutu/fakir.jpg", forward),
    new Avatar("princess_tutu/mytho.jpg", forward),
    new Avatar("princess_tutu/neko.jpg", forward),
    new Avatar("princess_tutu/rue.jpg", right),
    new Avatar("princess_tutu/shard.jpg", left),
    new Avatar("princess_tutu/princess.jpg", forward),
];

export { avatars, Direction };
