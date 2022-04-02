<template>
    <div id="login-root" v-if="identitySought">
        <template v-if="!identity?.official">
            <div id="login-window">
                <button
                    @click="loginProcess"
                    :disabled="loginWindow && !(loginEmail && loginPassword)"
                    :style="{ top: loginWindow ? '65px' : '10px' }"
                    id="login-button"
                >
                    Log In
                </button>
                <div
                    id="login-form"
                    :style="{ height: loginWindow ? '100px' : '0px' }"
                    :class="{ 'login-form-visible': loginWindow }"
                >
                    <div id="login-form-contents">
                        <label>Email:</label>
                        <input
                            v-model="loginEmail"
                            type="text"
                            ref="loginEmailInput"
                            @keydown.enter="loginProcess"
                        />
                        <label>Password:</label>
                        <input
                            v-model="loginPassword"
                            type="password"
                            @keydown.enter="loginProcess"
                        />
                    </div>
                </div>
                <div v-if="loginStatus" id="login-status">
                    {{ loginStatus }}
                </div>
            </div>
            <button @click="signupModal = true">Make Account</button>
        </template>
        <template v-else>
            <div id="welcome-window">
                <span id="welcome-text" v-if="identity?.lastUsername">
                    Welcome, <em>{{ identity?.lastUsername }}</em>
                </span>
                <button @click="signupModal = true">Edit profile</button>
                <button @click="signOut">Log Out</button>
            </div>
        </template>
        <modal
            id="signup-modal"
            v-if="signupModal"
            @bgClick="signupModal = false"
        >
            <div id="signup-status-container">
                <img src="/images/ibm_pc.svg" />
                <transition name="fade">
                    <div
                        id="signup-status-display"
                        v-if="signupStatus"
                        :key="Math.random()"
                    >
                        {{ signupStatus }}
                    </div>
                </transition>
            </div>
            <div id="signup-basics">
                <label for="make-account-email">Email (can be fake):</label>
                <input
                    type="text"
                    id="make-account-email"
                    v-model="signupEmail"
                    maxLength="254"
                />
                <br />
                <label for="make-account-password"
                    >Password ({{
                        identity?.official
                            ? "if you want to change it"
                            : "important"
                    }}):</label
                >
                <input
                    type="password"
                    id="make-account-password"
                    v-model="signupPassword"
                    maxLength="300"
                />
                <br />
                <label for="make-account-password"
                    >Verify password (sorry):</label
                >
                <input
                    type="password"
                    id="make-account-password"
                    v-model="verifySignupPassword"
                    maxLength="300"
                />
            </div>
            <div id="name-column-container">
                <div class="name-column" v-for="col in names" :key="col[0]">
                    <div
                        v-for="name in col"
                        :key="name.key"
                        class="name-container"
                    >
                        <label
                            :for="name.key + '-input'"
                            :style="{
                                color: String(nameInputs[name.key]).trim()
                                    ? 'black'
                                    : 'gray',
                            }"
                            >{{ name.key }}:</label
                        ><input
                            v-if="name.type != 'option'"
                            :type="name.type"
                            :id="name.key + '-input'"
                            :maxLength="maxNameLength"
                            v-model="nameInputs[name.key]"
                        /><select
                            v-else
                            :id="name.key + '-input'"
                            v-model="nameInputs[name.key]"
                        >
                            <option value="" default />
                            <option
                                v-for="option in name.options"
                                :value="option"
                                :key="option"
                            >
                                {{ option }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>
            <button id="make-account" @click="saveProfile">
                {{ identity?.official ? "Save Changes" : "Make Account" }}
            </button>
        </modal>
    </div>
</template>

<script lang="ts">
import { is } from "typescript-is";
import { defineComponent, PropType, reactive, ref, watch } from "vue";
import { APIPath, endpoints, SigninBody } from "../../constants/endpoints";
import {
    AuthenticationResult,
    PublicUser,
    UserSnapshot,
} from "../../constants/types";
import { processAuthentication, ServerInteractor } from "../serverinteractor";
import modal from "./modal.vue";

export default defineComponent({
    components: { modal },
    props: {
        socket: {
            type: Object as PropType<ServerInteractor>,
            required: false,
        },
    },
    setup(props) {
        const getToken = () => {
            if (props.socket) {
                return props.socket.getGlobal("token") as string | undefined;
            } else {
                return localStorage.getItem("token");
            }
        };
        const identitySought = ref(false);
        const identity = ref<UserSnapshot | undefined>(undefined);
        if (props.socket) {
            // if we are on a page with a live server connection it should have
            // the relevant User loaded for us
            identity.value = props.socket.getGlobal("identity");
            console.log("got identity from server interactor object");
            identitySought.value = true;
        } else {
            // otherwise we have to request it ourselves
            const oldToken = getToken();
            if (oldToken) {
                endpoints[APIPath.getIdentity]
                    .dispatch(oldToken, {})
                    .then((response) => {
                        console.log("got identity manually");
                        console.log(response);
                        if (is<PublicUser>(response)) {
                            identity.value = response;
                        }
                        identitySought.value = true;
                    })
                    .catch(() => {
                        console.log("failed to retrieve identity manually");
                        identitySought.value = true;
                    });
            } else {
                console.log("no basis for obtaining identity present");
                identitySought.value = true;
            }
        }
        // TODO: sort and spread out
        const signupModal = ref(false);
        const loginWindow = ref(false);
        const loginEmail = ref("");
        const loginPassword = ref("");
        const loginStatus = ref("");
        const signupEmail = ref("");
        const signupPassword = ref("");
        const verifySignupPassword = ref("");
        const loginEmailInput = ref<null | HTMLInputElement>(null);
        const loginProcess = async () => {
            if (!loginWindow.value) {
                loginWindow.value = true;
                setTimeout(() => loginEmailInput.value?.focus(), 250);
            } else {
                const login: SigninBody = {
                    email: loginEmail.value,
                    password: loginPassword.value,
                };
                const response = await endpoints[APIPath.signin].dispatch(
                    getToken() || "",
                    login
                );
                if (is<AuthenticationResult>(response)) {
                    processAuthentication(response, props.socket);
                    identity.value = response;
                } else if (is<{ error: string }>(response)) {
                    loginStatus.value = response.error;
                }
            }
        };
        const signupStatus = ref("");
        interface NameField {
            type: "option" | "text" | "number" | "color";
            key: string;
            options?: string[];
        }
        const names: NameField[][] = [
            [
                { type: "text", key: "Nickname" },
                { type: "text", key: "Memoirs" },
                { type: "text", key: "Age" },
                {
                    type: "option",
                    key: "Sobriquet",
                    options: [
                        "The Accursed",
                        "Ducky",
                        "Bonnie Prince Charlie",
                        "The Emperor of Universal Dominion",
                        "Farmer George",
                        "The Huckster King",
                        "He of the Little Dagger",
                        "The Sailor King",
                        "The Scourge of God",
                        "The Universal Spider",
                        "The Nameless One",
                    ],
                },
                {
                    type: "option",
                    key: "Kenning",
                    options: [
                        "Sun's-house",
                        "Serpent's-lair",
                        "Whale-road",
                        "Sea-steed",
                        "Petal-fall",
                        "Ankle-biter",
                        "Bean-counter",
                        "Mountains'-hall",
                    ],
                },
            ],
            [
                { type: "text", key: "Pronouns" },
                { type: "text", key: "Amateur Nouns" },
                { type: "text", key: "Demonym (location)" },
                { type: "color", key: "Favorite color" },
                { type: "number", key: "Social Insecurity #" },
            ],
        ];

        // TODO: this should be computed, from identity
        const nameObj: Record<string, string> = {};
        for (const name of names.flat()) {
            nameObj[name.key] = "";
        }
        const nameInputs = reactive(nameObj);
        watch(identity, (newValue) => {
            if (newValue) {
                let key: keyof typeof newValue.alsoKnownAs;
                for (key in newValue.alsoKnownAs) {
                    nameInputs[key] = newValue.alsoKnownAs[key];
                }
                signupEmail.value = newValue.email || "";
            }
        });

        const maxNameLength = 200;
        const saveProfile = async () => {
            const editing = identity.value?.official;
            if (!editing && !signupEmail.value.trim()) {
                signupStatus.value = "EMAIL is required";
            } else if (signupEmail.value.match(/\s/)) {
                signupStatus.value = "no spaces allowed in EMAIL";
            } else if (signupEmail.value.length > 254) {
                signupStatus.value = "your EMAIL is too long";
            } else if (!editing && !signupPassword.value.trim()) {
                signupStatus.value = "PASSWORD is required";
            } else if (signupPassword.value.length > 300) {
                signupStatus.value = "your PASSWORD is too long. Good Grief";
            } else if (signupPassword.value != verifySignupPassword.value) {
                signupStatus.value =
                    "your PASSWORD verification does not match";
            } else {
                const oldToken = getToken();
                const stringNames = { ...nameInputs };
                for (const nameType in stringNames) {
                    if (!String(stringNames[nameType]).length) {
                        delete stringNames[nameType];
                    } else {
                        stringNames[nameType] = String(stringNames[nameType]);
                    }
                }
                const response = await endpoints[
                    identity.value?.official
                        ? APIPath.editProfile
                        : APIPath.signup
                ].dispatch(oldToken || "", {
                    email: signupEmail.value,
                    password: signupPassword.value,
                    alsoKnownAs: stringNames,
                });
                if (response.error) {
                    signupStatus.value = response.error;
                } else if (is<AuthenticationResult>(response)) {
                    processAuthentication(response, props.socket);
                    identity.value = response;
                    signupModal.value = false;
                    signupStatus.value = "";
                } else {
                    signupStatus.value =
                        "it's unclear what, but something bad happened";
                }
            }
        };
        const signOut = async () => {
            const token = getToken();
            if (!token) {
                throw "attempting to sign out without a token available, somehow";
            }
            const response = await endpoints[APIPath.signout].dispatch(
                token,
                {}
            );
            if (is<AuthenticationResult>(response)) {
                console.log("signed out");
                console.log("given new anon identity:", response);
                processAuthentication(response, props.socket);
                identity.value = response;
            }
        };
        return {
            signupModal,
            identity,
            loginEmail,
            loginPassword,
            loginWindow,
            loginProcess,
            loginEmailInput,
            names,
            nameInputs,
            maxNameLength,
            signupEmail,
            signupPassword,
            verifySignupPassword,
            signupStatus,
            saveProfile,
            signOut,
            loginStatus,
            identitySought,
        };
    },
});
</script>
<style lang="scss" scoped>
button {
    height: 25px;
}
#login-root {
    position: absolute;
    top: 50px;
    right: 50px;
    @media (max-width: 900px) {
        top: 20px;
        right: 10px;
    }
    font-family: Anivers;
}
#login-window {
    position: absolute;
    margin-top: -10px;
    right: 110%;
    width: 180px;
    text-align: right;
    & > button {
        position: absolute;
        right: 10px;
        top: 10px;
    }
    & input {
        width: 100%;
    }
}
#login-form {
    text-align: left;
    overflow: hidden;
    transition: height 0.25s linear;
    background-color: white;
    border-radius: 3px;
    position: relative;
    z-index: 10;
}
.login-form-visible {
    border: 1px solid black;
}
#login-form-contents {
    margin: 5px 70px 5px 5px;
}
#login-button {
    transition: top 0.25s linear;
    z-index: 11;
}
@keyframes slideDown {
    0% {
        transform: translateY(-100%);
    }
    100% {
        transform: translateY(0%);
    }
}
#login-status {
    background-color: white;
    border-radius: 3px;
    border: 1px solid black;
    padding: 5px;
    text-align: center;
    animation: slideDown 0.25s linear;
}
#welcome-window {
    & *:not(:last-child) {
        margin-right: 15px;
    }
}
#welcome-text {
    background-color: white;
    padding: 5px;
    border-radius: 4px;
    border: 1px solid black;
}
#signup-modal {
    & label {
        // margin-bottom: 5px;
        display: inline-block;
        text-align: left;
    }
    & input,
    & select {
        margin-bottom: 5px;
    }
    & p {
        margin: 5px 0;
    }
    width: 70%;
    max-width: 600px;
    @media (max-width: 500px) {
        width: 95%;
        max-width: unset;
    }
    overflow-x: hidden;
    overflow-y: auto;
}
#signup-status-container {
    position: relative;
    width: 60%;
    margin: 0 auto;
    & img {
        width: 100%;
        height: auto;
    }
}
#signup-status-display {
    position: absolute;
    left: 23%;
    top: 6%;
    width: 47%;
    height: 36%;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2em;
    text-shadow: white 1px -1px 8px;
}
#signup-basics {
    width: fit-content;
    margin: 10px auto;
    & label {
        width: 175px;
    }
    & input {
        width: 150px;
    }
}
.name-container {
    display: flex;
    width: 100%;
    justify-content: space-evenly;
}
#name-column-container {
    display: flex;
    width: 100%;
    justify-content: space-evenly;
}
.name-column {
    display: inline-flex;
    flex-direction: column;
    width: 100%;
    & label {
        width: 140px;
    }
    & input,
    & select {
        width: 130px;
        @media (max-width: 500px) {
            width: 140px;
        }
    }
    &:not(:last-of-type) {
        margin-right: 10px;
    }
}
#make-account {
    height: auto;
    margin: 20px 0;
    font-size: 4em;
    font-weight: bold;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 2s cubic-bezier(0.12, 0.77, 0.36, 0.94);
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
