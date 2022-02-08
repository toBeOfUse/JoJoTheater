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
            people over the Internet. It is named after a Discord bot (mostly
            unrelated.) It is written in Typescript with Vue as the primary
            front-end library. You can view its source code
            <a href="https://github.com/toBeOfUse/MitchBotStreams">here</a>.
        </p>
    </div>
    <div class="modal" v-if="showing == 'instructions'">
        <h2>
            Instructions
            <span class="close" @click="showing = ''">(close)</span>
        </h2>
        <p>
            Use this website to watch videos. The current video and current time
            within the video will be synchronized between everyone in the
            virtual room. You are not allowed to control the video unless you
            sign in on the chat - click the rightmost button on the little
            minimized chat window on the bottom left of the screen to do that.
        </p>
        <p>
            Once you've signed into the chat, you can also grab the top and
            bottom sides of the window and drag them to make it taller or
            shorter. Clicking anywhere in the chat window will put the cursor in
            the message input box, so don't worry about hitting it too
            precisely. When you make the video fullscreen, if the chat window is
            not minimized, it will still be there, so you can put it in the
            corner and use it like that.
        </p>
        <p>
            You can add videos by pasting Vimeo, Dailymotion, or Youtube URLs
            into the box at the bottom of the "Unrestrained Id of the Audience"
            section of the playlist. The bottom-most section of the playlist
            lets you search; enter words into the text input box and videos that
            match them will appear below it.
        </p>
    </div>
    <div class="modal" v-if="showing == 'credits'">
        <h2>
            Credits <span class="close" @click="showing = ''">(close)</span>
        </h2>
        <p>
            The Windows XP style of the chat window comes from the great
            <a href="https://botoxparty.github.io/XP.css/">XP.css</a> library by
            <a href="https://adamham.dev/">Adam Hammad</a>. The main font used
            is the open source <a href="https://b612-font.com/">B612</a>,
            designed for high legibility on aircraft cockpit screens.
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
                <a :href="image.link"><img :src="image.thumbnail" /></a>
                <a class="author-link" :href="image.authorURL">{{
                    image.author
                }}</a>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { defineComponent, ref, watch } from "vue";

export default defineComponent({
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
                return (
                    "/images/avatars/originals/animals/" +
                    this.thumbnailFileName
                );
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
    margin: 10px auto 5px auto;
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
    width: 70%;
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
