interface Video {
    src: string;
    type?: string;
    size?: number;
    title: string;
    provider?: string;
}

const playlist: Video[] = [
    {
        src: "/videos/catra.mp4",
        title: "Catra Doesn't Like Adora",
        type: "video/mp4",
        size: 720,
    },
    {
        src: "sYyu5vbwvbA",
        provider: "youtube",
        title: "Moves",
    },
];

export { Video, playlist };
