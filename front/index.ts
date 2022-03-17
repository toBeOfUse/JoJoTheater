import "normalize.css";
import { makeInteractor } from "./serverinteractor";
import { Video, VideoState } from "../constants/types";
import initVideo from "./video";

const socket = makeInteractor();

const oldToken = localStorage.getItem("token");
if (oldToken) socket.setGlobal("token", oldToken);

socket.emit("log_in", socket.getGlobal("token"));

socket.on("grant_token", (token: string) => {
    socket.setGlobal("token", token);
    localStorage.setItem("token", token);
});
socket.on("ping", () => {
    socket.emit("pong");
});

window.onerror = (event) => {
    socket.emit("error_report", event.toString() + " - " + new Error().stack);
};

initVideo(socket);

socket.on("state_set", (v: VideoState) => {
    socket.setGlobal("currentVideo", v.video || undefined);
});

function renderTitle(v: Video) {
    let title;
    if (v && (title = document.querySelector("#video-title"))) {
        title.innerHTML = v.title;
    }
}

socket.watchGlobal("currentVideo", renderTitle);

const resizeVideoContainer = () => {
    const cont = document.querySelector("#video-container") as HTMLDivElement;
    if (cont && cont.parentElement) {
        const height = window.innerHeight * 0.7;
        const maxWidth = cont.parentElement.offsetWidth;
        const allegedWidth = height * (16 / 9);
        const actualWidth = Math.min(maxWidth, allegedWidth);
        cont.style.height = actualWidth * (9 / 16) + "px";
        cont.style.width = actualWidth + "px";
    }
};

async function loadUIComponents() {
    // load full-page styles
    await import(/* webpackChunkName: "index.scss" */ "./scss/index.scss");
    // dismiss initial heart loading spinner
    document.querySelector("#initial-loading-spinner")?.remove();
    const container = document.querySelector(
        "#container-container"
    ) as HTMLElement;
    container.style.display = "initial";
    // resize video container now that everything that needs to be observed
    // exists
    resizeVideoContainer();
    window.addEventListener("resize", resizeVideoContainer);
    // load all the dynamic vue components
    (
        await import(/*webpackChunkName: "vue-comps"*/ "./vue/vue-index")
    ).loadIndexComps(socket);
}

window.addEventListener("load", loadUIComponents);
