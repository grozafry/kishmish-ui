import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// const socket = io('http://localhost:4000');
const socket = io('http://43.204.130.30:4000');
// const socket = io('https://kishmishbck.vercel.app', {
//   transports: ['websocket'] // Force WebSocket and disable polling
// });

const INTERESTS = ['Music', 'Movies', 'Sports', 'Gaming', 'Travel', 'Food', 'Technology', 'Art'];

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [status, setStatus] = useState('connecting');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [partnerId, setPartnerId] = useState(null);
  const messagesEndRef = useRef(null);

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
    });

    return () => {
      socket.off('waiting');
      socket.off('chat start');
      socket.off('receive message');
      socket.off('partner disconnected');
    };
  }, []);

  useEffect(scrollToBottom, [messages]);

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
  };

  const findNewMatch = () => {
    disconnect();
    startChatting();
  };

  if (status === 'connecting' || status === 'waiting') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Random Chat App</h1>
          <div className={`status ${status}`}>Status: {status}</div>
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
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Random Chat App</h1>
        <div className={`status ${status}`}>Status: {status}</div>
      </header>
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
        </div>
      </div>
    </div>
  );
}

export default App;