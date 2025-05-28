# ChatterBox Backend API Documentation

## Overview
ChatterBox is a real-time chat application backend built with Node.js, Express, and Socket.IO. This backend provides APIs for user authentication, room management, and real-time messaging features.

## Base URL
```
http://localhost:5000/api
```

## Authentication
All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### Authentication

#### Register User
- **URL**: `/auth/register`
- **Method**: `POST`
- **Request Body**:
```json
{
    "username": "string",
    "email": "string",
    "password": "string",
    "displayName": "string"
}
```
- **Response**:
```json
{
    "success": true,
    "data": {
        "_id": "string",
        "username": "string",
        "email": "string",
        "displayName": "string",
        "avatar": "string",
        "token": "string"
    }
}
```

#### Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Request Body**:
```json
{
    "email": "string",
    "password": "string"
}
```
- **Response**:
```json
{
    "success": true,
    "data": {
        "_id": "string",
        "username": "string",
        "email": "string",
        "displayName": "string",
        "avatar": "string",
        "token": "string"
    }
}
```

#### Update Profile
- **URL**: `/auth/profile`
- **Method**: `PUT`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
```
displayName: string (optional)
avatar: File (optional)
currentPassword: string (optional)
newPassword: string (optional)
```
- **Response**:
```json
{
    "success": true,
    "message": "Profile updated successfully",
    "data": {
        "_id": "string",
        "username": "string",
        "displayName": "string",
        "email": "string",
        "avatar": "string",
        "token": "string"
    }
}
```

### Rooms

#### Create Room
- **URL**: `/rooms`
- **Method**: `POST`
- **Request Body**:
```json
{
    "name": "string",
    "description": "string (optional)",
    "isPublic": "boolean",
    "accessCode": "string (required if isPublic is false)"
}
```
- **Response**:
```json
{
    "success": true,
    "data": {
        "_id": "string",
        "name": "string",
        "description": "string",
        "creator": {
            "_id": "string",
            "displayName": "string"
        },
        "isPublic": "boolean",
        "status": "string",
        "participants": []
    }
}
```

#### Get All Rooms
- **URL**: `/rooms`
- **Method**: `GET`
- **Response**:
```json
{
    "success": true,
    "data": [
        {
            "_id": "string",
            "name": "string",
            "description": "string",
            "creator": {
                "_id": "string",
                "displayName": "string"
            },
            "isPublic": "boolean",
            "status": "string",
            "participants": [
                {
                    "user": {
                        "_id": "string",
                        "displayName": "string"
                    },
                    "role": "string"
                }
            ]
        }
    ]
}
```

#### Get Room by ID
- **URL**: `/rooms/:id`
- **Method**: `GET`
- **Response**:
```json
{
    "success": true,
    "data": {
        "_id": "string",
        "name": "string",
        "description": "string",
        "creator": {
            "_id": "string",
            "displayName": "string"
        },
        "isPublic": "boolean",
        "status": "string",
        "participants": [],
        "messages": [
            {
                "sender": {
                    "_id": "string",
                    "displayName": "string"
                },
                "content": "string",
                "timestamp": "date"
            }
        ]
    }
}
```

#### Join Room
- **URL**: `/rooms/:id/join`
- **Method**: `POST`
- **Request Body**:
```json
{
    "accessCode": "string (required for private rooms)"
}
```
- **Response**:
```json
{
    "success": true,
    "message": "Joined room successfully",
    "data": {
        "_id": "string",
        "name": "string",
        "participants": []
    }
}
```

#### Leave Room
- **URL**: `/rooms/:id/leave`
- **Method**: `POST`
- **Response**:
```json
{
    "success": true,
    "message": "Left room successfully"
}
```

#### Update Room Status
- **URL**: `/rooms/:id/status`
- **Method**: `PUT`
- **Request Body**:
```json
{
    "status": "string (live/inactive)"
}
```
- **Response**:
```json
{
    "success": true,
    "data": {
        "_id": "string",
        "name": "string",
        "status": "string"
    }
}
```

## WebSocket Events

### Room Events

#### Join Room
- **Event**: `joinRoom`
- **Emit Data**:
```json
{
    "roomId": "string"
}
```
- **Response Event**: `userJoined`
- **Response Data**:
```json
{
    "userId": "string",
    "displayName": "string",
    "roomId": "string"
}
```

#### Leave Room
- **Event**: `leaveRoom`
- **Emit Data**:
```json
{
    "roomId": "string"
}
```
- **Response Event**: `userLeft`
- **Response Data**:
```json
{
    "userId": "string",
    "displayName": "string",
    "roomId": "string"
}
```

### Chat Events

#### Send Message
- **Event**: `chat-message`
- **Emit Data**:
```json
{
    "roomId": "string",
    "userId": "string",
    "displayName": "string",
    "message": "string",
    "timestamp": "date"
}
```
- **Response Event**: `chatMessage`
- **Response Data**:
```json
{
    "userId": "string",
    "displayName": "string",
    "message": "string",
    "timestamp": "date"
}
```

## Error Responses
All API endpoints return error responses in the following format:
```json
{
    "success": false,
    "message": "Error message description"
}
```

Common HTTP Status Codes:
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting
- API requests are limited to 100 requests per IP per 15 minutes
- Socket events are rate-limited to prevent spam:
  - Chat messages: 1 message per second
  - Room join/leave: 5 requests per minute

## File Upload Limits
- Avatar images: Max 5MB, formats: JPG, PNG, GIF
- File uploads in chat: Not supported in current version 