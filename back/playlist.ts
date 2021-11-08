interface Video {
    src: string;
    type?: string; // only for local files
    size?: number; // only for local files
    title: string;
    provider?: string; // only for youtube/vimeo
    captions: boolean;
}

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
        src: "/videos/vampiresvbronx.mp4",
        title: "Vampires Vs. the Bronx (2020)",
        type: "video/mp4",
        size: 1080,
        captions: false,
    },
];

export { Video, playlist };
