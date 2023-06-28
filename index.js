
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());
app.use(express.static('./static'));

const TYPE_HEARTBEAT = "heartbeat";
const TYPE_CREATE_ROOM = "create_room";
const TYPE_JOIN_ROOM = "join_room";
const TYPE_ROOM_INFO = "room_info";
const TYPE_BOTH_JOINED = "both_joined";
const TYPE_RTC_MESSAGE = "rtc_message";
const TYPE_ERROR = "error";

const roomMap = {};
const sessionIdMap = {};

const httpServer = http.createServer(app);
const wss = new WebSocketServer({
    server: httpServer,
});

wss.on('connection', (ws) => {

    ws.sessionId = uuidv4();
    console.log('connected!!', ws.sessionId);

    ws.on('close', () => {
        console.log('connection closed', ws.sessionId);
    });

    ws.on('message', (data) => {

        try {
            const message = JSON.parse(data.toString());
            console.log('recieved : ', message);

            const type = message['type'];
            const payload = message['payload'];

            switch (type) {

                case TYPE_HEARTBEAT: {
                    ws.send(JSON.stringify({
                        type: TYPE_HEARTBEAT,
                    }));
                    break;
                }

                case TYPE_CREATE_ROOM: {
                    const roomId = payload['roomId'];
                    const name = payload['name'];

                    if (roomMap[roomId] === undefined) {
                        roomMap[roomId] = {};
                        roomMap[roomId]['host'] = {
                            name: name,
                            wsocket: ws,
                        }
                        sessionIdMap[ws.sessionId] = roomId;

                        ws.send(JSON.stringify({
                            type: TYPE_ROOM_INFO,
                            payload: {
                                name: name,
                                roomId: roomId,
                                sessionId: ws.sessionId,
                                isHost: true,
                            },
                        }));

                    } else {

                        ws.send(JSON.stringify({
                            type: TYPE_ERROR,
                            payload: {
                                message: "room with specified id is already created",
                            }
                        }));
                    }
                    break;
                }

                case TYPE_JOIN_ROOM: {
                    const roomId = payload['roomId'];
                    const name = payload['name'];

                    if (roomMap[roomId] !== undefined) {
                        roomMap[roomId]['guest'] = {
                            name: name,
                            wsocket: ws,
                        }
                        sessionIdMap[ws.sessionId] = roomId;
                        ws.send(JSON.stringify({
                            type: TYPE_ROOM_INFO,
                            payload: {
                                name: name,
                                roomId: roomId,
                                sessionId: ws.sessionId,
                            },
                        }));

                    } else {
                        ws.send(JSON.stringify({
                            type: TYPE_ERROR,
                            payload: {
                                message: 'room with specified id is not present',
                            }
                        }));
                    }
                    break;
                }

                case TYPE_RTC_MESSAGE: {
                    break;
                }

                default: {
                    console.log('unknown type : ', type);
                    break;
                }
            }

        } catch (err) {
            console.error('error in parsing message', err);
        }
    });
})

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});
