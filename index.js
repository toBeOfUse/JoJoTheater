const player = new Plyr("#video-player", {
    title: "JOJO",
    controls: [
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "captions",
        "fullscreen",
        "settings"
    ],
    settings: ["captions"]
});

player.on("canplaythrough", () => console.log("client can play through"));
player.on("playing", console.log("client has started playing"));
player.on("seeking", () => console.log("client is seeking"));
player.on("seeked", () => {
    console.log("client has seeked");
    console.log("current time is", player.currentTime);
});
player.on("pause", () => console.log("client has paused"));
