
console.log('== WebRTC is awesome ==');

const TYPE_HEARTBEAT = "heartbeat";
const TYPE_CREATE_ROOM = "create_room";
const TYPE_JOIN_ROOM = "join_room";
const TYPE_ROOM_INFO = "room_info";
const TYPE_BOTH_JOINED = "both_joined";
const TYPE_RTC_MESSAGE = "rtc_message";
const TYPE_ERROR = "error";

async function createConnection() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${document.location.host}`);
        ws.onopen = (event) => {
            resolve(ws);
        }
        ws.onerror = (error) => {
            reject(error);
        }
    });
}

// initialize local stream
async function initLocalStream() {
    return new Promise((resolve, reject) => {
        const constraints = {
            // video: true,
            video: {
                width: 1920,
                height: 1080,
            },
            audio: true,
        }
        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {
                resolve(stream);
            })
            .catch((err) => {
                reject(err);
            });
    });
}

let heartBeatHandler = null;
let wsocket = null;
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let sessionId = '';
let isHost = false;

// initialize peer connection
async function createPeerConnection() {
    try {
        const configuration = {
            'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }]
        }

        peerConnection = new RTCPeerConnection(configuration);
        // add local tracks to peer connection
        if (localStream !== null) {
            localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStream);
            });
        }

        // set remote stream
        remoteStream = new MediaStream();
        peerConnection.ontrack = async (event) => {
            console.log('track event : ', event);
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        }

    } catch (err) {
        console.error('error in creating peer connection');
    }
}

function onmessage(event) {
    try {
        const message = JSON.parse(event.data);
        console.log('received message : ', message);
        const type = message['type'];
        const payload = message['payload'];

        switch (type) {

            case TYPE_HEARTBEAT: {
                // console.log('received heartbeat');
                break;
            }

            case TYPE_ROOM_INFO: {
                sessionId = payload['sessionId'];
                isHost = payload['isHost'];
                break;
            }

            case TYPE_RTC_MESSAGE: {


            }
        }

    } catch (err) {
        console.error('onmessage error : ', err);
    }
}

function validateInputs() {

    let roomId = document.getElementById('input-roomid').value;
    let name = document.getElementById('input-name').value;
    if (roomId === '' || name === '') {
        throw Error('roomId or name fields are mandatory');
    }
    return [roomId, name];
}

async function initConnection() {

    // create local stream
    localStream = await initLocalStream();
    let videoElement = document.getElementById('video-player-1');
    if (videoElement !== null) {
        videoElement.srcObject = localStream;
    }

    wsocket = await createConnection();
    heartBeatHandler = setInterval(() => {
        wsocket.send(JSON.stringify({
            type: TYPE_HEARTBEAT,
        }));
    }, 10000);
}

async function createRoom() {
    try {
        [roomId, displayName] = validateInputs();
        console.log(`roomId : ${roomId}, name: ${displayName}`);
        await initConnection();

        wsocket.send(JSON.stringify({
            type: TYPE_CREATE_ROOM,
            payload: {
                roomId: roomId,
                name: displayName,
            }
        }));

        document.getElementById('btn-create-room').disabled = true;
        document.getElementById('btn-join-room').disabled = true;

    } catch (err) {
        console.error('error in creating room : ', err);
    }
}

async function joinRoom() {
    try {
        [roomId, displayName] = validateInputs();
        console.log(`roomId : ${roomId}, name: ${displayName}`);
        await initConnection();

        wsocket.send(JSON.stringify({
            type: TYPE_JOIN_ROOM,
            payload: {
                roomId: roomId,
                name: displayName,
            }
        }));

        document.getElementById('btn-create-room').disabled = true;
        document.getElementById('btn-join-room').disabled = true;

    } catch (err) {
        console.error('error in joining room', err);
    }
}

async function init() {
    document.getElementById('btn-create-room').addEventListener('click', createRoom);
    document.getElementById('btn-join-room').addEventListener('click', joinRoom);
}

init();