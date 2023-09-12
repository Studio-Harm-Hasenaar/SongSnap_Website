const Express = require('express');
const app = new Express();
var http = require('https').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

app.use(Express.static(__dirname + '/public/'));


app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/:ID', function(req, res) {
    //res.sendFile(__dirname + '/index.html?ID=' + req.params.ID);
    res.sendFile(__dirname + '/public/index.html');
});

connectedSockets = new Array();
var gameReferencesDictionary = new Object();

//Something connected to the server
io.on('connection', function(socket) {

    //Communicate from game to specific client
    socket.on("CommunicateGameToMobile", function(data) {
        var messageName = data['MessageName']; //The message to communicate
        var messageData = data['MessageData']; //Any data the message should contain
        var receiver = data['Receiver']; //The receiving socketID

        messageData = messageData.replace(/#/gi, '"');
        console.log("Game > Mobile Send '" + messageName + "' with data '" + messageData + "' to '" + receiver + "'");
        io.to(receiver).emit(messageName, messageData);
    });

    //Communicate from client to game by roomnumber
    socket.on("CommunicateMobileToGame", function(data) {

        var messageName = data['MessageName']; //The message to communicate
        var messageData = data['MessageData']; //Any data the message should contain
        var roomNumber = data['RoomName']; //The receiving socketID

        console.log("Mobile > Game Send '" + messageName + "' with data '" + messageData + "' to '" + gameReferencesDictionary[roomNumber] + "'");

        if (messageData == "")
            io.to(gameReferencesDictionary[roomNumber]).emit(messageName);
        else {
            console.log("messageData: " + messageData);
            var jsonData = JSON.parse(messageData);
            console.log("jsonData: " + jsonData);
            io.to(gameReferencesDictionary[roomNumber]).emit(messageName, jsonData);
        }
    });

    //Register a socket (This can be a game or a mobile)
    socket.on("RegisterGame", function(data) {

        //Add the socket to the correct room
        RegisterSocket(socket, data['clientType'], data['roomName'], "");
        gameReferencesDictionary[data['roomName']] = socket.id;
    });

    //A room number has been entered, check if the server needs to register this socket
    socket.on("roomNumberEntered", function(data) {
        //A mobile has entered a room number, check if there is a room to connect to
        var roomNumber = data['roomNumber'];
        console.log("Mobile user wants to connect to room: " + roomNumber + ", with name: " + data['userName']);

        errorMessage = "noGame";
        if (connectedSockets.some(item => item.roomName === roomNumber)) {
            errorMessage = "noGame";
            //Check if the connection is a game connection                
            if (connectedSockets.some(item => item.clientType === "Game")) {
                //There is a game going and a room with this id to join.

                var userNameError = "";
                var userNameToCheck = data['userName'];

                if (userNameToCheck == "unset") userNameError = ""; //The username is not set
                else if (userNameToCheck == "") userNameError = "noName"; //The username is empty = 'noName'
                else if (userNameToCheck.length > 20) userNameError = "nameTooLong"; //The username is over X characters = 'nameTooLong'
                else if (!isValidString(userNameToCheck)) userNameError = "unknownCharacters"; //The username contains invalid characters = 'unknownCharacters'
                else if (UserNameExistsInRoom(userNameToCheck, roomNumber)) userNameError = "nameTaken"; //The username is taken by another user in the same room = 'nameTaken'

                errorMessage = "";
                console.log("userNameError for user " + userNameToCheck + ": " + userNameError);
                if (userNameError == "") {
                    //Username is valid, register user
                    RegisterSocket(socket, "Mobile", roomNumber, userNameToCheck);
                } else {
                    //There is an error with the username, show the error
                    socket.emit("declined", userNameError);
                }
            }
        }
        if (data['roomNumber'] == null)
            errorMessage = "noRoomNumber";
        if (errorMessage != "") {
            //No game found to join, show on mobile
            socket.emit("ErrorConnectingToGame", { msg: errorMessage });
        }
    });

    //Something disconnected from the server,
    //Check if the game was disconnected and if so, remove all mobiles in that room
    socket.on("disconnect", function() {
        var reloadGame = false;
        var reference = connectedSockets.find(item => item.socket === socket);
        if (reference) {
            var roomName = reference.roomName;
            if (reference.clientType === "Game") {
                delete gameReferencesDictionary[roomName];
                reloadGame = true;
                for (var j = 0; j < connectedSockets; j++) {
                    if (connectedSockets[j].roomName == connectedSockets[i].roomName) {
                        //Remove any clients that were in that room
                        connectedSockets[j].socket.disconnect();
                        connectedSockets = connectedSockets.filter(item => item !== connectedSockets[j])
                    }
                }
            }
            connectedSockets = connectedSockets.filter(item => item !== reference)
            SendConnectedSocketsToGame(roomName, reloadGame);
        }
    });
});

//Register a socket to the server in the correct room
function RegisterSocket(socketref, _clientType, _roomName, _userName) {

    console.log("Register " + _clientType + ": " + _userName);
    var newSocket = { socket: socketref, socketID: socketref.id, clientType: _clientType, roomName: _roomName, userName: _userName };
    var alreadyConnected = false;
    for (var i = 0; i < connectedSockets.length; i++) {
        if (connectedSockets[i].socketID == newSocket.socketID) {
            //Allready connected so just update the username
            connectedSockets[i].userName = _userName;
            alreadyConnected = true;
        }
    }
    if (!alreadyConnected) {
        connectedSockets.push(newSocket);
        socketref.join(_roomName);
    }
    SendConnectedSocketsToGame(_roomName, _clientType === 'Game');
}

//Send the connected sockets to the correct unity connection using a room name
function SendConnectedSocketsToGame(roomName, reloadLocation) {

    for (var i = 0; i < connectedSockets.length; i++) {
        console.log("Connected: " + connectedSockets[i].clientType + ", userName:" + connectedSockets[i].userName + ", socket ID: " + connectedSockets[i].socketID);
    }

    //Emit to the entered room the new list of players    
    var roomReferences = connectedSockets.filter(word => word.roomName == roomName)
    gameReference = roomReferences.find(word => word.clientType == 'Game')

    if (roomReferences) {
        if (gameReference) {
            if (roomReferences.length > 0) {
                var userNameArray = [];
                var socketIDArray = [];
                for (var i = 0; i < roomReferences.length; i++) {
                    if (roomReferences[i].clientType != 'Game') {
                        userNameArray.push(roomReferences[i].userName);
                        socketIDArray.push(roomReferences[i].socketID);
                    }
                }
                console.log('updateList with ' + userNameArray.length + " users");
                gameReference.socket.emit('updateList', { clientUserName: userNameArray, socketID: socketIDArray });
            }
        }

        if (reloadLocation) {
            console.log("Reload all connected mobiles: " + roomReferences.length);
            for (var i = 0; i < roomReferences.length; i++) {
                if (roomReferences[i].clientType != 'Game') {
                    roomReferences[i].socket.emit('ReloadLocation');
                }
            }
        }
    }
}

function UserNameExistsInRoom(userNameToCheck, roomToCheck) {
    var userNameExists = false;
    //Check 'userNameToCheck' in room 'roomToCheck'
    var roomReferences = connectedSockets.filter(word => word.roomName == roomToCheck)

    if (roomReferences) {
        if (roomReferences.length > 0) {
            for (var i = 0; i < roomReferences.length; i++) {
                if (roomReferences[i].clientType != 'Game') {
                    if (userNameToCheck == roomReferences[i].userName)
                        userNameExists = true;
                }
            }
        }
    }
    return userNameExists;
}

function isValidString(str) {
    return !/[~`!#$%\^&*+=\-\[\]\\'/\s/g;,/{}|\\":<>\?]/g.test(str);
}

//http.listen(port, function() {
//    console.log('listening on *:' + port);
//});
app.listen(port);