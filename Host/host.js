const socket = io();

const hostForm = document.getElementById('hostForm');
const hostLobby = document.getElementById('hostLobby');
const displayCode = document.getElementById('displayCode');
const playerList = document.getElementById('playerList');

hostForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const roomCode = document.getElementById('gameCode').value.trim().toUpperCase();
    const fileInput = document.getElementById('gameFile').files[0];

    if (!roomCode || !fileInput) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const gameConfig = JSON.parse(e.target.result);

            socket.emit('host:create_game', { roomCode, config: gameConfig });
        } catch (err) {
            alert("Invalid JSON configuration file!");
        }
    };
    reader.readAsText(fileInput);
});

socket.on('game_created_success', (data) => {
    hostForm.style.display = 'none';
    hostLobby.style.display = 'block';
    displayCode.textContent = data.roomCode;
});

function triggerStartGame() {
    socket.emit('host:start_game', { roomCode: displayCode.textContent });
}

socket.on('update_player_list', (players) => {
    playerList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `👤 ${p.name}`;
        li.style.fontSize = '1.2rem';
        playerList.appendChild(li);
    });
});