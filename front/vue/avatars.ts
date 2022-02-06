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
    // page 2: animals in hats
    new Avatar("animals/hedgehog.jpg", forward),
    new Avatar("animals/badger.jpg", right),
    new Avatar("animals/bear.jpg", left),
    new Avatar("animals/chipmunk.jpg", left),
    new Avatar("animals/weasel.jpg", right),
    new Avatar("animals/mouse.jpg", forward),
    new Avatar("animals/rabbit.jpg", right),
    new Avatar("animals/fox.jpg", forward),
    new Avatar("animals/doggo.jpg", left),
    new Avatar("animals/kangaroo.jpg", right),
    new Avatar("animals/raccoon.jpg", left),
    new Avatar("animals/squirrel.jpg", right),
    // page 3: anime pets
    new Avatar("anime_pets/sakamoto.jpg", right),
    new Avatar("anime_pets/blair.jpg", left),
    new Avatar("anime_pets/catbus.jpg", left),
    new Avatar("anime_pets/ein.jpg", left),
    new Avatar("anime_pets/kiara.jpg", right),
    new Avatar("anime_pets/kyubey.jpg", forward),
    new Avatar("anime_pets/luna.jpg", right),
    new Avatar("anime_pets/maya.jpg", left),
    new Avatar("anime_pets/heen.jpg", right),
    new Avatar("anime_pets/meow.jpg", left),
    new Avatar("princess_tutu/neko.jpg", forward),
    new Avatar("anime_pets/takkun.jpg", right),
    // page 4: characters from princess tutu
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
    // page 5: garden of earthly delights
    new Avatar("earthly_delights/acrobat.jpg", right),
    new Avatar("earthly_delights/birdman.jpg", right),
    new Avatar("earthly_delights/blueshell.jpg", left),
    new Avatar("earthly_delights/bunnybeak.jpg", right),
    new Avatar("earthly_delights/floppy.jpg", left),
    new Avatar("earthly_delights/merknight.jpg", left),
    new Avatar("earthly_delights/tonguebird.jpg", right),
    new Avatar("earthly_delights/reader.jpg", left),
    new Avatar("earthly_delights/sconc.jpg", right),
    new Avatar("earthly_delights/skater.jpg", right),
    new Avatar("earthly_delights/smoochhog.jpg", left),
    new Avatar("earthly_delights/squawker.jpg", left),
    // page 6: entraptas
    new Avatar("entraptas/1.jpg", left),
    new Avatar("entraptas/2.jpg", left),
    new Avatar("entraptas/3.jpg", forward),
    new Avatar("entraptas/4.jpg", left),
    new Avatar("entraptas/5.jpg", right),
    new Avatar("entraptas/6.jpg", right),
    new Avatar("entraptas/7.jpg", forward),
    new Avatar("entraptas/8.jpg", forward),
    new Avatar("entraptas/9.jpg", right),
    new Avatar("entraptas/10.jpg", right),
    new Avatar("entraptas/11.jpg", forward),
    new Avatar("entraptas/12.jpg", left),
    // page 7: muppets
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
];

export { avatars, Direction };
