import { ensureUserIDs } from "./queries";

type Responder = (messageHTML: string) => string | undefined;
interface NPC {
    senderName: string;
    senderAvatarURL: string;
    userID: number;
    responder: Responder;
}

const NPCs: NPC[] = [
    {
        senderName: "Cabbage Merchant",
        senderAvatarURL: "/images/avatars/npcs/cabbageguy.jpg",
        userID: -1,
        responder(messageHTML: string) {
            if (!/cabbage/i.test(messageHTML)) {
                return undefined;
            } else {
                return "My cabbages!";
            }
        },
    },
    {
        senderName: "the rain",
        senderAvatarURL: "/images/avatars/npcs/rain.jpg",
        userID: -2,
        responder(messageHTML: string) {
            if (!/\brain(ing|ed|s|y)?\b/i.test(messageHTML)) {
                return undefined;
            } else {
                return ["splish", "sploosh", "kasplish", "kasploosh", "plash"][
                    Math.floor(Math.random() * 5)
                ];
            }
        },
    },
];

ensureUserIDs(NPCs.map((n) => n.userID));

export default NPCs;
