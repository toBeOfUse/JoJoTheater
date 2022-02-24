import { Knex } from "knex";
import type { Avatar } from "../../../constants/types";

export async function seed(knex: Knex): Promise<void> {
    await knex<Avatar>("avatars")
        .insert([
            {
                file: "treehouse_emoji/nymface.jpg",
                facing: "right",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/purpleface.png",
                facing: "left",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/yuuri.jpg",
                facing: "left",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/coop.jpg",
                facing: "forward",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/gayknife.png",
                facing: "right",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/scream.jpg",
                facing: "right",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/rosie.jpg",
                facing: "left",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/nonut.jpg",
                facing: "right",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/strongseal.jpg",
                facing: "right",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/fear.jpg",
                facing: "right",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/yeehaw.png",
                facing: "left",
                group: "treehouse emoji",
            },
            {
                file: "treehouse_emoji/sparklewink.jpg",
                facing: "left",
                group: "treehouse emoji",
            },
            {
                file: "animals/hedgehog.jpg",
                facing: "forward",
                group: "animals",
            },
            {
                file: "animals/badger.jpg",
                facing: "right",
                group: "animals",
            },
            {
                file: "animals/bear.jpg",
                facing: "left",
                group: "animals",
            },
            {
                file: "animals/chipmunk.jpg",
                facing: "left",
                group: "animals",
            },
            {
                file: "animals/weasel.jpg",
                facing: "right",
                group: "animals",
            },
            {
                file: "animals/mouse.jpg",
                facing: "forward",
                group: "animals",
            },
            {
                file: "animals/rabbit.jpg",
                facing: "right",
                group: "animals",
            },
            {
                file: "animals/fox.jpg",
                facing: "forward",
                group: "animals",
            },
            {
                file: "animals/doggo.jpg",
                facing: "left",
                group: "animals",
            },
            {
                file: "animals/kangaroo.jpg",
                facing: "right",
                group: "animals",
            },
            {
                file: "animals/raccoon.jpg",
                facing: "left",
                group: "animals",
            },
            {
                file: "animals/squirrel.jpg",
                facing: "right",
                group: "animals",
            },
            {
                file: "anime_pets/sakamoto.jpg",
                facing: "right",
                group: "anime pets",
            },
            {
                file: "anime_pets/blair.jpg",
                facing: "left",
                group: "anime pets",
            },
            {
                file: "anime_pets/catbus.jpg",
                facing: "left",
                group: "anime pets",
            },
            {
                file: "anime_pets/ein.jpg",
                facing: "left",
                group: "anime pets",
            },
            {
                file: "anime_pets/kiara.jpg",
                facing: "right",
                group: "anime pets",
            },
            {
                file: "anime_pets/kyubey.jpg",
                facing: "forward",
                group: "anime pets",
            },
            {
                file: "anime_pets/luna.jpg",
                facing: "right",
                group: "anime pets",
            },
            {
                file: "anime_pets/maya.jpg",
                facing: "left",
                group: "anime pets",
            },
            {
                file: "anime_pets/heen.jpg",
                facing: "right",
                group: "anime pets",
            },
            {
                file: "anime_pets/meow.jpg",
                facing: "left",
                group: "anime pets",
            },
            {
                file: "princess_tutu/neko.jpg",
                facing: "forward",
                group: "princess tutu",
            },
            {
                file: "anime_pets/takkun.jpg",
                facing: "right",
                group: "anime pets",
            },
            {
                file: "princess_tutu/ahiru.jpg",
                facing: "right",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/anteaterina.jpg",
                facing: "right",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/drosselmeyer.jpg",
                facing: "forward",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/duck.jpg",
                facing: "left",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/edel.jpg",
                facing: "forward",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/moon.jpg",
                facing: "left",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/fakir.jpg",
                facing: "forward",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/mytho.jpg",
                facing: "forward",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/neko.jpg",
                facing: "forward",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/rue.jpg",
                facing: "right",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/shard.jpg",
                facing: "left",
                group: "princess tutu",
            },
            {
                file: "princess_tutu/princess.jpg",
                facing: "forward",
                group: "princess tutu",
            },
            {
                file: "earthly_delights/acrobat.jpg",
                facing: "right",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/birdman.jpg",
                facing: "right",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/blueshell.jpg",
                facing: "left",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/bunnybeak.jpg",
                facing: "right",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/floppy.jpg",
                facing: "left",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/merknight.jpg",
                facing: "left",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/tonguebird.jpg",
                facing: "right",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/reader.jpg",
                facing: "left",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/sconc.2.jpg",
                facing: "right",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/lisa.jpg",
                facing: "left",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/smoochhog.jpg",
                facing: "left",
                group: "earthly delights",
            },
            {
                file: "earthly_delights/squawker.jpg",
                facing: "left",
                group: "earthly delights",
            },
            {
                file: "entraptas/1.jpg",
                facing: "left",
                group: "entraptas",
            },
            {
                file: "entraptas/2.jpg",
                facing: "left",
                group: "entraptas",
            },
            {
                file: "entraptas/3.jpg",
                facing: "forward",
                group: "entraptas",
            },
            {
                file: "entraptas/4.jpg",
                facing: "left",
                group: "entraptas",
            },
            {
                file: "entraptas/5.jpg",
                facing: "right",
                group: "entraptas",
            },
            {
                file: "entraptas/6.jpg",
                facing: "right",
                group: "entraptas",
            },
            {
                file: "entraptas/7.jpg",
                facing: "forward",
                group: "entraptas",
            },
            {
                file: "entraptas/8.jpg",
                facing: "forward",
                group: "entraptas",
            },
            {
                file: "entraptas/9.jpg",
                facing: "right",
                group: "entraptas",
            },
            {
                file: "entraptas/10.jpg",
                facing: "right",
                group: "entraptas",
            },
            {
                file: "entraptas/11.jpg",
                facing: "forward",
                group: "entraptas",
            },
            {
                file: "entraptas/12.jpg",
                facing: "left",
                group: "entraptas",
            },
            {
                file: "muppets/kermit.jpg",
                facing: "right",
                group: "muppets",
            },
            {
                file: "muppets/rowlf.jpg",
                facing: "right",
                group: "muppets",
            },
            {
                file: "muppets/rizzo.jpg",
                facing: "right",
                group: "muppets",
            },
            {
                file: "muppets/scrooge.jpg",
                facing: "left",
                group: "muppets",
            },
            {
                file: "muppets/beaker.jpg",
                facing: "left",
                group: "muppets",
            },
            {
                file: "muppets/animal.jpg",
                facing: "left",
                group: "muppets",
            },
            {
                file: "muppets/scrunch.jpg",
                facing: "right",
                group: "muppets",
            },
            {
                file: "muppets/statler.jpg",
                facing: "left",
                group: "muppets",
            },
            {
                file: "muppets/waldorf.jpg",
                facing: "forward",
                group: "muppets",
            },
            {
                file: "muppets/misspiggy.jpg",
                facing: "forward",
                group: "muppets",
            },
            {
                file: "muppets/gonzo.jpg",
                facing: "right",
                group: "muppets",
            },
            {
                file: "muppets/rocco.jpg",
                facing: "forward",
                group: "muppets",
            },
        ])
        .onConflict()
        .ignore();
}
