interface Scene {
    name: string;
    background: string;
    foreground?: string;
    props: string[];
}

const scenes: Record<string, Scene> = {
    basic: {
        background: "background.svg",
        name: "basic",
        props: [
            "arm-chair",
            "blue-chair",
            "clawfoot-tub",
            "game-chair",
            "little-car",
            "shopping-cart",
            "tan-chair",
            "grey-couch",
        ],
    },
    soybeans: {
        name: "soybeans",
        background: "soybeansbg.jpg",
        foreground: "soybeansfg.png",
        props: ["soybeans"],
    },
    waterfront: {
        name: "waterfront",
        background: "waterfrontbg.jpg",
        props: ["ship"],
    },
    trees: {
        name: "trees",
        background: "treesbg.jpg",
        props: ["lift"],
    },
    graveyard: {
        name: "graveyard",
        background: "graveyardbg.jpg",
        props: [
            "curly-ghost",
            "fake-ghost",
            "real-ghost",
            "scared-ghost",
            "short-ghost",
        ],
    },
    lilypads: {
        name: "lilypads",
        background: "frogbg3.jpg",
        props: ["frog"],
    },
    space: {
        name: "space",
        background: "spacebg.jpg",
        props: ["spacesuit", "spacesuit2", "spacesuit3", "spacesuit4"],
    },
    "rock 'n' roll": {
        name: "rock 'n' roll",
        background: "stage.2.jpg",
        props: ["chimes", "drums", "frenchhorn", "guitar", "saxophone"],
    },
};

export { scenes, Scene };
