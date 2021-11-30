import $ from "jquery";
import type { Socket } from "socket.io-client";
import type { ChatMessage } from "../types";
import "./spinner.css";

// load xp.css as raw, put it in a style element, and then modify the rules so that
// they only apply to elements within the .xp class
import xp from "!raw-loader!xp.css/dist/XP.css";
const xpStyle = document.createElement("style");
xpStyle.innerHTML = xp;
document.head.appendChild(xpStyle);
if (xpStyle.sheet) {
    for (const rule of Array.from(xpStyle.sheet.cssRules)) {
        if (rule instanceof CSSStyleRule) {
            rule.selectorText = ".xp " + rule.selectorText;
        }
    }

    // the best way to load the fonts is still to let the sass-loader import them though
    for (let i = xpStyle.sheet.cssRules.length - 1; i >= 0; i--) {
        if (xpStyle.sheet.cssRules[i] instanceof CSSFontFaceRule) {
            xpStyle.sheet.deleteRule(i);
        }
    }
} else {
    console.error("browser not generating xp style sheet properly");
}
import "xp.css/gui/_fonts.scss";

function selectAvatar(index: number) {
    const options = $(".avatar-option");
    options.removeClass("selected");
    $(options[index]).addClass("selected");
}

export default function initChat(socket: Socket) {
    const loginSubmitButton = $("#user-info-submit");

    // setting up avatar input
    $(".avatar-option").each(function (i) {
        this.addEventListener("click", () => selectAvatar(i));
    });
    $(".avatar-option").on("dblclick", () =>
        loginSubmitButton.trigger("click")
    );

    // setting up login validation and submission
    $("#chat-name-input").on("keydown", (event) => {
        if (event.key == "Enter") loginSubmitButton.trigger("click");
    });
    loginSubmitButton.on("click", () => {
        const avatar = $(".avatar-option.selected");
        const name = $("#chat-name-input").val() as string;
        if (!avatar.length || !avatar.attr("src")) {
            $("#avatar-prompt").addClass("validation-warning");
        } else if (!name || !name.trim() || name.trim().length > 30) {
            console.log("name warning");
            $("#name-prompt").addClass("validation-warning");
        } else {
            const info = {
                name,
                avatarURL: avatar.attr("src") as string,
            };
            socket.emit("user_info_set", info);
        }
    });
    socket.on("chat_login_successful", () => {
        $("#chat-window").addClass("logged-in");
    });

    $(".prompt").on("animationend", function () {
        $(this).removeClass("validation-warning");
    });

    // set up sending and receiving chat messages and announcements and displaying
    // them
    function scrollMessagesToBottom() {
        messages.scrollTop(messages[0].scrollHeight as number);
    }
    const messageInput = $("#message-input");
    const sendButton = $("#send-message");
    sendButton.on("click", () => {
        socket.emit("wrote_message", messageInput.val());
        messageInput.val("");
    });
    messageInput.on("keydown", (event) => {
        if (event.key == "Enter") {
            sendButton.trigger("click");
        }
    });

    const messages = $("#messages");
    let lastSenderID = "";
    socket.on("chat_announcement", (announcement: string) => {
        messages.append(
            `<div class="chat-section"><div class="announcement">${announcement}</div></div>`
        );
        lastSenderID = "announcer";
        scrollMessagesToBottom();
    });
    socket.on("chat_message", (message: ChatMessage) => {
        if (lastSenderID != message.senderID) {
            messages.append(`<div class="chat-section">
                    <img class="in-chat-avatar" src="${message.senderAvatarURL}" />
                    <div class="chat-section-text">
                        <span class="in-chat-username">${message.senderName}</span>
                    </div>
                </div>`);
            lastSenderID = message.senderID as string;
        }
        messages
            .find(".chat-section-text")
            .last()
            .append(`<div class="message">${message.messageHTML}</div>`);
        scrollMessagesToBottom();
    });

    // set up dragging, resizing, and maximizing/minimizing the chat window
    const chatWindow = $("#chat-window");
    const chatBody = $("#chat-window-body");
    const initialCWBox = chatWindow[0].getBoundingClientRect();
    const initialCWLeft = initialCWBox.left;
    const initialCWBottom = 0;
    chatWindow.css({ left: initialCWLeft, bottom: initialCWBottom });

    let cwLeft = initialCWLeft;
    let cwBottom = initialCWBottom;

    let minimized = true;

    function moveChatWindow(x: number, y: number) {
        if (minimized) return;
        cwLeft += x;
        cwBottom -= y;
        cwBottom = Math.max(cwBottom, -(chatWindow.height() as number) + 15);
        cwBottom = Math.min(
            cwBottom,
            window.innerHeight - (chatWindow.height() as number)
        );
        cwLeft = Math.max(-initialCWBox.width, cwLeft);
        cwLeft = Math.min(cwLeft, window.innerWidth - 15);
        chatWindow.css({ left: cwLeft, bottom: cwBottom });
    }

    function resizeChatWindow(deltaY: number) {
        if (chatBody.css("display") == "none") {
            return;
        }
        const minBodyHeight = 160; // in accordance with chat.scss
        const maxBodyHeight = window.innerHeight * 0.7;
        const currentHeight = chatBody.height() as number;
        const newHeight = Math.min(
            Math.max(currentHeight - deltaY, minBodyHeight),
            maxBodyHeight
        );
        chatBody.css("height", newHeight + "px");
    }

    window.addEventListener("resize", () => {
        // simple way of ensuring the window stays inside the min/max bounds
        moveChatWindow(0, 0);
    });

    const chatWindowBody = $("#chat-window-body");

    $("#chat-window-minimize").on("click", () => {
        chatWindow.addClass("chat-minimized");
        minimized = true;
        chatWindow.css({ left: initialCWLeft, bottom: initialCWBottom });
    });

    $("#chat-window-maximize").on("click", () => {
        chatWindow.removeClass("chat-minimized");
        minimized = false;
        chatWindow.css({ left: cwLeft, bottom: cwBottom });
        const chatWindowRect = chatWindow[0].getBoundingClientRect();
        if (chatWindowRect.bottom > window.innerHeight) {
            moveChatWindow(0, -(chatWindowRect.bottom - window.innerHeight));
        }
    });

    const chatWindowHeader = $("#chat-header");

    chatWindowHeader.find("button").on("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    chatWindowHeader.on("mousedown", (mouseDownEvent) => {
        mouseDownEvent.preventDefault();
        mouseDownEvent.stopPropagation();
        if (!minimized) {
            let lastClientX = mouseDownEvent.clientX;
            let lastClientY = mouseDownEvent.clientY;
            const chatWindowTop =
                chatWindowHeader[0].getBoundingClientRect().top;
            const resizing =
                mouseDownEvent.clientY > chatWindowTop - 5 &&
                mouseDownEvent.clientY < chatWindowTop + 5 &&
                chatWindow.hasClass("logged-in");
            const messageCont = $("#messages");
            const messageScrollTop = messageCont.scrollTop();
            if (resizing) {
                $("body").addClass("resize-cursor");
            }
            const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
                if (resizing) {
                    resizeChatWindow(mouseMoveEvent.clientY - lastClientY);
                    messageCont.scrollTop(messageScrollTop as number);
                } else {
                    moveChatWindow(
                        mouseMoveEvent.clientX - lastClientX,
                        mouseMoveEvent.clientY - lastClientY
                    );
                }
                lastClientX = mouseMoveEvent.clientX;
                lastClientY = mouseMoveEvent.clientY;
            };
            window.addEventListener("mousemove", handleMouseMove);
            const cancelMouseMove = () => {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", cancelMouseMove);
                if (resizing) {
                    $("body").removeClass("resize-cursor");
                }
            };
            window.addEventListener("mouseup", cancelMouseMove);
        }
    });

    // risky full screen stuff
    const chatContainer = $("#chat-container");
    document.addEventListener("fullscreenchange", () => {
        if (
            document.fullscreenElement &&
            document.fullscreenElement instanceof HTMLElement &&
            !minimized
        ) {
            chatContainer.detach().appendTo($(document.fullscreenElement));
            scrollMessagesToBottom();
        } else {
            if (chatContainer.parent().attr("id") != "container-container") {
                chatContainer.detach().appendTo($("#container-container"));
                scrollMessagesToBottom();
            }
        }
    });
    $("#chat-window-minimize").on("click", () => {
        if (chatContainer.parent().attr("id") != "container-container") {
            chatContainer.detach().appendTo($("#container-container"));
            scrollMessagesToBottom();
        }
    });
}
