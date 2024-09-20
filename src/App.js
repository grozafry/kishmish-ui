import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://192.168.1.2:4000');
// const socket = io('https://localhost:4000');

const INTERESTS = ['Music', 'Movies', 'Sports', 'Gaming', 'Travel', 'Food', 'Technology', 'Art'];

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [partnerId, setPartnerId] = useState(null);
  const [onlineUsersCount, setOnlineUsersCount] = useState(0);
  const [isInVoiceCall, setIsInVoiceCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const messagesEndRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnection = useRef(null);
  const iceCandidatesQueue = useRef([]);

  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    socket.on('waiting', () => setStatus('waiting'));
    socket.on('chat start', (partnerSocketId) => {
      setStatus('chatting');
      setPartnerId(partnerSocketId);
      setMessages([]);
    });
    socket.on('receive message', (message) => {
      setMessages((prevMessages) => [...prevMessages, { text: message, from: 'stranger' }]);
    });
    socket.on('partner disconnected', () => {
      setStatus('waiting');
      setPartnerId(null);
      setMessages([]);
      endVoiceCall();
    });
    socket.on('totalUsersCount', (count) => {
      setOnlineUsersCount(count);
    });

    socket.on('voice-call-incoming', ({ callId }) => {
      if (window.confirm('Incoming voice call. Accept?')) {
        acceptVoiceCall(callId);
      } else {
        socket.emit('voice-call-rejected');
      }
    });

    socket.on('voice-call-connected', ({ callId }) => {
      setIsInVoiceCall(true);
      startCallTimer();
    });

    socket.on('voice-call-ended', () => {
      endVoiceCall();
    });

    socket.on('ice-candidate', handleICECandidate);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);

    return () => {
      socket.off('waiting');
      socket.off('chat start');
      socket.off('receive message');
      socket.off('partner disconnected');
      socket.off('updateOnlineUsers');
      socket.off('voice-call-incoming');
      socket.off('voice-call-connected');
      socket.off('voice-call-ended');
      socket.off('ice-candidate');
      socket.off('offer');
      socket.off('answer');
    };
  }, []);

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const eyes = document.querySelectorAll('.eye');
    
    const moveEyes = (e) => {
      eyes.forEach(eye => {
        const rect = eye.getBoundingClientRect();
        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;
        
        const angle = Math.atan2(e.clientY - eyeCenterY, e.clientX - eyeCenterX);
        
        const distance = Math.min(
          rect.width / 4,
          Math.sqrt(Math.pow(e.clientX - eyeCenterX, 2) + Math.pow(e.clientY - eyeCenterY, 2))
        );
        
        const pupilX = Math.cos(angle) * distance;
        const pupilY = Math.sin(angle) * distance;
        
        const pupil = eye.querySelector('.pupil');
        pupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
      });
    };
  
    document.addEventListener('mousemove', moveEyes);
    
    return () => {
      document.removeEventListener('mousemove', moveEyes);
    };
  }, []);

  const startVoiceCall = async () => {
    try {
      console.log('Starting voice call...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Local stream obtained:', stream);
      localStreamRef.current = stream;
      localAudioRef.current.srcObject = stream;
      console.log('Local audio source set');
  
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      });
      console.log('Peer connection created:', peerConnection.current);
  
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
        console.log('Added track to peer connection:', track);
      });
  
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate:', event.candidate);
          socket.emit('ice-candidate', event.candidate);
        }
      };
  
      peerConnection.current.ontrack = (event) => {
        console.log('Received remote track:', event.streams[0]);
        if (event.streams && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          console.log('Remote audio source set:', remoteAudioRef.current.srcObject);
        } else {
          console.error('No remote streams received');
        }
      };
  
      const offer = await peerConnection.current.createOffer();
      console.log('Created offer:', offer);
      await peerConnection.current.setLocalDescription(offer);
      console.log('Set local description');
      socket.emit('offer', offer);
  
      socket.emit('voice-call-request');
      setIsInVoiceCall(true);
      startCallTimer();
    } catch (error) {
      console.error('Error starting voice call:', error);
    }
  };

  const acceptVoiceCall = async (callId) => {
    try {
      console.log('Accepting voice call...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Local stream obtained:', stream);
      localStreamRef.current = stream;
      localAudioRef.current.srcObject = stream;
      console.log('Local audio source set');
  
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      });
      console.log('Peer connection created:', peerConnection.current);
  
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
        console.log('Added track to peer connection:', track);
      });
  
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate:', event.candidate);
          socket.emit('ice-candidate', event.candidate);
        }
      };
  
      peerConnection.current.ontrack = (event) => {
        console.log('Received remote track:', event.streams[0]);
        if (event.streams && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          console.log('Remote audio source set:', remoteAudioRef.current.srcObject);
        } else {
          console.error('No remote streams received');
        }
      };
  
      // Wait for the offer before creating an answer
      peerConnection.current.onnegotiationneeded = async () => {
        try {
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          socket.emit('offer', offer);
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      };
  
      socket.emit('voice-call-accepted', { callId });
      setIsInVoiceCall(true);
      startCallTimer();
    } catch (error) {
      console.error('Error accepting voice call:', error);
    }
  };

  

  const handleICECandidate = (candidate) => {
    const iceCandidate = new RTCIceCandidate(candidate);
    if (peerConnection.current && peerConnection.current.remoteDescription) {
      peerConnection.current.addIceCandidate(iceCandidate)
        .catch(error => console.error('Error adding ICE candidate:', error));
    } else {
      iceCandidatesQueue.current.push(iceCandidate);
    }
  };

  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
      }
    };

    peerConnection.current.ontrack = (event) => {
      console.log('Received remote track:', event.streams[0]);
      if (event.streams && event.streams.length > 0) {
        remoteAudioRef.current.srcObject = event.streams[0];
        console.log('Remote audio source set:', remoteAudioRef.current.srcObject);
      } else {
        console.error('No remote streams received');
      }
    };
  };

  const handleOffer = async (offer) => {
    try {
      if (!peerConnection.current) {
        createPeerConnection();
      }
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('answer', answer);

      // Add queued ICE candidates
      while (iceCandidatesQueue.current.length) {
        const candidate = iceCandidatesQueue.current.shift();
        await peerConnection.current.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer) => {
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));

      // Add queued ICE candidates
      while (iceCandidatesQueue.current.length) {
        const candidate = iceCandidatesQueue.current.shift();
        await peerConnection.current.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const endVoiceCall = () => {
    console.log('Ending voice call...');
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
      console.log('Peer connection closed');
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped local track:', track);
      });
    }
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
      console.log('Cleared local audio source');
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      console.log('Cleared remote audio source');
    }
    setIsInVoiceCall(false);
    stopCallTimer();
    socket.emit('voice-call-ended');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      console.log('Mute toggled, audio enabled:', audioTrack.enabled);
    }
  };

  const startCallTimer = () => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && status === 'chatting') {
      socket.emit('send message', inputMessage);
      setMessages((prevMessages) => [...prevMessages, { text: inputMessage, from: 'me' }]);
      setInputMessage('');
    }
  };

  const toggleInterest = (interest) => {
    setSelectedInterests(prev => 
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const startChatting = () => {
    socket.emit('set interests', selectedInterests);
    setStatus('finding match');
  };

  const disconnect = () => {
    socket.emit('disconnect partner');
    setStatus('waiting');
    setPartnerId(null);
    setMessages([]);
    endVoiceCall();
  };

  const findNewMatch = () => {
    disconnect();
    startChatting();
  };

  if (status === 'idle' || status === 'waiting') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Kishmish Chat App</h1>
          <div className={`status ${status}`}>Status: {status}</div>
          <div className="online-users">Online Users: {onlineUsersCount}</div>
        </header>
        <div className="interest-selection">
          <h2>Select your interests (optional):</h2>
          <div className="interest-buttons">
            {INTERESTS.map(interest => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={selectedInterests.includes(interest) ? 'selected' : ''}
              >
                {interest}
              </button>
            ))}
          </div>
          <button onClick={startChatting}>
            Start Chatting {selectedInterests.length > 0 ? `(${selectedInterests.length} interests)` : '(No interests)'}
          </button>
        </div>
        <div className="eyes-container">
          <div className="eye"><div className="pupil"></div></div>
          <div className="eye"><div className="pupil"></div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Kishmish Chat App</h1>
        <div className={`status ${status}`}>Status: {status}</div>
        <div className="online-users">Online Users: {onlineUsersCount}</div>
      </header>
      {status === 'chatting' && (
        <div className="chat-container">
          <div className="chat-box">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.from}`}>
                <div className="message-content">{message.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} className="message-form">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={status !== 'chatting'}
            />
            <button type="submit" disabled={status !== 'chatting'}>Send</button>
          </form>
          <div className="chat-actions">
            <button onClick={disconnect}>Disconnect</button>
            <button onClick={findNewMatch}>Find New Match</button>
            {!isInVoiceCall && <button onClick={startVoiceCall}>Start Voice Call</button>}
            {isInVoiceCall && (
              <>
                <button onClick={endVoiceCall}>End Voice Call</button>
                <button onClick={toggleMute}>{isMuted ? 'Unmute' : 'Mute'}</button>
                <span>Call Duration: {formatDuration(callDuration)}</span>
              </>
            )}
          </div>
          <div className="audio-container" style={{display: 'none'}}>
            <audio ref={localAudioRef} muted />
            <audio ref={remoteAudioRef} autoPlay />
          </div>
        </div>
      )}
      <div className="eyes-container">
        <div className="eye"><div className="pupil"></div></div>
        <div className="eye"><div className="pupil"></div></div>
      </div>
    </div>
  );
}

export default App;