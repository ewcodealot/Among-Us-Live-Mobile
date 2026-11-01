//Variables
var inGame = false;

//Elements
const gameCode = document.getElementById("gameCode");
const joinForm = document.getElementById("joinForm");

//Event Listeners
joinForm.addEventListener('submit', function(e) {
    e.preventDefault();
    joinLobby();
});

// In player.js
const socket = io('http://localhost:80');

function joinLobby() {
    const name = document.getElementById('playerName').value.trim();
    const code = document.getElementById('gameCode').value.trim().toUpperCase();

    if (!name || !code) {
        alert("Please enter a name and room code!");
        return;
    }

    socket.emit('player:join_game', { roomCode: code, playerName: name });
}

socket.on('join_success', (data) => {
    document.getElementById('joinForm').style.display = 'none';
    //document.getElementById('playerWaitingLobby').style.display = 'block';
    document.getElementById('heading').textContent = 'Waiting for Game to Start';
});

socket.on('update_player_list', (players) => {
    const list = document.getElementById('connectedPlayers');
    if (!list) return;
    list.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        list.appendChild(li);
    });
});

socket.on('error_message', (msg) => {
    alert(msg);
});