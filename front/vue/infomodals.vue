<template>
    <div id="links-container">
        <span class="link" @click="showing = 'about'">About</span> -
        <span class="link" @click="showing = 'instructions'">Instructions</span>
        -
        <span class="link" @click="showing = 'credits'">Credits</span>
    </div>
    <div id="modal-bg" v-if="showing != ''" @click="showing = ''"></div>
    <div class="modal" v-if="showing == 'about'">
        <h2>About <span class="close" @click="showing = ''">(close)</span></h2>
        <p>
            MitchBot Streams was created by me, Mitch. It aims to be the most
            interesting platform for watching synchronized videos with other
            people over the Internet. It was originally created to watch JoJo
            with Sarah. You can view its source code
            <a-nt href="https://github.com/toBeOfUse/MitchBotStreams">here</a-nt
            >.
        </p>
    </div>
    <div class="modal" v-if="showing == 'instructions'">
        <h2>
            Instructions
            <span class="close" @click="showing = ''">(close)</span>
        </h2>
        <ul style="text-align: left">
            <li>Create or join a room</li>
            <li>Watch Videos!</li>
            <li>Everyone is synced :D</li>
            <li>Sign in through the chat program on the bottom left</li>
            <li>
                Once you sign in, the chat program window is resizeable (grab
                the top and bottom)
            </li>
            <li>
                The window is still visible when the video is fullscreen unless
                it is minimized
            </li>
            <li>Add videos to the last playlist folder</li>
            <li>Search videos with the box below that</li>
            <li>Hold alt and press keys to type the emojis shown below!</li>
        </ul>
        <img
            src="/images/emojikeyboardsmaller.svg"
            style="width: 100%; height: auto"
        />
    </div>
    <div class="modal" v-if="showing == 'credits'">
        <h2>
            Credits <span class="close" @click="showing = ''">(close)</span>
        </h2>
        <p>
            The Windows XP style of the chat window comes from the great
            <a-nt href="https://botoxparty.github.io/XP.css/">XP.css</a-nt>
            library by
            <a-nt href="https://adamham.dev/">Adam Hammad</a-nt>. The main font
            used is the open source
            <a-nt href="https://b612-font.com/">B612</a-nt>, designed for high
            legibility on aircraft cockpit screens.
        </p>
        <p>
            The images for the built-in avatars were sourced from the following
            places which got a full page each: The Garden of Earthly Delights
            (1490 - 1510) by Hieronymus Bosch; Princess Tutu; She-Ra and the
            Princesses of Power; and The Muppet Show and Sesame Street.
        </p>
        <p>
            Then, the various anime dogs and cats are from Nichijou; Soul Eater;
            Totoro; Cowboy Bebop; Inuyasha; Puella Magi Madoka Magica; Sailor
            Moon; Azumanga Daioh; Howl's Moving Castle; Space Dandy; Princess
            Tutu, again; and FLCL.
        </p>
        <p>
            Stock photos of animals, hats, and animals in hats are sourced from
            Unsplash and Canva. Here is a gallery of them, with links to sources
            and authors:
        </p>
        <div class="gallery">
            <div class="thumbnail" v-for="image in sources" :key="image.id">
                <a-nt :href="image.link">
                    <opt-image :path="image.thumbnail" />
                </a-nt>
                <a-nt class="author-link" :href="image.authorURL">{{
                    image.author
                }}</a-nt>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent, ref, watch } from "vue";
import newtablink from "./newtablink.vue";
import optImage from "./image.vue";

export default defineComponent({
    components: {
        "a-nt": newtablink,
        optImage,
    },
    setup() {
        const showing = ref("");
        watch(showing, (newValue) => {
            if (newValue) {
                document
                    .querySelector("body")
                    ?.classList.add("modal-open-page");
            } else {
                document
                    .querySelector("body")
                    ?.classList.remove("modal-open-page");
            }
        });
        enum PhotoPlatforms {
            Unsplash,
            other,
        }
        const { Unsplash, other } = PhotoPlatforms;
        class PhotoSource {
            platform: PhotoPlatforms;
            id: string; // simple ID like p1FX7f-q95g for "Unsplash"; URL for "other"
            author: string;
            authorURL: string;
            thumbnailFileName: string;
            constructor(
                platform: PhotoPlatforms,
                id: string,
                author: string,
                authorURL: string,
                thumbnailFileName: string
            ) {
                this.platform = platform;
                this.id = id;
                this.author = author;
                this.authorURL = authorURL;
                this.thumbnailFileName = thumbnailFileName;
            }
            get link() {
                if (this.platform == Unsplash) {
                    return "https://unsplash.com/photos/" + this.id;
                } else {
                    return this.id;
                }
            }
            get thumbnail() {
                return "/images/credits/" + this.thumbnailFileName;
            }
        }
        const sources = [
            new PhotoSource(
                Unsplash,
                "p1FX7f-q95g",
                "Bayo Adegunloye",
                "https://unsplash.com/@beewhy001",
                "bayo-adegunloye-p1FX7f-q95g-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "AQRp2NH-O8k",
                "Charles Deluvio",
                "https://unsplash.com/@charlesdeluvio",
                "charles-deluvio-AQRp2NH-O8k-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "wp_NHM3abOg",
                "Federico Artusi",
                "https://unsplash.com/@fedeartu",
                "federico-artusi-wp_NHM3abOg-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "6GMq7AGxNbE",
                "Gary Bendig",
                "https://unsplash.com/@kris_ricepees",
                "gary-bendig-6GMq7AGxNbE-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "_QRor5GK3po",
                "Great Pictures",
                "https://unsplash.com/@unsplash21039401",
                "great-pictures-_QRor5GK3po-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "2MUoOXzq57g",
                "Jeremy Hynes",
                "https://unsplash.com/@hyneseyes",
                "jeremy-hynes-2MUoOXzq57g-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "Dt6WXO1BRh8",
                "Jeremy Hynes",
                "https://unsplash.com/@hyneseyes",
                "jeremy-hynes-Dt6WXO1BRh8-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "sNplOG6cYVc",
                "Johnny Briggs",
                "https://unsplash.com/@johnnyboylee",
                "johnny-briggs-sNplOG6cYVc-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "AfBJ2a3P-3g",
                "J-Photos",
                "https://unsplash.com/@jd_photo",
                "j-photos-AfBJ2a3P-3g-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "amTyFteGaRg",
                "Kai Wenzel",
                "https://unsplash.com/@kai_wenzel",
                "kai-wenzel-amTyFteGaRg-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "iJ9o00UeAWk",
                "Liudmyla Denysiuk",
                "https://unsplash.com/@hedgehog90",
                "liudmyla-denysiuk-iJ9o00UeAWk-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "KKoHapK-buU",
                "Lucian Andrei",
                "https://unsplash.com/@n1kkou",
                "lucian-andrei-KKoHapK-buU-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "Kz8bzx_J7NQ",
                "Mehrnegar Dolatmand",
                "https://unsplash.com/@mehrinegarin",
                "mehrnegar-dolatmand-Kz8bzx_J7NQ-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "-dtKoaHpi9M",
                "Nick Fewings",
                "https://unsplash.com/@jannerboy62",
                "nick-fewings--dtKoaHpi9M-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "QnFVTob4HHE",
                "Ondrej Machart",
                "https://unsplash.com/@ondrejmachart",
                "ondrej-machart-QnFVTob4HHE-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "b2jkMC95a_8",
                "Pascal Bernardon",
                "https://unsplash.com/@pbernardon",
                "pascal-bernardon-b2jkMC95a_8-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "CQl3Y5bV6FA",
                "Scott Walsh",
                "https://unsplash.com/@outsighted",
                "scott-walsh-CQl3Y5bV6FA-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "xWswkmfYTzQ",
                "Taylor Friehl",
                "https://unsplash.com/@taylor_friehl",
                "taylor-friehl-xWswkmfYTzQ-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "GvSLkDH7XdI",
                "Vincent van Zalinge",
                "https://unsplash.com/@vincentvanzalinge",
                "vincent-van-zalinge-GvSLkDH7XdI-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "UIz_4PMK8xI",
                "Braden Egli",
                "https://unsplash.com/@bradenegli",
                "braden-egli-UIz_4PMK8xI-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "2tigIl6Tt7E",
                "Everaldo Coelho",
                "https://unsplash.com/@_everaldo",
                "everaldo-coelho-2tigIl6Tt7E-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "-IZ2sgQKIhM",
                "Michael Benz",
                "https://unsplash.com/@michaelbenz",
                "michael-benz--IZ2sgQKIhM-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "ElDn5SmTmB4",
                "Nick van der Ende",
                "https://unsplash.com/@nkend",
                "nick-van-der-ende-ElDn5SmTmB4-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "uWL3al1dom0",
                "Tandem X Visuals",
                "https://unsplash.com/@tandemxvisuals",
                "tandem-x-visuals-uWL3al1dom0-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "wbTapOXJVhU",
                "Florian Lidin",
                "https://unsplash.com/@alieneuh",
                "florian-lidin-wbTapOXJVhU-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "3mTdjARCw7I",
                "Riccardo Chiarini",
                "https://unsplash.com/@riccardoch",
                "riccardo-chiarini-3mTdjARCw7I-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "MlsjteUQFU0",
                "Ken Whytock",
                "https://unsplash.com/@kenwhytock",
                "ken-whytock-MlsjteUQFU0-unsplash.jpg"
            ),
            new PhotoSource(
                Unsplash,
                "EHH9gz2zxes",
                "Jack B",
                "https://unsplash.com/@nervum",
                "jack-b-EHH9gz2zxes-unsplash.jpg"
            ),
        ];
        return { showing, sources };
    },
});
</script>

<style>
.modal-open-page {
    overflow: hidden;
    position: absolute;
}
</style>

<style lang="scss" scoped>
@use "../scss/vars";
* {
    font-family: vars.$pilot-font;
}
#links-container {
    font-size: 1em;
    color: black;
    background-color: #fff;
    padding: 5px 10px;
    border-radius: 3px;
    border: 1px dotted black;
    width: fit-content;
    margin: 10px auto;
}
.link {
    text-decoration: underline;
    cursor: pointer;
}
#modal-bg {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: #fff8;
}
.modal {
    position: fixed;
    width: 50%;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    background-color: white;
    border-radius: 5px;
    border: 1px solid black;
    padding: 10px;
    overflow-y: auto;
    max-height: calc(100% - 100px);
    @media (max-width: 500px) {
        width: 95%;
    }
}
.close {
    font-size: 0.7em;
    text-decoration: underline;
    cursor: pointer;
}
.gallery {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: baseline;
    flex-wrap: wrap;
}
.thumbnail {
    width: 150px;
    height: 100%;
    text-align: center;
    margin: 5px;
    border-radius: 5px;
    border: 1px solid black;
    overflow: hidden;
    font-size: 0.8em;
    & img {
        // max-width: 100%;
        // max-height: 100px;
        width: 100%;
        height: 100px;
        object-fit: cover;
        object-position: center;
        margin: 0 auto;
        display: block;
    }
    & .author-link {
        display: block;
        margin: 2px 0;
        color: black;
    }
    @media (max-width: 500px) {
        width: 100px;
        & img {
            height: 66px;
        }
    }
}
</style>
