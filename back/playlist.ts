interface Video {
    src: string;
    type: string;
    size: number;
    title: string;
}

const playlist: Video[] = [
    {
        src: "/videos/catra.mp4",
        title: "Catra Doesn't Like Adora",
        type: "video/mp4",
        size: 720,
    },
];

export { Video, playlist };
