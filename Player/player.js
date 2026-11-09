//Variables
var inGame = false;
let currentRole = null;
let currentPlayerId = null;
let knownPlayers = [];

//Elements
const gameCode = document.getElementById("gameCode");
const joinForm = document.getElementById("joinForm");

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

//Event Listeners
joinForm.addEventListener('submit', function(e) {
    e.preventDefault();
    joinLobby();
});

// In player.js
const socket = io();

function joinLobby() {
    const name = document.getElementById('playerName').value.trim();
    const code = document.getElementById('gameCode').value.trim().toUpperCase();

    if (!name || !code) {
        alert("Please enter a name and room code!");
        return;
    }

    socket.emit('player:join_game', { roomCode: code, playerName: name });
}

function renderPlayerLists() {
    const aliveList = document.getElementById('playerKnownListAlive');
    const deadList = document.getElementById('playerKnownListDead');
    aliveList.replaceChildren();
    deadList.replaceChildren();

    knownPlayers.forEach((player) => {
        const item = document.createElement('li');
        item.textContent = player.name;
        (player.dead ? deadList : aliveList).appendChild(item);
    });

    const playersPanel = document.getElementById('playersList');
    if (playersPanel.style.maxHeight) {
        playersPanel.style.maxHeight = `${playersPanel.scrollHeight}px`;
    }

    const currentPlayer = knownPlayers.find((player) => player.id === currentPlayerId);
    const canKill = currentRole === 'Impostor' && currentPlayer && !currentPlayer.dead;
    const canSabotage = canKill && sabotages.length > 0;
    document.getElementById('killPlayer').style.display = canKill ? 'flex' : 'none';
    document.getElementById('sabotageButton').style.display = canSabotage ? 'flex' : 'none';

    if (!canKill) {
        closeKillPlayerPicker();
    }
    if (!canSabotage) {
        closeSabotagePicker();
    }
}

function renderKillPlayerPicker() {
    const list = document.getElementById('killPlayerList');
    list.replaceChildren();

    const eligiblePlayers = knownPlayers.filter((player) =>
        player.connected && player.canBeKilled && !player.dead &&
        player.id && player.id !== currentPlayerId
    );

    if (eligiblePlayers.length === 0) {
        const item = document.createElement('li');
        item.textContent = 'No players available';
        list.appendChild(item);
        return;
    }

    eligiblePlayers.forEach((player) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kill-player-target';
        button.textContent = player.name;
        button.addEventListener('click', () => {
            list.querySelectorAll('button').forEach((targetButton) => {
                targetButton.disabled = true;
            });
            socket.emit('player:kill_player', { targetId: player.id });
        });
        item.appendChild(button);
        list.appendChild(item);
    });
}

function killPlayer() {
    const currentPlayer = knownPlayers.find((player) => player.id === currentPlayerId);
    if (currentRole !== 'Impostor' || !currentPlayer || currentPlayer.dead) return;

    renderKillPlayerPicker();
    const picker = document.getElementById('killPlayerPicker');
    picker.style.display = 'flex';
    picker.setAttribute('aria-hidden', 'false');
}

function closeKillPlayerPicker() {
    const picker = document.getElementById('killPlayerPicker');
    picker.style.display = 'none';
    picker.setAttribute('aria-hidden', 'true');
}

var sabotages = [];

function renderSabotagePicker() {
    const list = document.getElementById('sabotageList');
    list.replaceChildren();

    sabotages.forEach((sabotage) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sabotage-target';
        button.textContent = sabotage.title;
        button.addEventListener('click', () => {
            list.querySelectorAll('button').forEach((targetButton) => {
                targetButton.disabled = true;
            });
            socket.emit('player:sabotage', { sabotageId: sabotage.id });
        });
        item.appendChild(button);
        list.appendChild(item);
    });
}

function sabotage() {
    const currentPlayer = knownPlayers.find((player) => player.id === currentPlayerId);
    if (currentRole !== 'Impostor' || !currentPlayer || currentPlayer.dead) return;

    renderSabotagePicker();
    const picker = document.getElementById('sabotagePicker');
    picker.style.display = 'flex';
    picker.setAttribute('aria-hidden', 'false');
}

function closeSabotagePicker() {
    const picker = document.getElementById('sabotagePicker');
    picker.style.display = 'none';
    picker.setAttribute('aria-hidden', 'true');
}

function updatePlayerRole(role) {
    currentRole = role;
    document.getElementById('roleDisplay').textContent = role;

    const isDead = role === 'Dead';
    document.getElementById('actionsTab').style.display = isDead ? 'none' : '';
    document.getElementById('actions').style.display = isDead ? 'none' : '';
    document.getElementById('killPlayer').style.display = role === 'Impostor' ? 'flex' : 'none';
    document.getElementById('sabotageButton').style.display =
        role === 'Impostor' && sabotages.length > 0 ? 'flex' : 'none';

    if (isDead) {
        closeKillPlayerPicker();
        closeSabotagePicker();
    }
}

socket.on('join_success', (data) => {
    document.getElementById('joinForm').style.display = 'none';
    //document.getElementById('playerWaitingLobby').style.display = 'block';
    document.getElementById('heading').textContent = "You're In! Waiting for Game to Start";
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

socket.on('game_started', (data) => {
    sabotages = Array.isArray(data.sabotages) ? data.sabotages : [];
    updatePlayerRole(data.role);

    document.getElementById('gameplayView').style.display = 'block';
    document.getElementById('main').style.display = 'none';
    document.getElementById('header').style.display = 'none';

    const taskListElement = document.getElementById('playerTaskList');
    taskListElement.innerHTML = '';

    //if (data.role === 'Impostor') {
    //    roleDisplay.style.color = '#ff0055'; // Red for Impostor
    //} else {
    //    roleDisplay.style.color = '#00ffff'; // Blue for Crewmate
    //}

    data.tasks.forEach(task => {
        const li = document.createElement('li');
        li.style.marginBottom = '15px';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'taskCheckbox';
        const title = document.createElement('strong');
        title.textContent = task.title;
        const description = document.createElement('small');
        description.textContent = task.description;
        const hint = document.createElement('em');
        hint.textContent = `Hint: ${task.hint}`;
        li.append(checkbox, title, document.createElement('br'), description, document.createElement('br'), hint);
        taskListElement.appendChild(li);
        const isCompleted = task.completed === true;
        checkbox.checked = isCompleted;
        checkbox.disabled = isCompleted;
        if (isCompleted) {
            li.style.textDecoration = 'line-through';
        }

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                checkbox.disabled = true;
                li.style.textDecoration = 'line-through';
                console.log(`Player completed task ${task.title}`);
                socket.emit('task:completed', { taskId: task.id });
            }
        });
    });
});

socket.on('players:state', ({ players, playerId }) => {
    knownPlayers = players;
    currentPlayerId = playerId;
    renderPlayerLists();

    const picker = document.getElementById('killPlayerPicker');
    if (picker.getAttribute('aria-hidden') === 'false') {
        renderKillPlayerPicker();
    }

    const sabotagePicker = document.getElementById('sabotagePicker');
    if (sabotagePicker.getAttribute('aria-hidden') === 'false') {
        renderSabotagePicker();
    }
});

socket.on('player:kill_result', ({ success, message }) => {
    if (success) {
        closeKillPlayerPicker();
        return;
    }

    alert(message);
    renderKillPlayerPicker();
});

socket.on('player:sabotage_result', ({ success, message }) => {
    if (success) {
        closeSabotagePicker();
        return;
    }

    alert(message);
    renderSabotagePicker();
});

socket.on('sabotage:started', ({ title, description }) => {
    document.getElementById('sabotageAlertTitle').textContent = title;
    document.getElementById('sabotageAlertDescription').textContent = description;
    const popup = document.getElementById('sabotageAlertPopup');
    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');
});

socket.on('sabotage:completed', ({ title }) => {
    document.getElementById('sabotageAlertTitle').textContent = 'Sabotage Resolved';
    document.getElementById('sabotageAlertDescription').textContent = `${title} has been completed.`;
    const popup = document.getElementById('sabotageAlertPopup');
    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');
});

document.getElementById('confirmSabotageAlert').addEventListener('click', () => {
    const popup = document.getElementById('sabotageAlertPopup');
    popup.style.display = 'none';
    popup.setAttribute('aria-hidden', 'true');
});

socket.on('player:died', () => {
    updatePlayerRole('Dead');
    document.getElementById('deadPopup').style.display = 'flex';
    document.getElementById('confirmDead').addEventListener('click', () => {
        document.getElementById('deadPopup').style.display = 'none';
    });
});

function emergencyMeeting() {
    socket.emit('player:emergency_meeting');
}

socket.on('meeting:state', ({ active }) => {
    const popup = document.getElementById('emergencyPopup');
    popup.style.display = active ? 'flex' : 'none';
    popup.setAttribute('aria-hidden', String(!active));
});

socket.on('error_message', (msg) => {
    alert(msg);
});