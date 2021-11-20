import { Video } from "../types";

const playlist: Video[] = [
    {
        src: "GU4DJf2_jqE",
        provider: "youtube",
        title: "《双镜 Couple of Mirrors》EP01：3，2，1",
        captions: true,
    },
    {
        src: "8zqUunbOsoQ",
        provider: "youtube",
        title: "《双镜 Couple of Mirrors》EP02: In the cold rainy night",
        captions: true,
    },
    {
        src: "SCp4a42sdWc",
        provider: "youtube",
        title: "《双镜 Couple of Mirrors》EP03: When the gun is fired",
        captions: true,
    },
    {
        src: "6btkPmu8j9M",
        provider: "youtube",
        title: "《双镜 Couple of Mirrors》EP04: Welcome to My World",
        captions: true,
    },
    {
        src: "Qx896VPc0LM",
        provider: "youtube",
        title: "《双镜 Couple of Mirrors》EP05: The Scene of the Third Crime",
        captions: true,
    },
    {
        src: "32845443",
        title: "Girl Walk // All Day: Chapter 2",
        provider: "vimeo",
        captions: false,
    },
];

const localPlaylist: Video[] = [
    {
        src: "/videos/vampiresvbronx.mp4",
        title: "Vampires vs. the Bronx (2020)",
        type: "video/mp4",
        size: 1080,
        captions: false,
    },
    {
        src: "/videos/vampiresvbronx.mp4",
        title: "Vampires vs. the Bronx (2020)",
        type: "video/mp4",
        size: 1080,
        captions: false,
    },
    {
        src: "/videos/motherhonksherhorn.mp4",
        title: "Taskmaster S07E08: Mother honks her horn.",
        type: "video/mp4",
        size: 720,
        captions: false,
    },
    {
        src: "/videos/thependulumdrawstheeye.mp4",
        title: "Taskmaster S07E09: The pendulum draws the eye.",
        type: "video/mp4",
        size: 720,
        captions: false,
    },
    {
        src: "/videos/icanhearitgooping.mp4",
        title: "Taskmaster S07E10: I can hear it gooping.",
        type: "video/mp4",
        size: 720,
        captions: false,
    },
];

export { Video, playlist, localPlaylist };
