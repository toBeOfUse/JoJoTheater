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
            <button>Log Out</button>
        </template>
        <modal
            style="width: fit-content"
            v-if="signupModal"
            @bgClick="signupModal = false"
        >
            <div style="text-align: left; display: inline">
                <label>Email (can be fake):</label>
                <input type="text" />
                <br />
                <label>Password (important):</label>
                <input type="password" />
            </div>
        </modal>
    </div>
</template>

<script lang="ts">
import { is } from "typescript-is";
import { defineComponent, PropType, ref } from "vue";
import { APIPath, endpoints } from "../../constants/endpoints";
import { User } from "../../constants/types";
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
        const identity = ref<User | undefined>(undefined);
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
                    if (is<User>(response)) {
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
        return {
            signupModal,
            identity,
            loginEmail,
            loginPassword,
            loginWindow,
            loginProcess,
            loginEmailInput,
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
</style>
