type validFlags = "loggedIn";

class GlobalFlags {
    loggedIn: boolean;
    constructor(loggedIn: boolean) {
        this.loggedIn = loggedIn;
    }
    callbacks: Record<string, ((newValue: boolean) => void)[]> = {};
    setFlag(name: validFlags, value: boolean) {
        if (this[name] != value) {
            this[name] = value;
            for (const callback of this.callbacks[name]) {
                callback(value);
            }
        }
    }
    watchFlag(flagName: validFlags, callback: (newValue: boolean) => void) {
        callback(this[flagName]);
        if (flagName in this.callbacks) {
            this.callbacks[flagName].push(callback);
        } else {
            this.callbacks[flagName] = [callback];
        }
    }
}

const flags = new GlobalFlags(false);
const globals = {
    token: "",
};
export { flags, globals };
