import { Sequelize, Model, DataTypes } from "sequelize";
import { ChatMessage, ChatAnnouncement } from "../types";

const sequelize = new Sequelize("sqlite:./chat.db");

class User extends Model {}
User.init(
    {
        id: { type: DataTypes.STRING, primaryKey: true },
        name: DataTypes.STRING,
        avatarURL: DataTypes.STRING,
    },
    { sequelize, indexes: [{ unique: true, fields: ["id"] }] }
);

class Message extends Model {}
Message.init(
    {
        type: DataTypes.ENUM("message", "announcement"),
        html: DataTypes.STRING,
        timeSent: DataTypes.DATE,
        user: {
            // null if type is "announcement"
            type: DataTypes.STRING,
            references: { model: User, key: "id" },
        },
    },
    { sequelize, indexes: [{ fields: ["timeSent"] }] }
);

export default async function saveMessage(
    message: ChatMessage | ChatAnnouncement
) {
    await sequelize.sync();
    if (typeof message == "string" || message instanceof String) {
        // type is ChatAnnouncement
        await Message.create({
            type: "announcement",
            html: message,
            timeSent: new Date(),
            user: null,
        });
    } else {
        // type is ChatMessage
        const existingUser = await User.findOne({
            where: { id: message.sender.id },
        });
        if (existingUser) {
            await User.update(message.sender, {
                where: { id: message.sender.id },
            });
        } else {
            await User.create(message.sender);
        }
        await Message.create({
            type: "message",
            html: message.messageHTML,
            timeSent: new Date(),
            user: message.sender.id,
        });
    }
}
