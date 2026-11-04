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
    const activeGamePlayers = document.getElementById('activeGamePlayers');
    playerList.replaceChildren();
    activeGamePlayers.replaceChildren();

    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        li.style.fontSize = '1.2rem';
        playerList.appendChild(li);
        activeGamePlayers.appendChild(li.cloneNode(true));
    });
});

socket.on('game:update', (update) => {
    if (!update || typeof update.message !== 'string') return;

    const listItem = document.createElement('li');
    const timestamp = document.createElement('time');
    const now = new Date();
    timestamp.dateTime = now.toISOString();
    timestamp.textContent = now.toLocaleTimeString();
    listItem.append(timestamp, document.createTextNode(` ${update.message}`));

    const updateList = document.getElementById('updateList');
    updateList.appendChild(listItem);
    const gameUpdates = document.getElementById('gameUpdates');
    gameUpdates.scrollTop = gameUpdates.scrollHeight;
});

socket.on('host:started_game', (data) => {
    hostLobby.style.display = 'none';
    hostForm.style.display = 'none';
    document.getElementById('activeGameView').style.display = 'block';
    document.getElementById('activeGameRoomCode').textContent = `Room Code: ${data.roomCode}`;
});

//Collapsibles
var col = document.getElementsByClassName("collapsibleButton");

for (var i = 0; i < col.length; i++) {
  col[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var content = this.nextElementSibling;
    if (content.style.maxHeight){
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
}