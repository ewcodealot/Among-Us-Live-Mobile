const socket = io();

const hostForm = document.getElementById('hostForm');
const hostLobby = document.getElementById('hostLobby');
const displayCode = document.getElementById('displayCode');
const playerList = document.getElementById('playerList');
const emergencyMeetingButton = document.getElementById('hostEmergencyMeeting');
const completeSabotageButton = document.getElementById('hostCompleteSabotage');
let resultsContinueTimeout = null;
const { getPlayerTextColor, isValidPlayerColor } = window.PlayerColors;

function applyPlayerColor(element, color) {
    if (!isValidPlayerColor(color)) return;

    element.classList.add('player-entry');
    element.style.backgroundColor = color;
    element.style.color = getPlayerTextColor(color);
}

emergencyMeetingButton.addEventListener('click', () => {
    socket.emit('host:meeting_toggle', { roomCode: displayCode.textContent });
});

completeSabotageButton.addEventListener('click', () => {
    socket.emit('host:complete_sabotage', { roomCode: displayCode.textContent });
});

hostForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const roomCode = document.getElementById('gameCode').value.trim().toUpperCase();
    const fileInput = document.getElementById('gameFile').files[0];

    if (!roomCode) return;
    if (!fileInput) {
        socket.emit('host:create_game', { roomCode });
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const gameConfig = JSON.parse(e.target.result);

            socket.emit('host:create_game', { roomCode, config: gameConfig });
        } catch (err) {
            alert("Invalid JSON configuration file!");
        }
    };
    reader.onerror = () => alert('Could not read the configuration file.');
    reader.readAsText(fileInput);
});

socket.on('game_created_success', (data) => {
    hostForm.style.display = 'none';
    hostLobby.style.display = 'block';
    displayCode.textContent = data.roomCode;
});

socket.on('error_message', (message) => {
    alert(message);
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
        applyPlayerColor(li, p.color);
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

socket.on('meeting:state', ({ phase, active }) => {
    clearTimeout(resultsContinueTimeout);
    resultsContinueTimeout = null;
    const currentPhase = phase || (active ? 'meeting' : 'none');
    emergencyMeetingButton.textContent = currentPhase === 'meeting'
        ? 'End Meeting (Start Voting)'
        : currentPhase === 'voting'
            ? 'End Voting'
            : currentPhase === 'results'
                ? 'Continue Past Results'
            : 'Emergency Meeting';
    emergencyMeetingButton.disabled = currentPhase === 'results';
});

socket.on('voting:results', (results) => {
    if (!Array.isArray(results?.players)) return;
    const revealCount = results.players.length + 1;
    const interval = Number.isFinite(results.revealIntervalMs) ? results.revealIntervalMs : 2000;
    const elapsed = Number.isFinite(results.revealElapsedMs) ? results.revealElapsedMs : 0;
    const delay = Math.max(0, (revealCount - 1) * interval - elapsed);
    resultsContinueTimeout = setTimeout(() => {
        emergencyMeetingButton.disabled = false;
        resultsContinueTimeout = null;
    }, delay);
});

socket.on('sabotage:state', ({ active }) => {
    completeSabotageButton.disabled = !active;
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