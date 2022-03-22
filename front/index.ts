import "normalize.css";
import { makeInteractor, processAuthentication } from "./serverinteractor";
import { AuthenticationResult, Video, VideoState } from "../constants/types";
import initVideo from "./video";

const socket = makeInteractor();

const oldToken = localStorage.getItem("token");

// making ourselves known to the server flow:
// establish a secure token so that http requests can be identified as coming
// from the same source as this web-socket
socket.emit("handshake", oldToken ?? ""); // server will respond with `authenticated`

// receive a confirmed/acknowledged/validated token and store it in the
// interactor status so it can use it for HTTP requests later. Also, store it in
// the browser for later handshakes. Also, store the User object with the data
// the server has on us so we can show things like "Welcome, [whoever]"
socket.on("authenticated", async (result: AuthenticationResult) =>
    processAuthentication(result, socket)
);

socket.on("ping", () => {
    socket.emit("pong");
});

window.onerror = (event) => {
    socket.emit("error_report", event.toString() + " - " + new Error().stack);
};

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

initVideo(socket);

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
