<template>
    <div id="login-root">
        <template v-if="!identity?.email">
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
                        />
                        <label>Password:</label>
                        <input v-model="loginPassword" type="password" />
                    </div>
                </div>
            </div>
            <button @click="signupModal = true">Make Account</button>
        </template>
        <template v-else>
            <span v-if="identity.lastUsername">
                Welcome, <em>{{ identity.lastUsername }}</em>
            </span>
            <button>Edit profile</button>
            <button>Log Out</button>
        </template>
        <modal
            style="
                width: 70%;
                max-width: 600px;
                overflow-x: hidden;
                overflow-y: auto;
            "
            id="signup-modal"
            v-if="signupModal"
            @bgClick="signupModal = false"
        >
            <img src="/images/ibm_pc.svg" />
            <div id="signup-basics">
                <label for="make-account-email">Email (can be fake):</label>
                <input type="text" id="make-account-email" />
                <br />
                <label for="make-account-password">Password (important):</label>
                <input type="password" id="make-account-password" />
            </div>
            <div id="name-column-container">
                <div class="name-column" v-for="col in names" :key="col[0]">
                    <div v-for="name in col" :key="name">
                        <label
                            :for="name + '-input'"
                            :style="{
                                color: String(nameInputs[name]).trim()
                                    ? 'black'
                                    : 'gray',
                            }"
                            >{{ name }}:</label
                        >
                        <input
                            :type="name.endsWith('#') ? 'number' : 'text'"
                            :id="name + '-input'"
                            :maxLength="maxNameLength"
                            v-model="nameInputs[name]"
                        />
                    </div>
                </div>
            </div>
            <button id="make-account">Make Account</button>
        </modal>
    </div>
</template>

<script lang="ts">
import { is } from "typescript-is";
import { defineComponent, PropType, reactive, ref } from "vue";
import { APIPath, endpoints } from "../../constants/endpoints";
import { PublicUser } from "../../constants/types";
import { ServerInteractor } from "../serverinteractor";
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
        const identity = ref<PublicUser | undefined>(undefined);
        if (props.socket) {
            // if we are on a page with a live server connection it should have
            // the relevant User loaded for us
            identity.value = props.socket.getGlobal("identity");
        } else {
            // otherwise we have to request it ourselves
            const oldToken = localStorage.getItem("token");
            endpoints[APIPath.getIdentity]
                .dispatch(oldToken ?? "", {})
                .then((response) => {
                    if (is<PublicUser>(response)) {
                        identity.value = response;
                    }
                });
        }
        const signupModal = ref(false);
        const loginWindow = ref(false);
        const loginEmail = ref("");
        const loginPassword = ref("");
        const loginEmailInput = ref<null | HTMLInputElement>(null);
        const loginProcess = () => {
            if (!loginWindow.value) {
                loginWindow.value = true;
                setTimeout(() => loginEmailInput.value?.focus(), 250);
            } else {
                // send the things in the form to the server
            }
        };
        const names: string[][] = [
            [
                "Nom de plume",
                "Nom de guerre",
                "Alias",
                "Legal name",
                "Illegal name",
                "Pronouns",
                "Antinouns",
                "Byname",
                "Nickname",
            ],
            [
                "Pseudonym",
                "Antonym",
                "Cryptonym",
                "Cognomen",
                "Social Insecurity #",
                "Sobriquet",
                "Epithet",
                "Moniker",
                "Also known as",
            ],
        ];
        const nameObj: Record<string, string> = {};
        for (const name of names.flat()) {
            nameObj[name] = "";
        }
        const nameInputs = reactive(nameObj);
        const maxNameLength = 200;
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
}
.login-form-visible {
    border: 1px solid black;
}
#login-form-contents {
    margin: 5px 70px 5px 5px;
}
#login-button {
    transition: top 0.25s linear;
}
#signup-modal {
    & label {
        margin-bottom: 5px;
        display: inline-block;
        text-align: left;
    }
    & p {
        margin: 5px 0;
    }
    & img {
        width: 60%;
        height: auto;
        margin: 0 auto;
    }
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
#name-column-container {
    display: flex;
    width: 100%;
    justify-content: space-evenly;
}
.name-column {
    display: inline-flex;
    flex-direction: column;
    & label {
        width: 140px;
    }
    & input {
        width: 130px;
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
</style>
