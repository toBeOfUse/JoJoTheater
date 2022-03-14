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
            @click.stop="deflectFocusToMessageInput"
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
                        src="/images/page-change-arrow.png"
                        style="transform: scaleX(-1)"
                        title="Previous Page"
                    />
                    <div>
                        <div class="avatar-row" v-for="row in 2" :key="row">
                            <opt-image
                                v-for="avatar in avatarRow(row)"
                                :key="avatar.id"
                                class="avatar-option"
                                :class="
                                    avatar.id == selectedAvatar?.id
                                        ? 'selected'
                                        : ''
                                "
                                :path="avatar.path"
                                @click="selectedAvatar = avatar"
                                @dblclick="attemptLogin(false)"
                            />
                        </div>
                    </div>
                    <img
                        class="avatar-page-arrow"
                        :class="{ unavailable: !nextPageAvailable }"
                        @click="changePage(1)"
                        src="/images/page-change-arrow.png"
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
                        @keypress.enter="attemptLogin(false)"
                        @keydown="handleEmojiNameInput"
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
                    <button @click="attemptLogin(false)" id="user-info-submit">
                        OK
                    </button>
                </section>
            </div>
            <div id="chat-body" v-if="loggedIn">
                <article id="messages" role="tabpanel" ref="messagePanel">
                    <div
                        class="chat-section"
                        v-for="group in groupedMessages"
                        :key="group[0].createdAt"
                    >
                        <div
                            v-if="group[0].isAnnouncement"
                            :key="group[0].createdAt"
                            class="announcement"
                            v-html="group[0].messageHTML"
                            :title="group[0].time"
                        ></div>
                        <template v-else>
                            <opt-image
                                class="in-chat-avatar"
                                :path="group[0].senderAvatarURL"
                            />
                            <div class="chat-section-text">
                                <span
                                    class="in-chat-username"
                                    v-html="group[0].senderName"
                                />
                                <div
                                    class="message"
                                    v-for="message in group"
                                    v-html="message.messageHTML"
                                    :key="message.createdAt"
                                    :title="message.time"
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
                        @keydown="messageInputKeydown"
                        :style="{ color: outgoing ? 'gray' : 'black' }"
                    />
                    <button @click="send" id="send-message">Send</button>
                </section>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import {
    ChatMessage,
    Subscription,
    StreamsSocket,
    Avatar,
} from "../../constants/types";
import OptImage from "./image.vue";
import { ref, nextTick, defineComponent, PropType, computed, Ref } from "vue";
import {
    APIPath,
    getAvatarImageURL,
    LogInBody,
} from "../../constants/endpoints";
export default defineComponent({
    props: {
        socket: {
            type: Object as PropType<StreamsSocket>,
            required: true,
        },
    },
    components: { OptImage },
    setup(props) {
        const socket = props.socket;

        // message sending:
        const messageInput = ref<HTMLInputElement | null>(null);
        const outgoing = ref(false);
        const send = async () => {
            if (messageInput.value && !outgoing.value) {
                const messageText = messageInput.value.value.trim();
                if (messageText) {
                    outgoing.value = true;
                    await props.socket.http(APIPath.sendMessage, {
                        messageText,
                    });
                    messageInput.value.value = "";
                    outgoing.value = false;
                }
            }
        };
        let lastTypingEvent = 0;
        const emojis: Record<string, string> = {
            e: "👀",
            s: "🤝",
            t: "👍",
            p: "😔",
            f: "😳",
            l: "🥺",
            c: "🤡",
            d: "💀",
            u: "☝",
            w: "👋",
            r: "🌈",
            h: "❤",
            a: "😩",
        };
        const handleEmoji = (
            event: KeyboardEvent,
            stringRef: Ref<string> | null = null
        ) => {
            if (
                event.altKey &&
                event.key in emojis &&
                event.target instanceof HTMLInputElement
            ) {
                event.preventDefault();
                const target = event.target;
                const selStart = target.selectionStart;
                const selEnd = target.selectionEnd;
                const oldValue = target.value;
                const emoji = emojis[event.key];
                if ((selStart || selStart === 0) && (selEnd || selEnd === 0)) {
                    (stringRef || target).value =
                        oldValue.substring(0, selStart) +
                        emoji +
                        oldValue.substring(selEnd);
                    if (stringRef) {
                        nextTick(() => {
                            target.selectionStart = selStart + emoji.length;
                            target.selectionEnd = selStart + emoji.length;
                        });
                    } else {
                        target.selectionStart = selStart + emoji.length;
                        target.selectionEnd = selStart + emoji.length;
                    }
                } else {
                    (stringRef || target).value += emoji;
                }
                return true;
            }
            return false;
        };
        const handleEmojiNameInput = (event: KeyboardEvent) => {
            handleEmoji(event, nameInput);
        };
        const messageInputKeydown = (event: KeyboardEvent) => {
            if (outgoing.value) {
                event.preventDefault();
            } else if (handleEmoji(event)) {
            } else if (event.key.toLowerCase() == "j" && event.altKey) {
                // handled by inhabitant.vue sorry
            } else if (
                /^[a-z0-9]$/i.test(event.key) ||
                event.key == "Backspace" ||
                event.key == "Unidentified" // mobile chrome
            ) {
                if (Date.now() - lastTypingEvent > 1000) {
                    props.socket.http(APIPath.typingStart);
                    lastTypingEvent = Date.now();
                }
            } else if (event.key == "Enter") {
                send();
            }
        };
        const deflectFocusToMessageInput = (event: MouseEvent) => {
            event.stopPropagation();
            // deflect focus to message input unless it would destroy a selection
            if (messageInput.value && !window?.getSelection()?.toString()) {
                messageInput.value.focus();
            }
        };

        // positioning logic:
        const minimized = ref(true);
        const messagePanel = ref<null | HTMLElement>(null);
        function scrollMessagePanelToBottom(maintainOnly: boolean = false) {
            const wasAtBottom =
                messagePanel.value &&
                Math.abs(
                    messagePanel.value.scrollTop +
                        messagePanel.value.clientHeight -
                        messagePanel.value.scrollHeight
                ) < 10;
            nextTick().then(() => {
                if (messagePanel.value && (!maintainOnly || wasAtBottom)) {
                    messagePanel.value.scrollTop =
                        messagePanel.value.scrollHeight;
                }
            });
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
            if (!chatWindow.value || !chatHeader.value || minimized.value) {
                return;
            }
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
            if (messageInput.value) {
                messageInput.value.focus();
            }
        };

        const maximize = () => {
            minimized.value = false;
            scrollMessagePanelToBottom();
        };

        // login session logic:
        const loggedIn = ref(false);

        const nameInput = ref<string>("");
        const selectedAvatar = ref<Avatar | null>(null);
        const avatarPage = ref(0);
        const avatarsPerRow = 6;
        const rowsPerPage = 2;
        const avatars = ref<Avatar[]>([]);

        props.socket.http(APIPath.getAvatars).then((response) => {
            avatars.value = response.avatars;
            // attempt to resume previous session saved in browser
            const lastLoginString = sessionStorage.getItem(loginInfoKey);
            if (lastLoginString) {
                try {
                    const lastLogin = JSON.parse(lastLoginString);
                    if (lastLogin.name) {
                        nameInput.value = lastLogin.name;
                    }
                    if (lastLogin.avatarID) {
                        const found = avatars.value.find(
                            (a) => a.id == lastLogin.avatarID
                        );
                        if (found) selectedAvatar.value = found;
                    }
                    if (lastLogin.name && lastLogin.avatarID) {
                        attemptLogin(true);
                    }
                } catch {
                    console.log("could not parse previous login info");
                }
                // if we don't have a previous session saved in the browser to
                // reference, pull from the server's identity information
            } else {
                socket.http(APIPath.getIdentity).then((response) => {
                    if (!nameInput.value && response.lastUsername) {
                        nameInput.value = response.lastUsername;
                    }
                    if (!selectedAvatar.value && response.lastAvatarID) {
                        const avatarIndex = avatars.value.findIndex(
                            (a) => a.id == response.lastAvatarID
                        );
                        if (avatarIndex) {
                            selectedAvatar.value = avatars.value[avatarIndex];
                            avatarPage.value = Math.floor(avatarIndex / 12);
                        }
                    }
                });
            }
        });

        const nextPageAvailable = computed<boolean>(() => {
            return (
                avatars.value.length != 0 &&
                (avatarPage.value + 1) * avatarsPerRow * rowsPerPage <
                    avatars.value.length - 1
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
            return avatars.value
                .slice(offset, offset + avatarsPerRow)
                .map((a) => ({ path: getAvatarImageURL(a.file), ...a }));
        };

        const loginInfoKey = "loginInfo";

        // attempt to start a new chat session
        const validationWarn = ref<"none" | "name" | "avatar">("none");
        const attemptLogin = async (resumed: boolean = false) => {
            if (
                nameInput.value.trim() &&
                nameInput.value.length < 30 &&
                selectedAvatar.value
            ) {
                const info: LogInBody = {
                    name: nameInput.value,
                    avatarID: selectedAvatar.value.id,
                    resumed,
                };
                try {
                    sessionStorage.setItem(loginInfoKey, JSON.stringify(info));
                } catch {
                    console.log("could not use session storage");
                }
                try {
                    await props.socket.http(APIPath.logIn, info);
                } catch (e) {
                    console.error("Log in failed :(");
                    console.error(e);
                    return;
                }
                socket.setGlobal("inChat", true);
                loggedIn.value = true;
                minimized.value = false;
                scrollMessagePanelToBottom();
                if (messageInput.value) {
                    messageInput.value.focus();
                }
            } else {
                if (!selectedAvatar.value) {
                    validationWarn.value = "avatar";
                } else {
                    validationWarn.value = "name";
                }
            }
        };
        const logout = () => {
            socket.setGlobal("inChat", false);
            loggedIn.value = false;
            sessionStorage.removeItem(loginInfoKey);
            props.socket.http(APIPath.logOut);
        };

        // message display logic:
        const groupedMessages = ref<({ time: string } & ChatMessage)[][]>([]);
        let lastSender = -1;
        let lastTime = 0;
        socket.on("chat_message", (message: ChatMessage) => {
            const timePassedMinutes =
                (message.createdAt - lastTime) / 1000 / 60;
            let timeAnnouncementInserted = false;
            if (lastTime != 0 && timePassedMinutes > 10) {
                let timePassageNumber: number;
                let timePassageUnit: string;
                if (timePassedMinutes < 60) {
                    timePassageNumber = Math.round(timePassedMinutes);
                    timePassageUnit = "minute";
                } else if (timePassedMinutes < 24 * 60) {
                    timePassageNumber = Math.round(timePassedMinutes / 60);
                    timePassageUnit = "hour";
                } else {
                    timePassageNumber = Math.round(timePassedMinutes / 60 / 24);
                    timePassageUnit = "day";
                }
                // genius pluralization filter
                if (timePassageNumber != 1) {
                    timePassageUnit += "s";
                }
                const timePassageIndicator =
                    `And so ${timePassageNumber} untapped ` +
                    `${timePassageUnit} whistled by...`;
                groupedMessages.value.push([
                    {
                        isAnnouncement: true,
                        messageHTML: timePassageIndicator,
                        createdAt: (message.createdAt + lastTime) / 2, // shrug
                        time: "this is liminal 🥺",
                    },
                ]);
                timeAnnouncementInserted = true;
            }
            lastTime = message.createdAt;
            const timedMessage = {
                ...message,
                time: new Date(message.createdAt).toLocaleString(),
            };
            if (
                timeAnnouncementInserted ||
                message.isAnnouncement ||
                message.userID != lastSender ||
                groupedMessages.value.length == 0
            ) {
                groupedMessages.value.push([timedMessage]);
            } else {
                groupedMessages.value.slice(-1)[0].push(timedMessage);
            }
            lastSender = message.userID || -1;
            scrollMessagePanelToBottom(true);
        });

        // TODO: re-subscribe on reconnect. But it may take some work to block
        // the resulting incoming message update
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
            messageInputKeydown,
            deflectFocusToMessageInput,
            outgoing,
            handleEmoji,
            handleEmojiNameInput,
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
    width: 34px;
    height: 34px;
    border-width: 2px;
    border-style: solid;
    border-color: #0005;
    margin: 0 1px;
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
    font-family: "Pixelated MS Sans Serif", "Segoe UI Emoji", Arial;
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
    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Old versions of Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome, Edge, Opera and Firefox */
}

.in-chat-username {
    font-weight: bold;
    font-size: 1.3em;
    line-height: 1.3em;
}
</style>
