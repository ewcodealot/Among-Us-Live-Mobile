//Variables
var inGame = false;

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
    document.getElementById('gameplayView').style.display = 'block';
    document.getElementById('main').style.display = 'none';
    document.getElementById('header').style.display = 'none';

    const roleDisplay = document.getElementById('roleDisplay');
    roleDisplay.textContent = data.role;

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
        li.innerHTML = `<input type="checkbox" class="taskCheckbox"><strong>${task.title}</strong><br><small>${task.description}</small><br><em>Hint: ${task.hint}</em>`;
        taskListElement.appendChild(li);
        const checkbox = li.querySelector('.taskCheckbox');
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