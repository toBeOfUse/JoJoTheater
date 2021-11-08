import winston from "winston";

const logger = winston.createLogger({
    level: "debug",
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.simple(),
                winston.format.colorize()
            ),
        }),
        new winston.transports.File({
            filename: "debug.log",
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json({ space: 1 })
            ),
        }),
    ],
});

export default logger;
