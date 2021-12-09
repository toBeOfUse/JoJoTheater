<template>
    <div
        class="window"
        :class="{ loggedIn: 'logged-in', minimized: 'chat-minimized' }"
        :style="
            minimized
                ? { left: 0, bottom: 0 }
                : { left: leftPos + 'px', bottom: bottomPos + 'px' }
        "
        id="chat-window"
        @mousedown.prevent.stop="startDrag"
    >
        <div id="chat-header" class="title-bar">
            <div class="title-bar-text">MitchBot Instant Messenger (MBIM)</div>
            <div class="title-bar-controls">
                <button
                    id="chat-window-minimize"
                    aria-label="Minimize"
                    title="Minimize"
                    @click="minimized = true"
                ></button>
                <button
                    id="chat-window-log-out"
                    aria-label="Log Out"
                    title="Log Out"
                    @click="logout"
                ></button>
                <button
                    id="chat-window-maximize"
                    aria-label="Maximize"
                    title="Maximize"
                    @click="minimized = false"
                ></button>
            </div>
        </div>
        <div id="chat-window-body" class="window-body" v-if="!minimized">
            <div id="chat-login" v-if="!loggedIn">
                <label class="prompt" id="avatar-prompt">
                    Choose your avatar:
                </label>
                <div class="avatar-row" v-for="row in 2" :key="row">
                    <img
                        v-for="image in avatarRow(row)"
                        :key="image"
                        class="avatar-option"
                        :class="image == selectedAvatar ? 'selected' : ''"
                        :src="'/images/avatars/' + image"
                        @click="selectedAvatar = image"
                        @dblclick="attemptLogin"
                    />
                </div>
                <section class="field-row" style="margin-top: 5px; width: 100%">
                    <label
                        class="prompt"
                        id="name-prompt"
                        for="chat-name-input"
                        style="flex-shrink: 0"
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
                                <span class="in-chat-username">
                                    {{ group[0].senderName }}
                                </span>
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
                        @keydown.stop
                    />
                    <button @click="send" id="send-message">Send</button>
                </section>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from "../types";
import { socket } from "./globals";
import { ref, computed, nextTick } from "vue";

// positioning logic:
const minimized = ref(true);
const messagePanel = ref<null | HTMLElement>(null);
function scrollMessagePanelToBottom() {
    if (messagePanel.value) {
        messagePanel.value.scrollTop = messagePanel.value.scrollHeight;
    }
}
const leftPos = ref(0);
const bottomPos = ref(0);
let lastClientX = 0;
let lastClientY = 0;
const drag = (event: MouseEvent | TouchEvent) => {
    event.stopPropagation();
    event.preventDefault();
    let newX, newY;
    if (event instanceof MouseEvent) {
        newX = event.clientX;
        newY = event.clientY;
    } else {
        const touch = event.touches[0];
        newX = touch.clientX;
        newY = touch.clientY;
    }
    leftPos.value += newX - lastClientX;
    bottomPos.value -= newY - lastClientY;
    lastClientX = newX;
    lastClientY = newY;
};
const startDrag = (event: MouseEvent | TouchEvent) => {
    console.log("starting drag from mousedown/touchstart");
    if (event instanceof MouseEvent) {
        lastClientX = event.clientX;
        lastClientY = event.clientY;
    } else {
        lastClientX = event.touches[0].clientX;
        lastClientY = event.touches[0].clientY;
    }
    // TODO: determine if resizing or dragging
    window.addEventListener("mousemove", drag);
    window.addEventListener("mouseup", endDrag);
};
const endDrag = () => {
    window.removeEventListener("mousemove", drag);
    window.removeEventListener("mouseup", endDrag);
};

// login session logic:
const loggedIn = ref(false);

const avatars = [
    "nymface.png",
    "purpleface.png",
    "bogchamp.png",
    "coop.png",
    "gayknife.png",
    "scream.png",
    "rosie.png",
    "nonut.png",
    "strongseal.png",
    "doittoem.png",
    "yeehaw.png",
    "sparklewink.png",
];
const selectedAvatar = ref("");
const avatarRow = (which: number) => {
    if (which == 1) {
        return avatars.slice(0, Math.floor(avatars.length / 2));
    } else {
        return avatars.slice(Math.floor(avatars.length / 2));
    }
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
    } catch {
        console.log("could not parse previous login info");
    }
}
// attempt to start a new chat session
const attemptLogin = () => {
    if (
        nameInput.value.trim() &&
        nameInput.value.length < 30 &&
        selectedAvatar.value
    ) {
        const info = {
            name: nameInput.value,
            avatarURL: "/images/avatars/" + selectedAvatar.value,
            resumed: false,
        };
        try {
            sessionStorage.setItem(loginInfoKey, JSON.stringify(info));
        } catch {
            console.log("could not use session storage");
        }
        socket.emit("user_info_set", info);
    } else {
        // TODO: validation warning
    }
};
socket.on("chat_login_successful", async () => {
    loggedIn.value = true;
    minimized.value = false;
    await nextTick();
    scrollMessagePanelToBottom();
});
const logout = () => {
    loggedIn.value = false;
    sessionStorage.removeItem(loginInfoKey);
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
const messages = ref<ChatMessage[]>([]);
socket.on("chat_announcement", async (announcement: string) => {
    messages.value.push({ isAnnouncement: true, messageHTML: announcement });
    await nextTick();
    scrollMessagePanelToBottom();
});
socket.on("chat_message", async (message: ChatMessage) => {
    messages.value.push(message);
    await nextTick();
    scrollMessagePanelToBottom();
});
const groupedMessages = computed<ChatMessage[][]>(() => {
    if (messages.value.length == 0) {
        return [];
    }
    const groups: ChatMessage[][] = [];
    let group: ChatMessage[] = [messages.value[0]];
    for (let i = 1; i < messages.value.length; i++) {
        const prev = messages.value[i - 1];
        const curr = messages.value[i];
        if (
            curr.isAnnouncement ||
            prev.isAnnouncement ||
            prev.senderID != curr.senderID
        ) {
            groups.push(group);
            group = [];
        }
        group.push(curr);
    }
    groups.push(group);
    return groups;
});
</script>