import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, TextField, Button, Paper, Typography, Avatar, 
  List, ListItem, ListItemAvatar, ListItemText, 
  Badge, IconButton, Popover, Divider, Tooltip
} from '@mui/material';
import { 
  Send, InsertEmoticon, People, 
  ThumbUp, Mood, Favorite, SentimentSatisfiedAlt 
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: '#44b700',
    color: '#44b700',
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
  }
}));

const EmojiPicker = ({ onSelect }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const emojis = ['👍', '❤️', '😊', '😂', '😍', '😎'];

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEmojiSelect = (emoji) => {
    onSelect(emoji);
    handleClose();
  };

  return (
    <>
      <IconButton onClick={handleClick}>
        <InsertEmoticon />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
          {emojis.map((emoji) => (
            <IconButton key={emoji} onClick={() => handleEmojiSelect(emoji)}>
              {emoji}
            </IconButton>
          ))}
        </Box>
      </Popover>
    </>
  );
};

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [userColor, setUserColor] = useState('#000000');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [ws, setWs] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Connect to WebSocket
  useEffect(() => {
    const name = localStorage.getItem('chat-username') || `User-${Math.floor(Math.random() * 1000)}`;
    setUsername(name);
    
    const wsUrl = process.env.NODE_ENV === 'development' 
      ? 'ws://localhost:8080' 
      : 'wss://your-production-url.com';
    
    const socket = new WebSocket(wsUrl);
    setWs(socket);

    socket.onopen = () => {
      console.log('Connected to WebSocket');
      socket.send(JSON.stringify({
        type: 'set-username',
        data: name
      }));
    };

    socket.onmessage = (e) => {
      const message = JSON.parse(e.data);
      switch (message.type) {
        case 'init':
          setUserId(message.data.userId);
          setUserColor(message.data.userColor);
          setMessages(message.data.history);
          setOnlineUsers(message.data.onlineUsers);
          break;
          
        case 'new-message':
          setMessages(prev => [...prev, message.data]);
          break;
          
        case 'user-joined':
          setOnlineUsers(prev => [...prev, message.data]);
          break;
          
        case 'user-left':
          setOnlineUsers(prev => prev.filter(user => user.id !== message.data.userId));
          break;
          
        case 'user-updated':
          setOnlineUsers(prev => 
            prev.map(user => user.id === message.data.userId ? message.data : user)
          );
          break;
          
        case 'typing-users':
          setTypingUsers(message.data);
          break;
          
        case 'message-reaction':
          setMessages(prev => 
            prev.map(msg => 
              msg.id === message.data.messageId 
                ? { ...msg, reactions: message.data.reactions } 
                : msg
            )
          );
          break;
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing indicator
  const handleTyping = useCallback((typing) => {
    setIsTyping(typing);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'typing',
        data: typing
      }));
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (typing) {
      typingTimeoutRef.current = setTimeout(() => {
        handleTyping(false);
      }, 3000);
    }
  }, [ws]);

  // Send message
  const sendMessage = () => {
    if (!messageInput.trim() || !ws) return;

    ws.send(JSON.stringify({
      type: 'message',
      data: messageInput
    }));
    setMessageInput('');
    handleTyping(false);
  };

  // Handle reaction to message
  const handleReact = (messageId, reaction) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'react',
        data: { messageId, reaction }
      }));
    }
  };

  // Update username
  const updateUsername = (newName) => {
    if (newName && ws && ws.readyState === WebSocket.OPEN) {
      setUsername(newName);
      localStorage.setItem('chat-username', newName);
      ws.send(JSON.stringify({
        type: 'set-username',
        data: newName
      }));
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh',
      bgcolor: 'background.default'
    }}>
      {/* Online Users Panel */}
      <Box sx={{ 
        width: 250, 
        p: 2, 
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: { xs: 'none', md: 'block' }
      }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          <People sx={{ verticalAlign: 'middle', mr: 1 }} />
          Online Users ({onlineUsers.length})
        </Typography>
        <List>
          {onlineUsers.map(user => (
            <ListItem key={user.id} sx={{ px: 0 }}>
              <ListItemAvatar>
                <StyledBadge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                >
                  <Avatar sx={{ 
                    bgcolor: user.color,
                    width: 32, 
                    height: 32,
                    fontSize: '0.8rem'
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </Avatar>
                </StyledBadge>
              </ListItemAvatar>
              <ListItemText 
                primary={user.name} 
                primaryTypographyProps={{ noWrap: true }} 
              />
              {typingUsers.includes(user.id) && (
                <Mood color="primary" fontSize="small" />
              )}
            </ListItem>
          ))}
        </List>
      </Box>
      
      {/* Main Chat Area */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        maxHeight: '100vh'
      }}>
        {/* Messages */}
        <Box sx={{ 
          flex: 1, 
          p: 2, 
          overflowY: 'auto',
          bgcolor: 'background.paper'
        }}>
          {messages.map((message) => (
            <Box 
              key={message.id} 
              sx={{ 
                mb: 2, 
                display: 'flex',
                flexDirection: message.userId === userId ? 'row-reverse' : 'row'
              }}
            >
              <Box sx={{ 
                maxWidth: '70%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: message.userId === userId ? 'flex-end' : 'flex-start'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Avatar sx={{ 
                    bgcolor: message.userColor,
                    width: 24, 
                    height: 24,
                    fontSize: '0.7rem',
                    mr: 1
                  }}>
                    {message.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="caption" color="text.secondary">
                    {message.username}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
                <Paper
                  elevation={1}
                  sx={{
                    p: 1.5,
                    bgcolor: message.userId === userId ? 'primary.light' : 'background.default',
                    color: message.userId === userId ? 'primary.contrastText' : 'text.primary',
                    borderRadius: message.userId === userId 
                      ? '18px 18px 4px 18px' 
                      : '18px 18px 18px 4px'
                  }}
                >
                  <Typography>{message.text}</Typography>
                  {Object.keys(message.reactions || {}).length > 0 && (
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 0.5, 
                      mt: 0.5,
                      justifyContent: message.userId === userId ? 'flex-end' : 'flex-start'
                    }}>
                      {Object.entries(message.reactions).map(([reaction, count]) => (
                        <Tooltip key={reaction} title={`${count} ${count > 1 ? 'people' : 'person'}`}>
                          <Box 
                            onClick={() => handleReact(message.id, reaction)}
                            sx={{ 
                              cursor: 'pointer',
                              bgcolor: 'background.paper',
                              borderRadius: '10px',
                              px: 0.5,
                              fontSize: '0.8rem'
                            }}
                          >
                            {reaction} {count > 1 ? count : ''}
                          </Box>
                        </Tooltip>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Box>
            </Box>
          ))}
          
          {/* Typing indicators */}
          {typingUsers.length > 0 && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mb: 2,
              pl: 6
            }}>
              <Avatar sx={{ 
                bgcolor: onlineUsers.find(u => u.id === typingUsers[0])?.color || '#ccc',
                width: 24, 
                height: 24,
                fontSize: '0.7rem',
                mr: 1
              }}>
                {onlineUsers.find(u => u.id === typingUsers[0])?.username.charAt(0).toUpperCase() || '?'}
              </Avatar>
              <Paper
                elevation={1}
                sx={{
                  p: 1,
                  bgcolor: 'background.default',
                  borderRadius: '18px 18px 18px 4px'
                }}
              >
                <Box sx={{ display: 'flex' }}>
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    bgcolor: 'text.secondary',
                    borderRadius: '50%',
                    m: 0.5,
                    animation: 'typing 1.4s infinite ease-in-out',
                    '&:nth-of-type(1)': { animationDelay: '0s' },
                    '&:nth-of-type(2)': { animationDelay: '0.2s' },
                    '&:nth-of-type(3)': { animationDelay: '0.4s' },
                    '@keyframes typing': {
                      '0%, 60%, 100%': { transform: 'translateY(0)' },
                      '30%': { transform: 'translateY(-5px)' }
                    }
                  }} />
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    bgcolor: 'text.secondary',
                    borderRadius: '50%',
                    m: 0.5,
                    animation: 'typing 1.4s infinite ease-in-out',
                    animationDelay: '0.2s'
                  }} />
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    bgcolor: 'text.secondary',
                    borderRadius: '50%',
                    m: 0.5,
                    animation: 'typing 1.4s infinite ease-in-out',
                    animationDelay: '0.4s'
                  }} />
                </Box>
              </Paper>
            </Box>
          )}
          
          <div ref={messagesEndRef} />
        </Box>
        
        {/* Message Input */}
        <Box sx={{ 
          p: 2, 
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {isTyping ? 'You are typing...' : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                if (e.target.value && !isTyping) {
                  handleTyping(true);
                } else if (!e.target.value && isTyping) {
                  handleTyping(false);
                }
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your message..."
              multiline
              maxRows={4}
            />
            <EmojiPicker onSelect={(emoji) => setMessageInput(prev => prev + emoji)} />
            <Button
              variant="contained"
              color="primary"
              onClick={sendMessage}
              disabled={!messageInput.trim()}
              sx={{ minWidth: 'auto' }}
            >
              <Send />
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatApp;