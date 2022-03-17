import { io, Socket } from "socket.io-client";
import { is } from "typescript-is";
import { APIPath, endpoints } from "../constants/endpoints";
import { User, Video } from "../constants/types";

interface SIStatus {
    loggedIn: boolean;
    inChat: boolean;
    token: string;
    currentVideo: Video | undefined;
    identity: User | undefined;
}

type GlobalCallback = (newValue: any) => void;

/**
 * Extends the Socket.io WebSocket interface by adding a store of data about our
 * relationship to the server that can be "watched" and an `http` method that
 * makes get and post requests.
 */
interface ServerInteractor extends Socket {
    _globals: SIStatus;
    _listeners: Record<keyof SIStatus, GlobalCallback[]>;
    setGlobal: (name: string, newValue: any) => void;
    getGlobal: (name: keyof SIStatus) => any;
    watchGlobal: (name: keyof SIStatus, callback: GlobalCallback) => void;
    stopWatchingGlobal: (
        name: keyof SIStatus,
        callback: GlobalCallback
    ) => void;
    http: (
        path: APIPath,
        body?: any,
        headers?: Record<string, string>
    ) => Promise<Record<string, any>>;
}

function makeInteractor() {
    const socket = io() as ServerInteractor;
    socket._globals = {
        loggedIn: false,
        inChat: false,
        token: "",
        currentVideo: undefined,
        identity: undefined,
    };
    socket._listeners = {
        loggedIn: [],
        inChat: [],
        token: [],
        currentVideo: [],
        identity: [],
    };
    socket.setGlobal = function (name, newValue) {
        const newGlobals = { ...this._globals, [name]: newValue };
        if (is<SIStatus>(newGlobals)) {
            this._globals = newGlobals;
            this._listeners[name as keyof SIStatus].forEach((l) => l(newValue));
        }
    };
    socket.getGlobal = function (name) {
        return this._globals[name];
    };
    socket.watchGlobal = function (name, callback) {
        this._listeners[name].push(callback);
    };
    socket.stopWatchingGlobal = function (name, callback) {
        this._listeners[name] = this._listeners[name].filter(
            (l) => l != callback
        );
    };
    socket.http = function (path, body = {}, headers = {}) {
        return endpoints[path].dispatch(this._globals.token, body, headers);
    };
    return socket;
}

export { ServerInteractor, SIStatus as GlobalData, makeInteractor };
