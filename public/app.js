const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const status = document.getElementById('status');
const startCallBtn = document.getElementById('startCall');
const endCallBtn = document.getElementById('endCall');
let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function startCall() {
    if (peerConnection) {
        console.warn('Peer connection already exists. Ending previous call.');
        endCall();  // Ensure any existing peer connection is cleaned up
    }

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(config);
    peerConnection.addStream(localStream);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };

    peerConnection.onaddstream = (event) => {
        remoteVideo.srcObject = event.stream;
    };

    peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
            const remoteStream = event.streams[0];
            const audioTracks = remoteStream.getAudioTracks();
            if (audioTracks.length > 0) {
                status.textContent = 'Connected with a stranger.';
                startCallBtn.style.display = 'none';
                endCallBtn.style.display = 'inline-block';
            } else {
                status.textContent = 'No audio tracks found.';
            }
        } else {
            status.textContent = 'No remote stream found.';
        }
    };

    socket.on('offer', async (offer) => {
        try {
            if (peerConnection.signalingState === 'stable') {
                console.warn('Signaling state is stable. Ignoring offer.');
                return;
            }
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer', answer);
            status.textContent = 'Connected with a stranger.';
            startCallBtn.style.display = 'none';
            endCallBtn.style.display = 'inline-block';
        } catch (error) {
            console.error('Error handling offer:', error);
            status.textContent = 'Failed to handle offer.';
        }
    });

    socket.on('answer', async (answer) => {
        try {
            if (peerConnection.signalingState === 'stable') {
                console.warn('Signaling state is stable. Ignoring answer.');
                return;
            }

            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            status.textContent = 'Connected with a stranger.';

        } catch (error) {
            console.error('Error handling answer:', error);
            status.textContent = 'Failed to handle answer.';
        }
    });

    socket.on('ice-candidate', (candidate) => {
        // status.textContent = 'Connected with a stranger.';
        try {
            if (peerConnection) {
                // Check if the signaling state allows adding ICE candidates
                if (peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-local-pranswer' || peerConnection.signalingState === 'have-remote-offer') {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                        .catch(error => {
                            console.error('Error adding ICE candidate:', error);
                        });
                } else {
                    console.warn('Signaling state is not appropriate for adding ICE candidate:', peerConnection.signalingState);
                }
             } 
             else {
                console.warn('Signaling state is stable. Ignoring ICE candidate.');
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
            // peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    socket.on('disconnect-call', () => {
        endCall();  // Ensure cleanup on disconnect signal
    });
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
    status.textContent = 'Waiting for a connection...';
    startCallBtn.style.display = 'none';
    endCallBtn.style.display = 'inline-block';
}

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        status.textContent = 'Click "Start Call" to connect...';
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        status.textContent = 'Stranger left.';
    }
    status.textContent = 'Click "Start Call" to connect...';
    startCallBtn.style.display = 'inline-block';
    endCallBtn.style.display = 'none';

    socket.emit('disconnect-call');
}

startCallBtn.addEventListener('click', startCall);
endCallBtn.addEventListener('click', endCall);