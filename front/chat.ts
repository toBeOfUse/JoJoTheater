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

function getUserInfo(): chatUserInfo | undefined {
    const avatar = $(".avatar-option.selected");
    const name = ($("#chat-name-input").val() as string).trim();
    if (!avatar.length || !avatar.attr("src") || !name) {
        return undefined;
    } else {
        return {
            name,
            avatarURL: avatar.attr("src") as string,
        };
    }
}

export default function initChat(socket: Socket) {
    console.log("setting up chat");

    $(".avatar-option").each(function (i) {
        this.addEventListener("click", () => selectAvatar(i));
    });

    $("#user-info-submit").on("click", () => {
        let info;
        if ((info = getUserInfo())) {
            socket.emit("user_info_set", info);
        }
    });

    $("#chat-window-minimize").on("click", () =>
        $("#chat-window-body").addClass("chat-minimized")
    );

    $("#chat-window-maximize").on("click", () =>
        $("#chat-window-body").removeClass("chat-minimized")
    );
}
