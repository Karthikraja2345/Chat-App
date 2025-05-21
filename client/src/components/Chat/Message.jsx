// // client/src/components/Chat/Message.jsx
// import React from 'react';
// import './Message.css'; // CSS import

// const Message = ({ message, currentUser }) => {
//     if (!message || !message.content) return null; // Basic validation

//     if (message.isSystemMessage || message.type === 'system') {
//         return (
//             <div className="message-row system-message-row">
//                 <div className="message-content system-message-content">
//                     <p className="message-text">{message.content.text}</p>
//                     {/* <span className="message-timestamp system-timestamp">
//                         {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                     </span> */}
//                 </div>
//             </div>
//         );
//     }

//     const isSender = message.sender && currentUser && message.sender._id === currentUser._id;
//     const messageClass = isSender ? 'sent' : 'received';

//     return (
//         <div className={`message-row ${messageClass}-row`}>
//             {!isSender && message.sender && (
//                 <img src={message.sender.profilePicture || '/default-avatar.png'} alt={message.sender.name || 'User'} className="avatar message-avatar" />
//             )}
//             <div className={`message-content ${messageClass}-content`}>
//                 {!isSender && message.sender && <p className="sender-name">{message.sender.name || 'Unknown User'}</p>}
//                 <p className="message-text">{message.content.text}</p>
//                 <div className="message-metadata">
//                     <span className="message-timestamp">
//                         {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                     </span>
//                     {isSender && message.status && (
//                         <span className={`message-status status-${message.status.toLowerCase()}`}>
//                             {/* {message.status} Simple status or icons */}
//                             {/* Tick icons can go here based on status */}
//                         </span>
//                     )}
//                 </div>
//             </div>
//             {isSender && currentUser && ( // Display current user's avatar for sent messages
//                  <img src={currentUser.profilePicture || '/default-avatar.png'} alt={currentUser.name} className="avatar message-avatar" />
//             )}
//         </div>
//     );
// };

// export default Message;