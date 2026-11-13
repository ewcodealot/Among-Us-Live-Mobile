//Variables
var inGame = false;
let currentRole = null;
let currentTeam = null;
let currentPlayerId = null;
let knownPlayers = [];
let selectedPlayerColor;
let isWaitingLobby = false;
let currentMeetingPhase = 'none';
let selectedVoteId = null;
let voteSubmitted = false;
let voteSubmitting = false;
let voteRevealIndex = 0;
let voteRevealTimer = null;
const { getPlayerTextColor, isValidPlayerColor, randomPlayerColor } = window.PlayerColors;

//Elements
const gameCode = document.getElementById("gameCode");
const joinForm = document.getElementById("joinForm");
const playerNameInput = document.getElementById('playerName');
const playerColor = document.getElementById('playerColor');
const playerColorSelect = document.getElementById('playerColorSelect');

function colorStorageKey(name) {
    return `amongUsLive:playerColor:${name.trim().toLowerCase()}`;
}

function getMutedPlayerColor(color) {
    const channels = color.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16));
    return `#${channels.map((channel) =>
        Math.round(channel * 0.4 + 17 * 0.6).toString(16).padStart(2, '0')
    ).join('')}`;
}

function updatePageBackground(color) {
    if (isValidPlayerColor(color)) {
        document.body.style.backgroundColor = getMutedPlayerColor(color);
    }
}

function applyPlayerColor(element, color) {
    if (!isValidPlayerColor(color)) return;

    element.classList.add('player-entry');
    element.style.backgroundColor = color;
    element.style.color = getPlayerTextColor(color);
}

selectedPlayerColor = randomPlayerColor();
playerColorSelect.value = selectedPlayerColor;

if (playerNameInput.value.trim()) {
    const storedColor = localStorage.getItem(colorStorageKey(playerNameInput.value));
    if (isValidPlayerColor(storedColor)) {
        selectedPlayerColor = storedColor;
        playerColorSelect.value = storedColor;
    }
}
updatePageBackground(selectedPlayerColor);

playerNameInput.addEventListener('input', () => {
    const storedColor = localStorage.getItem(colorStorageKey(playerNameInput.value));
    if (!isValidPlayerColor(storedColor)) return;

    selectedPlayerColor = storedColor;
    playerColorSelect.value = storedColor;
    updatePageBackground(selectedPlayerColor);
});

playerColorSelect.addEventListener('input', () => {
    if (!isValidPlayerColor(playerColorSelect.value)) {
        playerColorSelect.value = selectedPlayerColor;
        document.getElementById('playerColorHint').textContent =
            'That color is too light. Please choose a darker shade.';
        return;
    }

    selectedPlayerColor = playerColorSelect.value;
    document.getElementById('playerColorHint').textContent = '';
    updatePageBackground(selectedPlayerColor);
    const name = playerNameInput.value.trim();
    if (name) {
        localStorage.setItem(colorStorageKey(name), selectedPlayerColor);
    }
    if (isWaitingLobby) {
        socket.emit('player:update_color', { color: selectedPlayerColor });
    }
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

//Event Listeners
joinForm.addEventListener('submit', function(e) {
    e.preventDefault();
    joinLobby();
});

// In player.js
const socket = io();

function joinLobby() {
    const name = playerNameInput.value.trim();
    const code = document.getElementById('gameCode').value.trim().toUpperCase();

    if (!name || !code) {
        alert("Please enter a name and room code!");
        return;
    }

    localStorage.setItem(colorStorageKey(name), selectedPlayerColor);
    socket.emit('player:join_game', {
        roomCode: code,
        playerName: name,
        playerColor: selectedPlayerColor
    });
}

function renderPlayerLists() {
    const aliveList = document.getElementById('playerKnownListAlive');
    const deadList = document.getElementById('playerKnownListDead');
    aliveList.replaceChildren();
    deadList.replaceChildren();

    knownPlayers.forEach((player) => {
        const item = document.createElement('li');
        item.textContent = player.name;
        applyPlayerColor(item, player.color);
        (player.dead ? deadList : aliveList).appendChild(item);
    });

    const playersPanel = document.getElementById('playersList');
    if (playersPanel.style.maxHeight) {
        playersPanel.style.maxHeight = `${playersPanel.scrollHeight}px`;
    }

    const currentPlayer = knownPlayers.find((player) => player.id === currentPlayerId);
    const canKill = currentRole === 'Impostor' && currentPlayer && !currentPlayer.dead;
    const canSabotage = currentTeam === 'Impostor' &&
        currentPlayer && sabotages.length > 0;
    document.getElementById('killPlayer').style.display = canKill ? 'flex' : 'none';
    document.getElementById('sabotageButton').style.display = canSabotage ? 'flex' : 'none';
    document.getElementById('emergencyMeeting').style.display =
        currentPlayer && !currentPlayer.dead ? 'flex' : 'none';
    document.getElementById('bodyFound').style.display =
        currentPlayer && !currentPlayer.dead ? 'flex' : 'none';

    if (!canKill) {
        closeKillPlayerPicker();
    }
    if (!canSabotage) {
        closeSabotagePicker();
    }

    const bodyFoundPicker = document.getElementById('bodyFoundPicker');
    if (bodyFoundPicker.getAttribute('aria-hidden') === 'false') {
        renderBodyFoundPicker();
    }

    renderVotePlayerList();
}

function renderVotePlayerList() {
    const list = document.getElementById('votePlayerList');
    if (!list) return;

    const heading = document.getElementById('voteScreenHeading');
    const currentPlayer = knownPlayers.find((player) => player.id === currentPlayerId);
    const canVote = Boolean(currentPlayer && !currentPlayer.dead);
    if (currentMeetingPhase === 'results') return;

    list.replaceChildren();
    if (currentMeetingPhase !== 'voting') return;

    if (!canVote) {
        heading.textContent = 'You are dead, you may not vote.';
        list.style.display = 'none';
        return;
    }

    heading.textContent = voteSubmitted ? 'Vote submitted' : 'Pick the Impostor';
    list.style.display = 'grid';
    if (selectedVoteId !== null && selectedVoteId !== 'skip' &&
        !knownPlayers.some((player) =>
            player.id === selectedVoteId && player.connected && !player.dead
        )) {
        selectedVoteId = null;
    }

    const createVoteOption = ({ player, isSkip = false }) => {
        const item = document.createElement('li');
        const isDead = player?.dead === true;
        const isSelected = selectedVoteId === (isSkip ? 'skip' : player.id);
        const isDisabled = !canVote || isDead || voteSubmitted || voteSubmitting;
        item.textContent = isSkip ? 'Skip Vote' : player.name;
        item.classList.add('vote-option');
        item.classList.toggle('vote-option-alive', !isDead && !isSkip);
        item.classList.toggle('vote-option-dead', isDead);
        item.classList.toggle('vote-option-skip', isSkip);
        item.classList.toggle('vote-option-selected', isSelected);
        item.setAttribute('role', 'button');
        item.setAttribute('aria-pressed', String(isSelected));
        item.setAttribute('aria-disabled', String(isDisabled));
        item.tabIndex = isDisabled ? -1 : 0;

        if (isSkip) {
            item.style.backgroundColor = '#000000';
        } else {
            applyPlayerColor(item, isDead ? getMutedPlayerColor(player.color) : player.color);
        }

        const selectVote = () => {
            if (isDisabled) return;
            selectedVoteId = isSkip ? 'skip' : player.id;
            renderVotePlayerList();
            openVoteConfirmPopup();
        };
        item.addEventListener('click', selectVote);
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectVote();
            }
        });
        list.appendChild(item);
    };

    knownPlayers
        .filter((player) => player.id !== currentPlayerId && player.connected)
        .forEach((player) => createVoteOption({ player }));
    createVoteOption({ isSkip: true });
}

function openVoteConfirmPopup() {
    const popup = document.getElementById('voteConfirmPopup');
    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');
}

function closeVoteConfirmPopup() {
    const popup = document.getElementById('voteConfirmPopup');
    popup.style.display = 'none';
    popup.setAttribute('aria-hidden', 'true');
}

function submitVote() {
    if (voteSubmitted || voteSubmitting || currentMeetingPhase !== 'voting' ||
        selectedVoteId === null) return;

    voteSubmitting = true;
    document.getElementById('confirmVoteYes').disabled = true;
    document.getElementById('confirmVoteNo').disabled = true;
    socket.emit('player:cast_vote', selectedVoteId === 'skip'
        ? { skip: true }
        : { targetId: selectedVoteId });
}

function showVotingResults(results) {
    clearTimeout(voteRevealTimer);
    voteRevealIndex = 0;

    const list = document.getElementById('votePlayerList');
    const heading = document.getElementById('voteScreenHeading');
    list.replaceChildren();
    list.style.display = 'grid';

    const currentPlayerResult = results.players.find((player) => player.name ===
        knownPlayers.find((player) => player.id === currentPlayerId)?.name);
    heading.textContent = currentPlayerResult?.tied
        ? `You tied with ${currentPlayerResult.votes} votes`
        : `You got ${currentPlayerResult?.votes ?? 0} votes`;

    const revealItems = results.players.map((result) => ({
        ...result,
        isSkip: false
    }));
    revealItems.push({
        name: 'Skip Vote',
        votes: results.skipVotes,
        tied: results.skipTied === true,
        isSkip: true
    });

    const revealResult = (result) => {
        const item = document.createElement('li');
        const player = knownPlayers.find((knownPlayer) => knownPlayer.name === result.name);
        item.className = 'vote-option vote-result';
        item.textContent = result.tied
            ? `${result.name} tied with ${result.votes} votes`
            : `${result.name} got ${result.votes} votes`;
        if (result.isSkip) {
            item.classList.add('vote-option-skip');
            item.style.backgroundColor = '#000000';
        } else if (player) {
            applyPlayerColor(item, player.dead
                ? getMutedPlayerColor(player.color)
                : player.color);
            item.classList.add(player.dead ? 'vote-option-dead' : 'vote-option-alive');
        }
        list.appendChild(item);
    };

    const interval = Number.isFinite(results.revealIntervalMs) && results.revealIntervalMs > 0
        ? results.revealIntervalMs
        : 2000;
    const elapsed = Math.max(0, results.revealElapsedMs || 0);
    voteRevealIndex = Math.min(revealItems.length, Math.floor(elapsed / interval) + 1);
    revealItems.slice(0, voteRevealIndex).forEach(revealResult);

    if (voteRevealIndex < revealItems.length) {
        const nextRevealAt = (Math.floor(elapsed / interval) + 1) * interval;
        voteRevealTimer = setTimeout(() => {
            revealResult(revealItems[voteRevealIndex++]);
            const revealNextResult = () => {
                if (voteRevealIndex >= revealItems.length) return;
                revealResult(revealItems[voteRevealIndex++]);
                voteRevealTimer = setTimeout(revealNextResult, interval);
            };
            if (voteRevealIndex < revealItems.length) {
                voteRevealTimer = setTimeout(revealNextResult, interval);
            }
        }, Math.max(0, nextRevealAt - elapsed));
    }
}

document.getElementById('confirmVoteYes').addEventListener('click', submitVote);
document.getElementById('confirmVoteNo').addEventListener('click', () => {
    if (voteSubmitting || voteSubmitted) return;
    closeVoteConfirmPopup();
    selectedVoteId = null;
    renderVotePlayerList();
});

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
        applyPlayerColor(button, player.color);
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
    closeActionsDropdown();
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

function renderBodyFoundPicker() {
    const list = document.getElementById('bodyFoundPlayerList');
    list.replaceChildren();

    const eligiblePlayers = knownPlayers.filter((player) =>
        player.name && player.id !== currentPlayerId && !player.dead
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
        applyPlayerColor(button, player.color);
        button.addEventListener('click', () => {
            list.querySelectorAll('button').forEach((targetButton) => {
                targetButton.disabled = true;
            });
            socket.emit('player:report_body', { targetName: player.name });
        });
        item.appendChild(button);
        list.appendChild(item);
    });
}

function bodyFound() {
    closeActionsDropdown();
    const currentPlayer = knownPlayers.find((player) => player.id === currentPlayerId);
    if (!currentPlayer || currentPlayer.dead) return;

    renderBodyFoundPicker();
    const picker = document.getElementById('bodyFoundPicker');
    picker.style.display = 'flex';
    picker.setAttribute('aria-hidden', 'false');
}

function closeBodyFoundPicker() {
    const picker = document.getElementById('bodyFoundPicker');
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
    closeActionsDropdown();
    const currentPlayer = knownPlayers.find((player) => player.id === currentPlayerId);
    if (currentTeam !== 'Impostor' || !currentPlayer) return;

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

function closeActionsDropdown() {
    const actionsTab = document.getElementById('actionsTab');
    actionsTab.classList.remove('active');
    document.getElementById('actions').style.maxHeight = null;
}

function updatePlayerRole(role) {
    currentRole = role;
    if (role !== 'Dead') currentTeam = role;
    document.getElementById('roleDisplay').textContent = role;

    const isDead = role === 'Dead';
    const isDeadImpostor = isDead && currentTeam === 'Impostor';
    const canShowActions = !isDead || isDeadImpostor;
    document.getElementById('actionsTab').style.display = canShowActions ? '' : 'none';
    document.getElementById('actions').style.display = canShowActions ? '' : 'none';
    document.getElementById('emergencyMeeting').style.display = isDead ? 'none' : 'flex';
    document.getElementById('bodyFound').style.display = isDead ? 'none' : 'flex';
    document.getElementById('killPlayer').style.display = role === 'Impostor' ? 'flex' : 'none';
    document.getElementById('sabotageButton').style.display =
        currentTeam === 'Impostor' && sabotages.length > 0 ? 'flex' : 'none';

    if (isDead) {
        closeKillPlayerPicker();
        closeBodyFoundPicker();
        if (!isDeadImpostor) closeSabotagePicker();
    }
}

socket.on('join_success', (data) => {
    document.getElementById('joinForm').style.display = 'none';
    isWaitingLobby = data.status === 'lobby';
    playerColor.style.display = isWaitingLobby ? 'flex' : 'none';
    document.getElementById('heading').textContent = isWaitingLobby
        ? "You're In! Waiting for Game to Start"
        : "You're In!";
    if (isValidPlayerColor(data.color)) {
        selectedPlayerColor = data.color;
        playerColorSelect.value = data.color;
        updatePageBackground(data.color);
        localStorage.setItem(colorStorageKey(playerNameInput.value), data.color);
    }
});

socket.on('update_player_list', (players) => {
    const list = document.getElementById('connectedPlayers');
    if (!list) return;
    list.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        applyPlayerColor(li, p.color);
        list.appendChild(li);
    });
});

socket.on('game_started', (data) => {
    isWaitingLobby = false;
    playerColor.style.display = 'none';
    sabotages = Array.isArray(data.sabotages) ? data.sabotages : [];
    currentTeam = data.team || data.role;
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

socket.on('player:report_result', ({ success, message }) => {
    if (success) {
        closeBodyFoundPicker();
        return;
    }

    alert(message);
    renderBodyFoundPicker();
});

socket.on('player:vote_result', ({ success, message, votedFor }) => {
    voteSubmitting = false;
    document.getElementById('confirmVoteYes').disabled = false;
    document.getElementById('confirmVoteNo').disabled = false;
    if (currentMeetingPhase !== 'voting') {
        closeVoteConfirmPopup();
        return;
    }

    if (success) {
        voteSubmitted = true;
        selectedVoteId = votedFor;
        closeVoteConfirmPopup();
        renderVotePlayerList();
        return;
    }

    closeVoteConfirmPopup();
    alert(message);
    renderVotePlayerList();
});

socket.on('player:vote_status', ({ hasVoted, votedFor }) => {
    voteSubmitted = hasVoted === true;
    selectedVoteId = voteSubmitted ? votedFor : null;
    renderVotePlayerList();
});

socket.on('voting:results', (results) => {
    if (currentMeetingPhase !== 'results' || !Array.isArray(results?.players)) return;
    showVotingResults(results);
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

socket.on('player:died', ({ team } = {}) => {
    if (team) currentTeam = team;
    updatePlayerRole('Dead');
    document.getElementById('deadPopupTitle').textContent = 'You are Dead!';
    document.getElementById('deadPopupMessage').textContent =
        'Stay here until you are found. You may not talk or vote.';
    document.getElementById('deadPopup').style.display = 'flex';
    document.getElementById('deadPopup').setAttribute('aria-hidden', 'false');
});

document.getElementById('confirmDead').addEventListener('click', () => {
    document.getElementById('deadPopup').style.display = 'none';
    document.getElementById('deadPopup').setAttribute('aria-hidden', 'true');
});

socket.on('player:voted_out', ({ role }) => {
    currentTeam = role;
    updatePlayerRole('Dead');
    document.getElementById('deadPopupTitle').textContent = 'You have been voted out';
    document.getElementById('deadPopupMessage').textContent = role === 'Impostor'
        ? 'Sabotage to win'
        : 'Complete tasks to win';
    document.getElementById('deadPopup').style.display = 'flex';
    document.getElementById('deadPopup').setAttribute('aria-hidden', 'false');
});

function emergencyMeeting() {
    closeActionsDropdown();
    socket.emit('player:emergency_meeting');
}

socket.on('meeting:state', ({ active, phase, type, bodyName, reporterName }) => {
    const emergencyPopup = document.getElementById('emergencyPopup');
    const bodyFoundPopup = document.getElementById('bodyFoundPopup');
    const showBodyFound = active && type === 'body_found';
    const voteScreen = document.getElementById('voteScreen');
    const nextPhase = phase || (active ? 'meeting' : 'none');

    emergencyPopup.style.display = active && !showBodyFound ? 'flex' : 'none';
    emergencyPopup.setAttribute('aria-hidden', String(!(active && !showBodyFound)));
    bodyFoundPopup.style.display = showBodyFound ? 'flex' : 'none';
    bodyFoundPopup.setAttribute('aria-hidden', String(!showBodyFound));

    if (nextPhase === 'meeting' || (nextPhase === 'voting' && currentMeetingPhase !== 'voting')) {
        selectedVoteId = null;
        voteSubmitted = false;
        voteSubmitting = false;
        closeVoteConfirmPopup();
    }
    if (nextPhase !== 'voting') {
        voteSubmitting = false;
        closeVoteConfirmPopup();
    }
    currentMeetingPhase = nextPhase;

    const showVoteScreen = currentMeetingPhase === 'voting' || currentMeetingPhase === 'results';
    voteScreen.style.display = showVoteScreen ? 'flex' : 'none';
    voteScreen.setAttribute('aria-hidden', String(!showVoteScreen));
    if (currentMeetingPhase === 'voting') {
        renderVotePlayerList();
    } else if (currentMeetingPhase === 'results') {
        clearTimeout(voteRevealTimer);
        voteRevealIndex = 0;
        document.getElementById('votePlayerList').replaceChildren();
        document.getElementById('votePlayerList').style.display = 'grid';
        document.getElementById('voteScreenHeading').textContent = 'Voting Results';
    } else {
        clearTimeout(voteRevealTimer);
        voteRevealIndex = 0;
        document.getElementById('votePlayerList').replaceChildren();
        document.getElementById('voteScreenHeading').textContent = 'Pick the Impostor';
    }

    if (showBodyFound) {
        document.getElementById('bodyFoundMessage').textContent =
            `${bodyName}'s body was found by ${reporterName}. Meet at ${bodyName}. You will vote after.`;
        closeBodyFoundPicker();
        closeKillPlayerPicker();
        closeSabotagePicker();
    }
});

socket.on('error_message', (msg) => {
    alert(msg);
});