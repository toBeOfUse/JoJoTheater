<template>
    <div
        class="window"
        :class="{ resizable: loggedIn && !minimized, minimized }"
        :style="
            minimized
                ? { left: 0, bottom: 0 }
                : { left: leftPos + 'px', bottom: bottomPos + 'px' }
        "
        id="chat-window"
        @mousedown="pointerDown"
        @touchstart="pointerDown"
        ref="chatWindow"
    >
        <div id="chat-header" class="title-bar" ref="chatHeader">
            <div class="title-bar-text">MitchBot Instant Messenger (MBIM)</div>
            <div class="title-bar-controls">
                <button
                    id="chat-window-minimize"
                    aria-label="Minimize"
                    title="Minimize"
                    @click.stop="minimized = true"
                    @touchstart.stop
                ></button>
                <button
                    id="chat-window-log-out"
                    aria-label="Log Out"
                    title="Log Out"
                    @click.stop="logout"
                    @touchstart.stop
                ></button>
                <button
                    id="chat-window-maximize"
                    aria-label="Maximize"
                    title="Maximize"
                    @click.stop="maximize"
                    @touchstart.stop
                ></button>
            </div>
        </div>
        <div
            id="chat-window-body"
            class="window-body"
            v-if="!minimized"
            :style="!loggedIn ? {} : { height: chatBodyHeight + 'px' }"
        >
            <div id="chat-login" v-if="!loggedIn">
                <label
                    class="prompt"
                    id="avatar-prompt"
                    :class="{
                        'validation-warning': validationWarn == 'avatar',
                    }"
                    @animationEnd="validationWarn = 'none'"
                >
                    Choose your avatar:
                </label>
                <div id="avatar-selection-area">
                    <img
                        class="avatar-page-arrow"
                        :class="{ unavailable: avatarPage == 0 }"
                        @click="changePage(-1)"
                        src="/images/page-change-arrow.svg"
                        style="transform: scaleX(-1)"
                        title="Previous Page"
                    />
                    <div>
                        <div class="avatar-row" v-for="row in 2" :key="row">
                            <img
                                v-for="image in avatarRow(row)"
                                :key="image"
                                class="avatar-option"
                                :class="
                                    image == selectedAvatar ? 'selected' : ''
                                "
                                :src="image"
                                @click="selectedAvatar = image"
                                @dblclick="attemptLogin"
                            />
                        </div>
                    </div>
                    <img
                        class="avatar-page-arrow"
                        :class="{ unavailable: !nextPageAvailable }"
                        @click="changePage(1)"
                        src="/images/page-change-arrow.svg"
                        title="Next Page"
                    />
                </div>
                <section class="field-row" style="margin-top: 5px; width: 100%">
                    <label
                        class="prompt"
                        id="name-prompt"
                        for="chat-name-input"
                        style="flex-shrink: 0"
                        :class="{
                            'validation-warning': validationWarn == 'name',
                        }"
                        @animationend="validationWarn = 'none'"
                    >
                        Enter your name:
                    </label>
                    <input
                        type="text"
                        id="chat-name-input"
                        maxlength="30"
                        style="width: 100%"
                        v-model="nameInput"
                        @keypress.enter="attemptLogin"
                    />
                </section>
                <section
                    class="field-row"
                    style="
                        justify-content: flex-end;
                        margin-top: 2px;
                        width: 100%;
                    "
                >
                    <button @click="attemptLogin" id="user-info-submit">
                        OK
                    </button>
                </section>
            </div>
            <div id="chat-body" v-if="loggedIn">
                <article id="messages" role="tabpanel" ref="messagePanel">
                    <div
                        class="chat-section"
                        v-for="(group, i) in groupedMessages"
                        :key="i"
                    >
                        <div
                            v-if="group[0].isAnnouncement"
                            :key="i"
                            class="announcement"
                            v-html="group[0].messageHTML"
                        ></div>
                        <template v-else>
                            <img
                                class="in-chat-avatar"
                                :src="group[0].senderAvatarURL"
                            />
                            <div class="chat-section-text">
                                <span
                                    class="in-chat-username"
                                    v-html="group[0].senderName"
                                />
                                <div
                                    class="message"
                                    v-for="(message, j) in group"
                                    v-html="message.messageHTML"
                                    :key="j"
                                ></div>
                            </div>
                        </template>
                    </div>
                </article>
                <section class="field-row" id="message-input-row">
                    <input
                        type="text"
                        id="message-input"
                        ref="messageInput"
                        @keydown.enter="send"
                    />
                    <button @click="send" id="send-message">Send</button>
                </section>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ChatMessage, Subscription } from "../../types";
import type { Socket } from "socket.io-client";
import { ref, nextTick, defineComponent, PropType, computed } from "vue";
export default defineComponent({
    props: {
        socket: {
            type: Object as PropType<Socket>,
            required: true,
        },
    },
    setup(props, context) {
        const socket = props.socket;
        // positioning logic:
        const minimized = ref(true);
        const messagePanel = ref<null | HTMLElement>(null);
        function scrollMessagePanelToBottom() {
            if (messagePanel.value) {
                messagePanel.value.scrollTop = messagePanel.value.scrollHeight;
            }
        }
        const chatWindow = ref<null | HTMLElement>(null);
        const chatHeader = ref<null | HTMLElement>(null);
        const leftPos = ref(0);
        const bottomPos = ref(0);
        let lastClientX = 0;
        let lastClientY = 0;
        const MIN_CHAT_BODY_HEIGHT = 160;
        const chatBodyHeight = ref(MIN_CHAT_BODY_HEIGHT);

        const bound = (value: number, min: number, max: number) =>
            Math.min(Math.max(value, min), max);
        const enforceBounds = () => {
            if (!chatWindow.value) return;
            leftPos.value = bound(
                leftPos.value,
                0,
                window.innerWidth - chatWindow.value.offsetWidth
            );
            bottomPos.value = bound(
                bottomPos.value,
                0,
                window.innerHeight - chatWindow.value.offsetHeight
            );
            const maxChatBodyHeight = window.innerHeight * 0.7;
            chatBodyHeight.value = bound(
                chatBodyHeight.value,
                MIN_CHAT_BODY_HEIGHT,
                maxChatBodyHeight
            );
        };
        window.addEventListener("resize", enforceBounds);

        const drag = (event: MouseEvent | TouchEvent) => {
            if (!chatWindow.value) {
                return;
            }
            event.stopPropagation();
            event.preventDefault();
            let newX, newY;
            if (event.type.toLowerCase().startsWith("mouse")) {
                event = event as MouseEvent;
                newX = event.clientX;
                newY = event.clientY;
            } else {
                event = event as TouchEvent;
                const touch = event.touches[0];
                newX = touch.clientX;
                newY = touch.clientY;
            }
            leftPos.value += newX - lastClientX;
            bottomPos.value -= newY - lastClientY;
            enforceBounds();
            lastClientX = newX;
            lastClientY = newY;
        };
        const resize = (event: TouchEvent | MouseEvent) => {
            if (!chatWindow.value || minimized.value || !loggedIn.value) {
                return;
            }
            const newY = (
                event.type.toLowerCase().startsWith("touch")
                    ? (event as TouchEvent).touches[0]
                    : (event as MouseEvent)
            ).clientY;
            const deltaY = lastClientY - newY;
            lastClientY = newY;
            const prevHeight = chatBodyHeight.value;
            chatBodyHeight.value +=
                (currentAction == "resizing_from_bottom" ? -1 : 1) * deltaY;
            enforceBounds();
            const finalDeltaY = prevHeight - chatBodyHeight.value;
            if (currentAction != "resizing_from_top") {
                bottomPos.value += finalDeltaY;
            }
        };
        const RESIZE_AREA_HEIGHT = 10;
        let currentAction:
            | "drag"
            | "resizing_from_top"
            | "resizing_from_bottom"
            | "none" = "none";
        const pointerDown = (event: MouseEvent | TouchEvent) => {
            if (!chatWindow.value || !chatHeader.value || minimized.value)
                return;
            const windowBox = chatWindow.value.getBoundingClientRect();
            const headerBox = chatHeader.value.getBoundingClientRect();
            if (event instanceof MouseEvent) {
                lastClientX = event.clientX;
                lastClientY = event.clientY;
            } else {
                lastClientX = event.touches[0].clientX;
                lastClientY = event.touches[0].clientY;
            }
            const margin = RESIZE_AREA_HEIGHT / 2;
            if (
                lastClientY < windowBox.top + margin &&
                lastClientY > windowBox.top - margin
            ) {
                currentAction = "resizing_from_top";
            } else if (
                lastClientY < windowBox.top + windowBox.height + margin &&
                lastClientY > windowBox.top + windowBox.height - margin
            ) {
                // bottom edge grabbed
                currentAction = "resizing_from_bottom";
            } else if (
                lastClientY > headerBox.top &&
                lastClientY < headerBox.top + headerBox.height
            ) {
                // header grabbed
                currentAction = "drag";
            } else {
                currentAction = "none";
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            let listener;
            if (currentAction == "drag") {
                listener = drag;
            } else {
                listener = resize;
            }
            window.addEventListener("mousemove", listener);
            window.addEventListener("touchmove", listener);
            window.addEventListener("mouseup", pointerUp);
            window.addEventListener("touchend", pointerUp);
            window.addEventListener("touchcancel", pointerUp);
        };
        const pointerUp = () => {
            let listener;
            if (currentAction == "drag") {
                listener = drag;
            } else if (currentAction != "none") {
                listener = resize;
            } else {
                return;
            }
            window.removeEventListener("mousemove", listener);
            window.removeEventListener("touchmove", listener);
            window.removeEventListener("mouseup", pointerUp);
            window.removeEventListener("touchend", pointerUp);
            window.removeEventListener("touchcancel", pointerUp);
            currentAction = "none";
        };

        const maximize = async () => {
            minimized.value = false;
            await nextTick();
            scrollMessagePanelToBottom();
        };

        // login session logic:
        const loggedIn = ref(false);

        const avatars = [
            // server emojis
            "nymface.jpg",
            "purpleface.png",
            "bogchamp.jpg",
            "coop.jpg",
            "gayknife.png",
            "scream.jpg",
            "rosie.jpg",
            "nonut.jpg",
            "strongseal.jpg",
            "fear.jpg",
            "yeehaw.png",
            "sparklewink.jpg",
            // muppets
            "kermit.jpg",
            "rowlf.jpg",
            "rizzo.jpg",
            "scrooge.jpg",
            "beaker.jpg",
            "animal.jpg",
            "scrunch.jpg",
            "statler.jpg",
            "waldorf.jpg",
            "misspiggy.jpg",
            "gonzo.jpg",
            "timcurry.jpg",
            // princess tutu
            "ahiru.jpg",
            "anteaterina.jpg",
            "drosselmeyer.jpg",
            "duck.jpg",
            "edel.jpg",
            "moon.jpg",
            "fakir.jpg",
            "mytho.jpg",
            "neko.jpg",
            "rue.jpg",
            "shard.jpg",
            "princess.jpg",
        ].map((a) => "/images/avatars/" + a);
        const selectedAvatar = ref("");
        const avatarPage = ref(0);
        const avatarsPerRow = 6;
        const rowsPerPage = 2;
        const nextPageAvailable = computed<boolean>(() => {
            return (
                (avatarPage.value + 1) * avatarsPerRow * rowsPerPage <
                avatars.length - 1
            );
        });
        const changePage = (direction: 1 | -1) => {
            if (direction == -1 && avatarPage.value > 0) {
                avatarPage.value -= 1;
            } else if (direction == 1 && nextPageAvailable.value) {
                avatarPage.value += 1;
            }
        };
        const avatarRow = (which: number) => {
            let offset = avatarsPerRow * rowsPerPage * avatarPage.value;
            if (which == 2) offset += avatarsPerRow;
            return avatars.slice(offset, offset + avatarsPerRow);
        };

        const nameInput = ref("");

        // attempt to restore previous chat session
        const loginInfoKey = "loginInfo";
        const lastLoginString = sessionStorage.getItem(loginInfoKey);
        if (lastLoginString) {
            try {
                const lastLogin = JSON.parse(lastLoginString);
                socket.emit("user_info_set", {
                    ...lastLogin,
                    resumed: true,
                });
                if (lastLogin.name) {
                    nameInput.value = lastLogin.name;
                }
                if (lastLogin.avatarURL) {
                    selectedAvatar.value = lastLogin.avatarURL;
                }
            } catch {
                console.log("could not parse previous login info");
            }
        }
        // attempt to start a new chat session
        const validationWarn = ref<"none" | "name" | "avatar">("none");
        const attemptLogin = () => {
            if (
                nameInput.value.trim() &&
                nameInput.value.length < 30 &&
                selectedAvatar.value
            ) {
                const info = {
                    name: nameInput.value,
                    avatarURL: selectedAvatar.value,
                    resumed: false,
                };
                try {
                    sessionStorage.setItem(loginInfoKey, JSON.stringify(info));
                } catch {
                    console.log("could not use session storage");
                }
                socket.emit("user_info_set", info);
            } else {
                if (!selectedAvatar.value) {
                    validationWarn.value = "avatar";
                } else {
                    validationWarn.value = "name";
                }
            }
        };
        socket.on("chat_login_successful", async () => {
            loggedIn.value = true;
            minimized.value = false;
            await nextTick();
            scrollMessagePanelToBottom();
            if (messageInput.value) {
                messageInput.value.focus();
            }
        });
        const logout = () => {
            loggedIn.value = false;
            sessionStorage.removeItem(loginInfoKey);
            socket.emit("user_info_clear");
        };

        // message sending:
        const messageInput = ref<HTMLInputElement | null>(null);
        const send = () => {
            if (messageInput.value) {
                const messageText = messageInput.value.value.trim();
                socket.emit("wrote_message", messageText);
                messageInput.value.value = "";
            }
        };

        // message display logic:
        const groupedMessages = ref<ChatMessage[][]>([]);
        let lastSender = "";
        socket.on("chat_announcement", async (announcement: string) => {
            groupedMessages.value.push([
                { isAnnouncement: true, messageHTML: announcement },
            ]);
            lastSender = "";
            await nextTick();
            scrollMessagePanelToBottom();
        });
        socket.on("chat_message", async (message: ChatMessage) => {
            if (
                message.senderID != lastSender ||
                groupedMessages.value.length == 0
            ) {
                groupedMessages.value.push([message]);
            } else {
                groupedMessages.value[groupedMessages.value.length - 1].push(
                    message
                );
            }
            lastSender = message.senderID as string;
            await nextTick();
            scrollMessagePanelToBottom();
        });

        socket.emit("ready_for", Subscription.chat);

        return {
            minimized,
            messagePanel,
            chatWindow,
            chatHeader,
            leftPos,
            bottomPos,
            drag,
            MIN_CHAT_BODY_HEIGHT,
            chatBodyHeight,
            resize,
            RESIZE_AREA_HEIGHT,
            pointerDown,
            pointerUp,
            loggedIn,
            avatarRow,
            selectedAvatar,
            nameInput,
            validationWarn,
            attemptLogin,
            logout,
            messageInput,
            send,
            groupedMessages,
            maximize,
            avatarPage,
            changePage,
            nextPageAvailable,
        };
    },
});
</script>

<style scoped lang="css" src="xp.css/dist/XP.css"></style>

<style scoped lang="scss">
@use "../scss/vars";

.title-bar-text {
    -moz-user-select: none;
    -webkit-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

#chat-window {
    position: fixed;
    width: vars.$chat-width;
    left: 0;
    bottom: 0;
    &.resizable #chat-header::after {
        position: absolute;
        top: -5px;
        left: 0;
        width: 100%;
        height: v-bind('RESIZE_AREA_HEIGHT + "px"');
        content: "";
        cursor: ns-resize;
    }
    &.resizable::after {
        position: absolute;
        left: 0;
        bottom: -5px;
        width: 100%;
        height: v-bind('RESIZE_AREA_HEIGHT + "px"');
        content: "";
        cursor: ns-resize;
    }
    .fullscreen &.minimized {
        display: none;
    }
}

#chat-window-log-out {
    background-image: url(../../assets/images/logoutnohover.inline.svg);
    &:hover {
        background-image: url(../../assets/images/logouthover.inline.svg);
    }
}

.window-body {
    font-family: vars.$pilot-font;
    height: v-bind('MIN_CHAT_BODY_HEIGHT + "px"');
    text-align: left;
}

#chat-login {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-evenly;
    height: 100%;
}

#avatar-selection-area {
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: 100%;
}

.avatar-page-arrow {
    cursor: pointer;
    opacity: 0.7;
    height: 30px;
    width: auto;
    &:hover {
        opacity: 1;
    }
    &.unavailable {
        visibility: hidden;
    }
}

.avatar-option {
    display: inline;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    border-width: 2px;
    border-style: solid;
    border-color: #0003;
    margin: 0 3px;
    cursor: pointer;
    background-color: white;
    &.selected {
        border-color: vars.$mitchbot-blue;
        border-style: inset;
        background-color: #eee;
    }
}

@keyframes flashRed {
    0% {
        color: black;
    }
    25% {
        color: red;
    }
    50% {
        color: black;
    }
    75% {
        color: red;
    }
    100% {
        color: black;
    }
}

.validation-warning {
    animation: 1s flashRed;
}

.xp input[type="text"] {
    border: solid #7f9db9 1px;
    padding: 0 5px;
}

#chat-body {
    display: flex;
    flex-direction: column;
    height: 100%;
}

#messages {
    height: 100%;
    overflow-y: scroll;
    padding: 7px;
    overflow-wrap: break-word;
}

#message-input-row {
    display: flex;
}

#message-input {
    width: 100%;
}

#send-message {
    min-width: initial;
}

.message {
    margin: 3px 0;
    width: 100%;
}

.announcement {
    font-style: italic;
    margin: 5px 0;
}

.chat-section {
    display: flex;
    align-items: flex-start;
    margin-bottom: 3px;
}

.chat-section:last-of-type {
    margin-bottom: 0;
}

.chat-section-text {
    width: calc(100% - 35px);
    overflow-x: hidden;
}

.in-chat-avatar {
    display: inline;
    width: 35px;
    height: 35px;
    border-radius: 50%;
    margin-right: 10px;
}

.in-chat-username {
    font-weight: bold;
    font-size: 1.3em;
}
</style>