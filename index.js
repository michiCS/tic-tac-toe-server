
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

let id = 0;
let rooms = [];

io.on("connection", (socket) => {
    console.log("a user connected");

    socket.on("createGame", data => {
        
        let roomId = generateRoomId();
        console.log("Created " + data.username + " [" + roomId + "]");
        rooms[roomId] = {
            tiles: Array(9).fill(""),
            player1: data.username,
            player2: "",
            status: "waiting",
            again: 0
        };
        socket.join(roomId);
        console.log(rooms[roomId].tiles);
        socket.emit("newGame", { player1: data.username, roomId: roomId, tiles: rooms[roomId].tiles });
    });

    socket.on("joinGame", data => {
        console.log("Trying to join room " + data.roomId)
        console.log(io.nsps["/"].adapter.rooms);
        let room = io.nsps["/"].adapter.rooms[data.roomId];
        console.log(room);
        if (room && room.length === 1) {

            let starting = Math.random() >= 0.5;
            rooms[data.roomId].player2 = data.username;
            rooms[data.roomId].status = "running";
            socket.join(data.roomId);
            socket.broadcast.to(data.roomId).emit("player1", { player2: data.username, starting });
            socket.emit("player2", { player2: data.username, player1: rooms[data.roomId].player1, roomId: data.roomId, starting: !starting });
            console.log("seems legit");

        } else {
            console.log("error");
            socket.emit("err", "The room is already full!");
        }
    });

    socket.on("makeMove", data => {
        console.log("Trying " + data.symbol + " on " + data.idx + " in " + data.roomId);
        console.log(rooms[data.roomId].status);
        if (data.symbol !== "" && data.idx >= 0 && rooms[data.roomId].status === "running") {
            if (!rooms[data.roomId].tiles[data.idx]) {
                rooms[data.roomId].tiles.splice(data.idx, 1, data.symbol);
                socket.broadcast.to(data.roomId).emit("turn", { tiles: rooms[data.roomId].tiles });

                if (checkForWin(data.roomId)) {
                    rooms[data.roomId].status = "finished";
                    socket.emit("win");
                    socket.broadcast.to(data.roomId).emit("lose");
                }
            }

        } 
    })

    socket.on("playAgain", data => {
        console.log("Decision: " + data.result + " " + data.roomId);
        if(data.result) {   
            rooms[data.roomId].again++;
            if(rooms[data.roomId].again === 2) {
                console.log("we want to play again");
                rooms[data.roomId].tiles = Array(9).fill("");
                rooms[data.roomId].status = "running";
                rooms[data.roomId].again = 0;
                io.in(data.roomId).emit("again", {result: true, tiles: rooms[data.roomId].tiles});
            }
        } else {
            rooms.splice(data.roomId, 1);
            io.in(data.roomId).emit("again", {result: false, tiles: Array(9).fill("")});
            io.of("/").in(data.roomId).clients((err, clients) => {
                clients.forEach(x => {
                    console.log(x);
                    io.sockets.sockets[x].leave(data.roomId);
                });
            });
            console.log(io.of("/").in(data.roomId).clients.length + " CLIENTS");
            console.log(io.nsps["/"].adapter.rooms);
        }
    })
});

const checkForWin = (room) => {

    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        if (
            rooms[room].tiles[a] &&
            rooms[room].tiles[a] === rooms[room].tiles[b] &&
            rooms[room].tiles[a] === rooms[room].tiles[c]
        ) {
            return true;
        }
    }
    return false;
}

const generateRoomId = () =>  {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < 5; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

http.listen(port);

