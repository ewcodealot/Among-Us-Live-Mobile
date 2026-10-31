//Variables
var inGame = false;

//Elements
const gameCode = document.getElementById("gameCode");
const joinForm = document.getElementById("joinForm");

//Event Listeners
joinForm.addEventListener('submit', function(e) {
    e.preventDefault();
    window.location.href = "ingameplayer.html";
});