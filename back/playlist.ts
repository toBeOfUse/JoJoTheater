interface Video {
    src: string;
    type: string;
    size: number;
    title: string;
}

const playlist: Video[] = [
    {
        src: "/videos/s01e16.mp4",
        title: "Episode 16",
        type: "video/mp4",
        size: 720,
    },
    {
        src: "/videos/s01e17.mp4",
        title: "Episode 17",
        type: "video/mp4",
        size: 720,
    },
    {
        src: "/videos/s01e18.mp4",
        title: "Episode 18",
        type: "video/mp4",
        size: 720,
    },
];

export { Video, playlist };
