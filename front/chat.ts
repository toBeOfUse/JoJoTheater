// import $ from "jquery";
// import type { Socket } from "socket.io-client";
// import type { ChatMessage } from "../types";

// function selectAvatar(index: number) {
//     const options = $(".avatar-option");
//     options.removeClass("selected");
//     $(options[index]).addClass("selected");
// }

// export default function initChat(socket: Socket) {
//     $(".prompt").on("animationend", function () {
//         $(this).removeClass("validation-warning");
//     });

//     // set up sending and receiving chat messages and announcements and displaying
//     // them
//     const messageInput = $("#message-input");
//     const sendButton = $("#send-message");
//     sendButton.on("click", () => {
//         const messageText = (messageInput.val() as string).trim();
//         if (messageText) {
//             socket.emit("wrote_message", messageText);
//             messageInput.val("");
//         }
//     });
//     messageInput.on("keydown", (event) => {
//         if (event.key == "Enter") {
//             sendButton.trigger("click");
//         }
//     });

//     let lastSenderID = "";
//     socket.on("chat_announcement", (announcement: string) => {
//         messages.append(
//             `<div class="chat-section"><div class="announcement">${announcement}</div></div>`
//         );
//         lastSenderID = "announcer";
//         scrollMessagesToBottom();
//     });
//     socket.on("chat_message", (message: ChatMessage) => {
//         if (lastSenderID != message.senderID) {
//             messages.append(`<div class="chat-section">
//                     <img class="in-chat-avatar" src="${message.senderAvatarURL}" />
//                     <div class="chat-section-text">
//                         <span class="in-chat-username">${message.senderName}</span>
//                     </div>
//                 </div>`);
//             lastSenderID = message.senderID as string;
//         }
//         messages
//             .find(".chat-section-text")
//             .last()
//             .append(`<div class="message">${message.messageHTML}</div>`);
//         scrollMessagesToBottom();
//     });

//     // set up dragging, resizing, and maximizing/minimizing the chat window
//     const chatWindow = $("#chat-window");
//     const chatBody = $("#chat-window-body");
//     const initialCWBox = chatWindow[0].getBoundingClientRect();
//     const initialCWLeft = initialCWBox.left;
//     const initialCWBottom = 0;
//     chatWindow.css({ left: initialCWLeft, bottom: initialCWBottom });

//     let cwLeft = initialCWLeft;
//     let cwBottom = initialCWBottom;

//     let minimized = true;

//     function moveChatWindow(x: number, y: number) {
//         if (minimized) return;
//         cwLeft += x;
//         cwBottom -= y;
//         cwBottom = Math.max(cwBottom, -(chatWindow.height() as number) + 15);
//         cwBottom = Math.min(
//             cwBottom,
//             window.innerHeight - (chatWindow.height() as number)
//         );
//         cwLeft = Math.max(-initialCWBox.width, cwLeft);
//         cwLeft = Math.min(cwLeft, window.innerWidth - 15);
//         chatWindow.css({ left: cwLeft, bottom: cwBottom });
//     }

//     function resizeChatWindow(changeInHeight: number): number {
//         // returns the actual change in height after bounds are applied
//         if (chatBody.css("display") == "none") {
//             return 0;
//         }
//         const minBodyHeight = 160; // in accordance with chat.scss
//         const maxBodyHeight = window.innerHeight * 0.7;
//         const oldHeight = chatBody.height() as number;
//         const newHeight = Math.min(
//             Math.max(oldHeight + changeInHeight, minBodyHeight),
//             maxBodyHeight
//         );
//         chatBody.css("height", newHeight + "px");
//         return newHeight - oldHeight;
//     }

//     window.addEventListener("resize", () => {
//         // simple way of ensuring the window stays inside the min/max bounds
//         moveChatWindow(0, 0);
//     });
//     const chatWindowHeader = $("#chat-header");

//     chatWindowHeader.find("button").on("mousedown", (event) => {
//         event.preventDefault();
//         event.stopPropagation();
//     });

//     chatWindow.on("mousedown", (mouseDownEvent) => {
//         if (minimized) {
//             return;
//         }
//         let lastClientX = mouseDownEvent.clientX;
//         let lastClientY = mouseDownEvent.clientY;
//         const chatWindowRect = chatWindow[0].getBoundingClientRect();
//         // rMargin should stay in sync with the ::after elements that provide the
//         // cursor: ns-resize in chat.scss
//         const rMargin = 5;
//         const resizing =
//             ((lastClientY > chatWindowRect.top - rMargin &&
//                 lastClientY < chatWindowRect.top + rMargin) ||
//                 (lastClientY > chatWindowRect.bottom - rMargin &&
//                     lastClientY < chatWindowRect.bottom + rMargin)) &&
//             chatWindow.hasClass("logged-in");
//         const moving =
//             !resizing &&
//             $(mouseDownEvent.target).parents("#chat-header").length;
//         if (!(moving || resizing)) {
//             return;
//         }
//         mouseDownEvent.preventDefault();
//         mouseDownEvent.stopPropagation();
//         const messageCont = $("#messages");
//         const messageScrollTop = messageCont.scrollTop();
//         if (resizing) {
//             $("body").addClass("resize-cursor");
//         }
//         const fromTop =
//             lastClientY < chatWindowRect.top + chatWindowRect.height / 2;
//         const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
//             if (resizing) {
//                 if (fromTop) {
//                     resizeChatWindow(lastClientY - mouseMoveEvent.clientY);
//                 } else {
//                     const resized = resizeChatWindow(
//                         mouseMoveEvent.clientY - lastClientY
//                     );
//                     moveChatWindow(0, resized);
//                 }
//                 messageCont.scrollTop(messageScrollTop as number);
//             } else if (moving) {
//                 moveChatWindow(
//                     mouseMoveEvent.clientX - lastClientX,
//                     mouseMoveEvent.clientY - lastClientY
//                 );
//             }
//             lastClientX = mouseMoveEvent.clientX;
//             lastClientY = mouseMoveEvent.clientY;
//         };
//         window.addEventListener("mousemove", handleMouseMove);
//         const cancelMouseMove = () => {
//             window.removeEventListener("mousemove", handleMouseMove);
//             window.removeEventListener("mouseup", cancelMouseMove);
//             if (resizing) {
//                 $("body").removeClass("resize-cursor");
//             }
//         };
//         window.addEventListener("mouseup", cancelMouseMove);
//     });

//     // risky full screen stuff
//     const chatContainer = $("#chat-container");
//     document.addEventListener("fullscreenchange", () => {
//         if (
//             document.fullscreenElement &&
//             document.fullscreenElement instanceof HTMLElement &&
//             !minimized
//         ) {
//             chatContainer.detach().appendTo($(document.fullscreenElement));
//             scrollMessagesToBottom();
//         } else {
//             if (chatContainer.parent().attr("id") != "container-container") {
//                 chatContainer.detach().appendTo($("#container-container"));
//                 scrollMessagesToBottom();
//             }
//         }
//     });
//     $("#chat-window-minimize").on("click", () => {
//         if (chatContainer.parent().attr("id") != "container-container") {
//             chatContainer.detach().appendTo($("#container-container"));
//             scrollMessagesToBottom();
//         }
//     });
// }
