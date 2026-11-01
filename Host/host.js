const socket = io('http://localhost:80');

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

            // Send game creation request to backend
            socket.emit('host:create_game', { roomCode, config: gameConfig });
        } catch (err) {
            alert("Invalid JSON configuration file!");
        }
    };
    reader.readAsText(fileInput);
});

// 1. When game creation succeeds:
socket.on('game_created_success', (data) => {
    // Hide creation form, show active lobby
    hostForm.style.display = 'none';
    hostLobby.style.display = 'block';
    displayCode.textContent = data.roomCode;
});

// 2. Listen for joining players and update host screen live
socket.on('update_player_list', (players) => {
    playerList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `👤 ${p.name}`;
        li.style.fontSize = '1.2rem';
        playerList.appendChild(li);
    });
});