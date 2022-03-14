import "normalize.css";

import { io } from "socket.io-client";
import { is } from "typescript-is";
import { endpoints } from "../constants/endpoints";

import {
    Video,
    VideoState,
    StreamsSocket,
    ClientGlobalValues as GlobalValues,
} from "../constants/types";
import initVideo from "./video";

const oldToken = localStorage.getItem("token");
const socket = io() as StreamsSocket;
socket._globals = {
    loggedIn: false,
    inChat: false,
    token: oldToken ?? "",
    currentVideo: undefined,
};
socket._listeners = { loggedIn: [], inChat: [], token: [], currentVideo: [] };
socket.setGlobal = function (name, newValue) {
    const newGlobals = { ...this._globals, [name]: newValue };
    if (is<GlobalValues>(newGlobals)) {
        this._globals = newGlobals;
        this._listeners[name as keyof GlobalValues].forEach((l) => l(newValue));
    }
};
socket.getGlobal = function (name) {
    return this._globals[name];
};
socket.watchGlobal = function (name, callback) {
    this._listeners[name].push(callback);
};
socket.stopWatchingGlobal = function (name, callback) {
    this._listeners[name] = this._listeners[name].filter((l) => l != callback);
};
socket.http = function (path, body = {}, headers = {}) {
    return endpoints[path].dispatch(this._globals.token, body, headers);
};

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
