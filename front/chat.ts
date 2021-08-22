import $ from "jquery";
import type { Socket } from "socket.io-client";
import type { chatUserInfo } from "../types";

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
            xpStyle.sheet.removeRule(i);
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
    console.log("setting up chat");

    $(".avatar-option").each(function (i) {
        this.addEventListener("click", () => selectAvatar(i));
    });

    $("#user-info-submit").on("click", () => {
        const avatar = $(".avatar-option.selected");
        const name = $("#chat-name-input").val() as string;
        if (!avatar.length || !avatar.attr("src")) {
            $("#avatar-prompt").addClass("validation-warning");
        } else if (!name || !name.trim()) {
            console.log("name warning");
            $("#name-prompt").addClass("validation-warning");
        } else {
            const info: chatUserInfo = {
                name,
                avatarURL: avatar.attr("src") as string,
            };
            socket.emit("user_info_set", info);
        }
    });

    $(".prompt").on("animationend", function () {
        $(this).removeClass("validation-warning");
    });

    const chatWindow = $("#chat-window");
    const initialCWBox = chatWindow[0].getBoundingClientRect();
    const initialCWLeft = initialCWBox.left;
    const initialCWTop = window.innerHeight - initialCWBox.height;
    chatWindow.css({ left: initialCWLeft, top: initialCWTop });

    let cwLeft = initialCWLeft;
    let cwTop = initialCWTop;

    function moveChatWindow(x: number, y: number) {
        cwLeft += x;
        cwTop += y;
        cwTop = Math.max(0, cwTop);
        cwTop = Math.min(cwTop, window.innerHeight - 15);
        cwLeft = Math.max(-initialCWBox.width + 15, cwLeft);
        cwLeft = Math.min(cwLeft, window.innerWidth - 15);
        chatWindow.css({ left: cwLeft, top: cwTop });
    }

    let minimized = true;

    $("#chat-window-minimize").on("click", () => {
        $("#chat-window-body").addClass("chat-minimized");
        minimized = true;
        chatWindow.css({ left: initialCWLeft, top: initialCWTop });
    });

    $("#chat-window-maximize").on("click", () => {
        $("#chat-window-body").removeClass("chat-minimized");
        minimized = false;
        chatWindow.css({ left: cwLeft, top: cwTop });
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
        let lastScreenX = mouseDownEvent.screenX;
        let lastScreenY = mouseDownEvent.screenY;
        if (!minimized) {
            const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
                moveChatWindow(
                    mouseMoveEvent.screenX - lastScreenX,
                    mouseMoveEvent.screenY - lastScreenY
                );
                lastScreenX = mouseMoveEvent.screenX;
                lastScreenY = mouseMoveEvent.screenY;
            };
            window.addEventListener("mousemove", handleMouseMove);
            const cancelMouseMove = () => {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", cancelMouseMove);
            };
            window.addEventListener("mouseup", cancelMouseMove);
        }
    });
}
