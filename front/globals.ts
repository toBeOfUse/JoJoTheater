import { is } from "typescript-is";

interface GlobalValues {
    loggedIn: boolean;
    token: string;
}
class Globals {
    data: GlobalValues = { loggedIn: false, token: "" };
    callbacks: Record<string, ((newValue: any) => void)[]> = {};
    set(name: keyof GlobalValues, value: any) {
        if (this.data[name] != value) {
            const newData = { ...this.data, [name]: value };
            if (is<GlobalValues>(newData)) {
                this.data = newData;
                if (name in this.callbacks) {
                    for (const callback of this.callbacks[name]) {
                        callback(value);
                    }
                }
            } else {
                console.error(
                    "incorrect type for global data item " +
                        name +
                        ": value=" +
                        value
                );
            }
        }
    }
    watch(flagName: keyof GlobalValues, callback: (newValue: any) => void) {
        callback(this.data[flagName]);
        if (flagName in this.callbacks) {
            this.callbacks[flagName].push(callback);
        } else {
            this.callbacks[flagName] = [callback];
        }
    }
    get(flagName: keyof GlobalValues) {
        return this.data[flagName];
    }
}

const globals = new Globals();
export default globals;
