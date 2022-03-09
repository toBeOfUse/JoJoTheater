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
];

ensureUserIDs(NPCs.map((n) => n.userID));

export default NPCs;
