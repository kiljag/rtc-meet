
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

        videoElement = document.getElementById('video-player-2');
        if (videoElement !== null) {
            videoElement.srcObject = remoteStream;
        }

    } catch (err) {
        console.error('error in creating peer connection');
    }
}

async function setIceCandidateHandler() {
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            console.log('sending ice candidate');
            wsocket.send(JSON.stringify({
                type: TYPE_RTC_MESSAGE,
                payload: {
                    'ice': JSON.stringify(event.candidate),
                }
            }));
        }
    }
}

async function createOffer() {
    try {
        await createPeerConnection();
        const offer = await peerConnection.createOffer();
        peerConnection.setLocalDescription(offer);
        wsocket.send(JSON.stringify({
            type: TYPE_RTC_MESSAGE,
            payload: {
                'offer': JSON.stringify(offer),
            }
        }));
        setIceCandidateHandler();

    } catch (err) {
        console.error('error creating offer : ', err);
    }
}

async function processOffer(offer) {
    try {
        await createPeerConnection();
        peerConnection.setRemoteDescription(JSON.parse(offer));
        const answer = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answer);
        wsocket.send(JSON.stringify({
            type: TYPE_RTC_MESSAGE,
            payload: {
                'answer': JSON.stringify(answer),
            }
        }));
        setIceCandidateHandler();

    } catch (err) {
        console.error('error processing offer ', err);
    }
}

async function processAnswer(answer) {
    try {
        peerConnection.setRemoteDescription(JSON.parse(answer));

    } catch (err) {
        console.error('error processing answer ', err);
    }
}

async function processIceCandidate(ice) {
    try {
        let candidate = JSON.parse(ice);
        console.log('candidate : ', candidate);
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

    } catch (err) {
        console.error('error processing ice candidate ', err);
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

            case TYPE_BOTH_JOINED: {
                if (isHost) {
                    createOffer();
                }
                break;
            }

            case TYPE_RTC_MESSAGE: {
                let offer = payload['offer'];
                let answer = payload['answer'];
                let ice = payload['ice'];

                if (offer !== undefined) {
                    processOffer(offer);
                }
                else if (answer !== undefined) {
                    processAnswer(answer);
                }
                else if (ice !== undefined) {
                    processIceCandidate(ice);
                }
                break;
            }

            default: {
                console.log('invlaid type : ', type);
                break;
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
    wsocket.onmessage = onmessage;
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

let screenIsShared = false;

async function startScreenCapture() {
    try {
        const options = {
            video: {
                cursor: 'always',
            },
            audio: false,
        }

        let videoElement = document.getElementById('video-share-screen');
        let stream = await navigator.mediaDevices.getDisplayMedia(options);
        videoElement.srcObject = stream;
        stream.getTracks().forEach((track) => {
            console.log(track);
        });

        if (peerConnection !== null) {
            stream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, stream);
            });
        }

        screenIsShared = true;

    } catch (err) {
        console.error('error in starting screen capture', err);
    }
}

async function stopScreenCapture() {
    try {
        let videoElement = document.getElementById('video-share-screen');
        let tracks = videoElement.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoElement.srcObject = null;
        screenIsShared = false;

    } catch (err) {
        console.log('error in stopping screen capture', err);
    }
}

async function toggleScreenShare() {
    try {
        if (!screenIsShared) {
            await startScreenCapture();
            screenIsShared = true;
        } else {
            await stopScreenCapture();
            screenIsShared = false;
        }

    } catch (err) {
        console.log('error in toggling screen share', err);
    }
}

async function init() {
    document.getElementById('btn-create-room').addEventListener('click', createRoom);
    document.getElementById('btn-join-room').addEventListener('click', joinRoom);
    document.getElementById('btn-share-screen').addEventListener('click', toggleScreenShare);
}

init();