const socket = io();

const hostForm = document.getElementById('hostForm');
const hostLobby = document.getElementById('hostLobby');
const displayCode = document.getElementById('displayCode');
const playerList = document.getElementById('playerList');
const emergencyMeetingButton = document.getElementById('hostEmergencyMeeting');
const completeSabotageButton = document.getElementById('hostCompleteSabotage');
let resultsContinueTimeout = null;
let gameResultCooldownTimer = null;
let gameAnalyticsBlob = null;
let gameAnalyticsFilename = '';
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

socket.on('game:ended', ({ title, message } = {}) => {
    clearTimeout(resultsContinueTimeout);
    clearInterval(gameResultCooldownTimer);
    resultsContinueTimeout = null;
    emergencyMeetingButton.disabled = true;
    completeSabotageButton.disabled = true;

    document.getElementById('gameResultTitle').textContent = title || 'Game Over';
    document.getElementById('gameResultMessage').textContent = message || 'The game has ended.';
    const continueButton = document.getElementById('confirmGameResult');
    let secondsRemaining = 10;
    continueButton.disabled = true;
    continueButton.textContent = `Continue (${secondsRemaining})`;
    gameResultCooldownTimer = setInterval(() => {
        secondsRemaining--;
        if (secondsRemaining <= 0) {
            clearInterval(gameResultCooldownTimer);
            gameResultCooldownTimer = null;
            continueButton.disabled = false;
            continueButton.textContent = 'Continue';
            return;
        }
        continueButton.textContent = `Continue (${secondsRemaining})`;
    }, 1000);
    const popup = document.getElementById('gameResultPopup');
    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');
});

document.getElementById('confirmGameResult').addEventListener('click', () => {
    if (document.getElementById('confirmGameResult').disabled) return;
    const popup = document.getElementById('gameResultPopup');
    popup.style.display = 'none';
    popup.setAttribute('aria-hidden', 'true');
    window.location.reload();
});

function downloadGameAnalytics() {
    if (!gameAnalyticsBlob) return;

    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(gameAnalyticsBlob);
    downloadLink.download = gameAnalyticsFilename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(downloadLink.href), 1000);
}

document.getElementById('downloadGameAnalytics').addEventListener('click', downloadGameAnalytics);

socket.on('host:game_analytics', (analytics) => {
    if (!analytics || typeof analytics !== 'object') return;

    const clean = (value) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
    const durationSeconds = Number(analytics.durationMs) / 1000;
    const lines = [
        'Among Us Live - Game Analytics',
        `Room: ${clean(analytics.roomCode)}`,
        `Started: ${clean(analytics.startedAt)}`,
        `Ended: ${clean(analytics.endedAt)}`,
        `Duration: ${durationSeconds.toFixed(1)} seconds`,
        `Winner: ${clean(analytics.winner)} (${clean(analytics.endReason)})`,
        `Players in game: ${clean(analytics.playerCount)}`,
        `Total votes cast: ${clean(analytics.totalVotes)}`,
        '',
        `Players (${Array.isArray(analytics.players) ? analytics.players.length : 0}):`
    ];

    (Array.isArray(analytics.players) ? analytics.players : []).forEach((player, index) => {
        lines.push(
            `${index + 1}. ${clean(player.name)} | Role: ${clean(player.role)} | ` +
            `Connected: ${player.connected ? 'Yes' : 'No'} | Dead: ${player.dead ? 'Yes' : 'No'} | ` +
            `Voted out: ${player.votedOut ? 'Yes' : 'No'} | Tasks: ${clean(player.tasksCompleted)}/${clean(player.taskCount)}`
        );
    });

    const voteHistory = Array.isArray(analytics.voteHistory) ? analytics.voteHistory : [];
    lines.push('', `Voting history (${voteHistory.length} meetings):`);
    voteHistory.forEach((meeting) => {
        lines.push(`Meeting ${clean(meeting.meeting)} - ${clean(meeting.recordedAt)}`);
        const votes = Array.isArray(meeting.votes) ? meeting.votes : [];
        votes.forEach((vote) => lines.push(`  ${clean(vote.voter)} voted for ${clean(vote.target)}`));
        const tally = Array.isArray(meeting.tally) ? meeting.tally : [];
        tally.forEach((entry) => lines.push(`  ${clean(entry.name)}: ${clean(entry.votes)} vote(s)`));
        lines.push(`  Skip votes: ${clean(meeting.skipVotes)}`);
        lines.push(`  Tied: ${meeting.tied ? 'Yes' : 'No'}`);
        lines.push(`  Eliminated: ${clean(meeting.eliminated || 'Nobody')}`);
    });

    const killHistory = Array.isArray(analytics.killHistory) ? analytics.killHistory : [];
    lines.push('', `Kills (${killHistory.length}):`);
    killHistory.forEach((kill) =>
        lines.push(`  ${clean(kill.timestamp)} - ${clean(kill.impostor)} killed ${clean(kill.target)}`)
    );

    const activityLog = Array.isArray(analytics.activityLog) ? analytics.activityLog : [];
    lines.push('', 'Activity log:');
    activityLog.forEach((entry) =>
        lines.push(`  ${clean(entry.timestamp)} - ${clean(entry.message)}`)
    );

    gameAnalyticsBlob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const fileRoomCode = clean(analytics.roomCode).replace(/[^a-z0-9_-]/gi, '_');
    gameAnalyticsFilename = `among-us-live-${fileRoomCode}-analytics.txt`;
    document.getElementById('downloadGameAnalytics').disabled = false;
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