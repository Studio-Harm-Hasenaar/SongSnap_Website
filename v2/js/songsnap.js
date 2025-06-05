

$('.LogoutButton').click(function () {
    if (confirm("Weet je zeker dat je wil uitloggen?")) {
        firebaseAuth.signOut();
    }
    return false;
});

setTimeout(() => {
    serverConnection()
}, 1000);

/////////////////////////Variables///////////////////////////////

let firebaseDB = firebase.database();
let firebaseAuth = firebase.auth();
let activePlayerRef;
var activeScreen = "";
var pauseMenuOpen = false;
var roomNumberCookie;
var spotifyAccountName = "???";
var wrongAudioFile = new Audio("audio/Wrong.wav");
var correctAudioFile = new Audio("audio/Correct.wav");
var userName = null;
var latestGameState = null;
var loggedIn = false;
var userActive = false;

//addEventListener('focus', event => { location.reload(); });


var isHost;

//Switch between states (game active or not)
function SetGameActive(gameActive, gameError = "") {
    console.log("Game active: "+gameActive);
    $('#GameNotActive').css('display', gameActive ? 'none' : 'inline');
    $('#GameActive').css('display', gameActive ? 'inline' : 'none');
    if (!gameActive)
        $('#gameNotActiveText').html(gameError);
    $('#GameLoading').css('display', 'none');
}

//Switch between game screens when game is active
function SwitchActiveScreen(screenToActivate) {
    disableAllScreens();

    console.log("screenToActivate before: " + screenToActivate + ", userActive: "+userActive + ", latestGameState: "+latestGameState);

    //If no screen to activate has been supplied here, activate the last known.
    if (screenToActivate == null) {
        if (latestGameState == null) {
            SetGameActive(false, "Spel is niet actief");
            return;
        }
        else {
            if (latestGameState == "Startup")
                location.reload();
            else {
                if (!userActive)
                    SwitchActiveScreen("Setup");
                else
                    SwitchActiveScreen(latestGameState);
            }
            return;
        }
    }

    console.log("screenToActivate after: " + screenToActivate);

    SetGameActive(true);

    //If the player isn't the host, show the wait screen instead of control buttons
    if (!isHost && screenToActivate == "PickPlaylist")
        screenToActivate = "WaitForHost";
    if (!isHost && screenToActivate == "PickDuration")
        screenToActivate = "WaitForHost";
    if (!isHost && screenToActivate == "GameExplain")
        screenToActivate = "WaitForHost";    

    //Handle extra actions when entering certain screens
    switch (screenToActivate) {
        case 'Scoring':
            SetPlayerScoreScreen();
            break;
        case 'PickPlaylist':
            //Set selected playlist
            firebaseDB.ref(getParameterByName("roomNumber") + "/SelectedPlaylist").once('value', function (snapshot) {
                var val = snapshot.val();
                if (val !== null && loggedIn) {
                    SetPlaylistContent(val);
                }
            });
            break;
        case 'PickDuration':
            var maxAmount = Number(99);
            $('#quanityLabel').html('Tussen 1 en ' + maxAmount);
            $('#quantity').attr({
                "max": maxAmount,
            });
            break;
    }

    //Activate the active screen
    $('#' + screenToActivate).css('display', 'inline');
}

function SetPlaylistContent(val) {
    $('#viewingPlaylist').html(val != "" ? "Kies een afspeellijst met de pijltjes" : "Wacht even tot de liedjes geladen zijn.");
    $('#chooseButton').html("Raad afspeellijst:<br>" + val);
    $('#chooseButton').css('display', val != "" ? 'inline' : 'none');
    $('#upButton').css('display', val != "" ? 'inline' : 'none');
    $('#downButton').css('display', val != "" ? 'inline' : 'none');
    $('#SearchPlaylistDiv').css('display', val != "" ? 'inline' : 'none');
}

function disableAllScreens() {
    let screens = document.querySelectorAll('.screen');
    screens.forEach(s => {
        s.style.display = 'none';
    })
}

//Generic function to get a parameter from the url by string
function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

//When the server makes connection, this gets called. Functions like an initiation of the client side
function serverConnection() {
    $('#GameLoading').css('display', 'none');
}

//Connections
var connectedRef = firebaseDB.ref('.info/connected');
connectedRef.on('value', (snap) => {

    if (snap.val() === true) {
        console.log("Connection to firebase made");
    }
});

//Show the menu where the host can change volume and go back to the lobby.
function ShowMenu(show) {
    if (firebaseAuth.currentUser != null) {
        pauseMenuOpen = show;
        firebaseDB.ref(roomNumberCookie + "/GamePaused").once("value")
            .then(function (snapshot) {
                if (snapshot.val() !== null)
                    firebaseDB.ref(roomNumberCookie + "/GamePaused").set(pauseMenuOpen);
            });
    }
}

//Return to the lobby for a new game.
function BackToLobby() {
    firebase.database().ref(roomNumberCookie + "/HostInput").set("resetGame");
}

//Set the volume of spotify from the mobile.
function SetSpotifyVolume(newVolume) {
    EmitMessage("setCurrentSpotifyVolumeFromGame", "{\"newVolume\":\n" + newVolume + "\n}");
}

function ShowErrorMessage(errorMessage) {
    $('#ErrorMessage').html("<i>" + errorMessage + "</i>");
    $('#pname').css("border-color", "#ea4146");
}

function SetUserLoggedId() {
    console.log("Logged in. Show content");
    $('#PauseMenu').css('display', pauseMenuOpen ? 'block' : 'none');

    //Check the roomnumber
    roomNumberCookie = getParameterByName("roomNumber");
    activePlayerRef = firebaseDB.ref(roomNumberCookie + '/ActivePlayers/');

    let updatedRoomNumberCookie = getParameterByName("roomNumber");
    if (updatedRoomNumberCookie != "" && updatedRoomNumberCookie != null && user != null) {

        //Check if the user is active
        let firebaseRef = firebaseDB.ref(updatedRoomNumberCookie + "/ActivePlayers/" + user.uid + "/UserActive");
        firebaseRef.on("value", snapshot => {

            userActive = snapshot.val();
            if (userActive == null) userActive = false;

            console.log("userActive: " + userActive);
            //IF the player is registered in firebase and closes the window, update its active status
            SwitchActiveScreen();
            firebaseRef.onDisconnect().set(false);
        });

        //Is game paused?
        firebaseDB.ref(updatedRoomNumberCookie + "/GamePaused").on("value", snapshot => {
            if (snapshot.val() !== null && loggedIn) {
                console.log("Pause: " + snapshot.val());
                $('#PauseMenu').css('display', snapshot.val() ? 'block' : 'none');
            }
        });

        //Player position
        firebaseDB.ref(updatedRoomNumberCookie + "/ActivePlayers/" + user.uid + "/ScoringPlace").on("value", snapshot => {
            if (snapshot.val() !== null && loggedIn) {
                $('#finalResult').text(snapshot.val());
                //TODO: TEMP: DISABLED:
                //$('#scoringPositionLeftTop').text(snapshot.val() + " plaats");
            }
        });

        //Player score
        firebaseDB.ref(updatedRoomNumberCookie + "/ActivePlayers/" + user.uid + "/Score").on("value", snapshot => {
            if (snapshot.val() !== null && loggedIn) {
                let playerScore = parseInt(snapshot.val());
                if (playerScore <= 0)
                    $("#scoringRightTop").html("Geen punten");
                else if (playerScore == 1)
                    $("#scoringRightTop").html("1 punt");
                else
                    $("#scoringRightTop").html(playerScore + " punten");
            }
        });

        //Set guess information
        firebaseDB.ref(updatedRoomNumberCookie + "/CurrentQuestion/GuessData").on('value', function (snapshot) {
            if (snapshot.val() !== null)
                SetGuessData(snapshot);
        });

        //Set selected playlist
        firebaseDB.ref(updatedRoomNumberCookie + "/SelectedPlaylist").on('value', function (snapshot) {
            let val = snapshot.val();
            if (val !== null && loggedIn)
                SetPlaylistContent(val);
        });

        //Switch to searchContent
        firebaseDB.ref(updatedRoomNumberCookie + "/Host_SearchQuery").on('value', function (snapshot) {
            let val = snapshot.val();
            if (val !== null && loggedIn) {
                if (val != "")
                    $('#viewingPlaylist').html("Zoekresultaten:<br>'" + val + "'");
                else
                    $('#viewingPlaylist').html("Kies een afspeellijst");

                $('#backToUserPlaylists').css('display', val != "" ? 'inline' : 'none');
                $('#searchSubmit').css('display', val != "" ? 'none' : 'inline');
            }
        });

        console.log("Roomname: "+roomNumberCookie);
        if (roomNumberCookie != "" && roomNumberCookie != null) {
            //Set username
            var ref = firebase.database().ref(roomNumberCookie);
            ref.once("value")
                .then(function (snapshot) {
                    if (!snapshot.child("CurrentGameState").exists())
                        SetGameActive(false, "Spel is niet actief");
                    else {
                        if (firebaseAuth.currentUser != null)
                            userName = firebaseAuth.currentUser.displayName;
                        if (userName != null && userName != "" && userName != "undefined")
                            {
                                var nameExists = false;
                                snapshot.child("ActivePlayers").forEach((childSnapshot) => {
                                    const userData = childSnapshot.val();
                              
                                    // Check if the userName matches
                                    if (userData.PlayerName == userName) {
                                      nameExists = true;
                                      return true; // Break the loop if a match is found
                                    }
                                  });

                                  console.log("Set username "+nameExists);
                                    $("#pname").val(nameExists ? "" : userName);
                            }
                    }
                });

            //Check if this player is now the host
            firebaseDB.ref(roomNumberCookie + "/HostUID").on('value', function (snapshot) {
                var _changed = isHost;
                if (snapshot.val() !== null)
                    isHost = (user.uid == snapshot.val());
                _changed = (isHost != _changed);
                console.log("Current host is: " + snapshot.val() + ", this UID: " + user.uid);
                console.log("isHost: " + isHost);
                console.log("_changed: " + _changed);
                if (loggedIn && _changed)
                    SwitchActiveScreen();
            });

            //Game state changed game listener
            firebaseDB.ref(roomNumberCookie + "/CurrentGameState").on('value', function (snapshot) {

                if (snapshot.val() !== null) {
                    latestGameState = snapshot.val();
                    SwitchActiveScreen();
                }
            });
        }
        else
            SetGameActive(false, "Geen kamernummer gevonden. Heb je de QR code gescand?");
    }
        else
            SetGameActive(false, "Geen kamernummer gevonden. Heb je de QR code gescand?");
}

function SetupNewPlayer() {
    firebaseDB.ref(roomNumberCookie + "/CurrentGameState").once("value")
        .then(function (snapshot) {
            if (snapshot.val() !== null) {
                activeScreen = snapshot.val();
            }

            console.log("Setup new player");

            var tempUserName = firebaseAuth.currentUser.displayName;
            firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid).update({
                PlayerName: tempUserName,
                UserActive: true,
            });

            $('#playerName').html('Welkom<br>' + tempUserName);
            //SwitchActiveScreen(activeScreen);

            if (activeScreen == "Guessing") {
                //Set guess information for late joiners
                firebaseDB.ref(roomNumberCookie + "/CurrentQuestion/GuessData").once('value', function (snapshot) {
                    if (snapshot.val() !== null)
                        SetGuessData(snapshot);
                });
            }

        });
    loggedIn = true;
}

function PlayerLeft() {
    console.log("left");
    if (roomNumberCookie == null)
    return;
    firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid).once("value")
        .then(function (snapshot) {
            if (snapshot.val() !== null)
                firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid + "/UserActive").set(false);
        });
}

//Set the 4 song titles and artists on the correct buttons.
function SetGuessData(snapshot) {
    var guessState = snapshot.child("guessState").val();
    console.log("guessState: " + guessState);
    switch (guessState) {
        case 'ready':
            $('#guessText').html('Klaar?');
            SetButtonStyle(-1, '.5');
            break;
        case 'guess':
            //Get local time to set as guesstime (Only if there is no data yet)
            var startDate = new Date();
            var combinedStartDate = (startDate.getMinutes() * 60000) + (startDate.getSeconds() * 1000) + startDate.getMilliseconds();
            firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid + "/GuessStartTime").once("value")
                .then(function (snapshot) {
                    if (snapshot.val() !== null)
                        if (snapshot.val() == "-1") {
                            firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid + "/GuessStartTime").set(combinedStartDate);
                        }
                });

            CheckIfGuessed(1, 'Raad!');

            break;
        case 'timeup':
            CheckIfGuessed(.5, 'Tijd is op');
            break;
        case 'clean':
            $('#guessText').html('');
            SetButtonStyle(-1, '.5');
            break;
    }

    //Button state
    if (guessState == 'clean' || guessState == '') { //REMOVED || guessState == 'ready' 
        $('#blue_artist').html("Artiest");
        $('#blue_song').html("Titel");

        $('#green_artist').html("Artiest");
        $('#green_song').html("Titel");

        $('#orange_artist').html("Artiest");
        $('#orange_song').html("Titel");

        $('#yellow_artist').html("Artiest");
        $('#yellow_song').html("Titel");
    }
    else {
        //BLUE
        var blueArtist = snapshot.child("songData").child(0).child("artistName").val();
        var blueSong = snapshot.child("songData").child(0).child("songName").val();
        SetMusicGuessContent('#blue_artist', blueArtist, '#blue_song', blueSong);

        //ORANGE
        var orangeArtist = snapshot.child("songData").child(1).child("artistName").val();
        var orangeSong = snapshot.child("songData").child(1).child("songName").val();
        SetMusicGuessContent('#orange_artist', orangeArtist, '#orange_song', orangeSong);

        //GREEN
        var greenArtist = snapshot.child("songData").child(2).child("artistName").val();
        var greenSong = snapshot.child("songData").child(2).child("songName").val();
        SetMusicGuessContent('#green_artist', greenArtist, '#green_song', greenSong);

        //YELLOW
        var yellowArtist = snapshot.child("songData").child(3).child("artistName").val();
        var yellowSong = snapshot.child("songData").child(3).child("songName").val();
        SetMusicGuessContent('#yellow_artist', yellowArtist, '#yellow_song', yellowSong);
    }

    $('#timeBarSecondsText').html('');
    $('.timeBarbar').css('width', '100%');
}

function SetButtonStyle(buttonToSet, newValue) {
    if (buttonToSet == -1) {
        $('#BlueButtonReference').css('opacity', newValue);
        $('#OrangeButtonReference').css('opacity', newValue);
        $('#GreenButtonReference').css('opacity', newValue);
        $('#YellowButtonReference').css('opacity', newValue);
    }
    else {
        $('#BlueButtonReference').css('opacity', '.5');
        $('#OrangeButtonReference').css('opacity', '.5');
        $('#GreenButtonReference').css('opacity', '.5');
        $('#YellowButtonReference').css('opacity', '.5');
        switch (buttonToSet) {
            case 0:
                $('#BlueButtonReference').css('opacity', '1');
                break;
            case 1:
                $('#OrangeButtonReference').css('opacity', '1');
                break;
            case 2:
                $('#GreenButtonReference').css('opacity', '1');
                break;
            case 3:
                $('#YellowButtonReference').css('opacity', '1');
                break;
        }
    }
}

function CheckIfGuessed(fallBackValue, guessText) {
    var guessedNumber = -1;
    firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid).once("value")
        .then(function (snapshot) {
            if (snapshot.val() !== null) {
                guessedNumber = snapshot.child("SelectedAnswer").val();
                if (guessedNumber != -1) {
                    SetButtonStyle(guessedNumber, '1');
                    $('#guessText').html('Geraden!');
                }
                else {
                    SetButtonStyle(-1, fallBackValue);
                    $('#guessText').html(guessText);
                }
            }
        });
}

function ResetScoreScreen() {
    $("#showIfAnserWrong").css('display', 'none');
    $("#result").html('');
    $("#pickedAnswerButton").css('display', 'none');
    $("#correctAnswerButton").css('display', 'none');
    $("#picked_artist").html('');
    $("#picked_song").html('');
    $("#correct_artist").html('');
    $("#correct_song").html('');
    $("#GainedPointText").html('');
}

function SetMusicGuessContent(jquerryReferenceArtist, contentToSetArtist, jquerryReferenceSong, contentToSetSong) {
    //Max 40 characters per song and artist

    //Artist
    var shortenedValueArtist = GetMaxCharacterLength(contentToSetArtist);
    $(jquerryReferenceArtist).html(shortenedValueArtist);

    //Song
    var shortenedValueSong = GetMaxCharacterLength(contentToSetSong);
    $(jquerryReferenceSong).html(shortenedValueSong);

    //Check if any has two rows of text and shorten if needed
    if (shortenedValueSong.length > 20 && shortenedValueArtist.length > 20) {
        $(jquerryReferenceSong)[0].style.fontSize = "1.9vh";
        $(jquerryReferenceArtist)[0].style.fontSize = "1.9vh";
    }
    else {
        $(jquerryReferenceSong)[0].style.fontSize = shortenedValueSong.length > 30 ? "2vh" : "2.5vh";
        $(jquerryReferenceArtist)[0].style.fontSize = shortenedValueSong.length > 30 ? "2vh" : "2.5vh";
    }
}

function GetMaxCharacterLength(textToshorten) {
    return textToshorten.length > 50 ? textToshorten.substring(0, 50) + "..." : textToshorten;
}

//Player has guessed
function EnterGuess(newGuess) {
    //Get local time to set as guesstime
    var endDate = new Date();
    var combinedEndDate = (endDate.getMinutes() * 60000) + (endDate.getSeconds() * 1000) + endDate.getMilliseconds();
    firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid).once("value")
        .then(function (snapshot) {
            if (snapshot.val() !== null) {
                //Get song data
                firebaseDB.ref(roomNumberCookie + "/CurrentQuestion/GuessData").once("value")
                    .then(function (songDataSnapShot) {
                        if (songDataSnapShot.val() !== null) {
                            if (snapshot.child("SelectedAnswer").val() == -1 && songDataSnapShot.child("guessState").val() == 'guess') {
                                startDate = snapshot.child("GuessStartTime").val();
                                var guessTimeMS = -1;
                                if (combinedEndDate > startDate)
                                    guessTimeMS = combinedEndDate - startDate;
                                firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid + "/GuessTimeMS").set(guessTimeMS);
                                firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid + "/SelectedAnswer").set(newGuess);
                                CheckIfGuessed(1, 'Geraden');
                            }
                        }
                    });
            }
        });
}

//Update the score.
function SetPlayerScoreScreen() {
    ResetScoreScreen();
    firebaseDB.ref(roomNumberCookie + "/ActivePlayers/" + firebaseAuth.currentUser.uid).once("value")
        .then(function (playerSnapShot) {
            if (playerSnapShot.val() !== null) {
                //Get song data
                firebaseDB.ref(roomNumberCookie + "/CurrentQuestion").once("value")
                    .then(function (songDataSnapShot) {
                        if (songDataSnapShot.val() !== null) {

                            var selectedAnswerInt = parseInt(playerSnapShot.child("SelectedAnswer").val());
                            var correctAnswerInt = parseInt(songDataSnapShot.child('GuessData').child("correctInt").val());

                            var correct = (selectedAnswerInt == correctAnswerInt);
                            var pickedArtist = "";
                            var pickedSong = "";
                            if (selectedAnswerInt != -1) {
                                pickedArtist = songDataSnapShot.child('GuessData').child("songData").child(selectedAnswerInt).child("artistName").val();
                                pickedSong = songDataSnapShot.child('GuessData').child("songData").child(selectedAnswerInt).child("songName").val();
                            }
                            var correctArtist = "";
                            var correctSong = "";
                            if (correctAnswerInt != -1) {
                                correctArtist = songDataSnapShot.child('GuessData').child("songData").child(correctAnswerInt).child("artistName").val();
                                correctSong = songDataSnapShot.child('GuessData').child("songData").child(correctAnswerInt).child("songName").val();
                            }
                            var isFastestGuessed = firebaseAuth.currentUser.uid == songDataSnapShot.child('GuessData').child("fastestGuesserUID").val();

                            var pickedAnswerClass = GetColorClass(selectedAnswerInt);
                            var correctAnswerClass = GetColorClass(correctAnswerInt);

                            $("#showIfAnserWrong").css('display', correct ? 'none' : 'unset');
                            $("#result").html(correct ? 'Goed!' : 'Fout!');
                            $("#pickedAnswerButton").css('display', 'inline');
                            $("#correctAnswerButton").css('display', 'inline');
                            $("#pickedAnswerButton").attr('class', pickedAnswerClass);
                            $("#correctAnswerButton").attr('class', correctAnswerClass);
                            if (selectedAnswerInt == -1) {
                                $("#result").html('Geen antwoord!');
                                $("#picked_artist").html('???');
                                $("#picked_song").html('???');
                            } else {
                                $("#picked_artist").html(GetMaxCharacterLength(pickedArtist));
                                $("#picked_song").html(GetMaxCharacterLength(pickedSong));
                            }
                            if (correct) {
                                correctAudioFile.play();
                            } else {
                                $("#correct_artist").html(GetMaxCharacterLength(correctArtist));
                                $("#correct_song").html(GetMaxCharacterLength(correctSong));
                                wrongAudioFile.play();
                            }


                            //TODO: Fix points gained   
                            /*
                            var pointConfirmation = "";
                            if (correct && isFastestGuessed) pointConfirmation = "2 punten erbij!";
                            if (correct && !isFastestGuessed) pointConfirmation = "1 punt erbij!";
                            if (!correct && isFastestGuessed) pointConfirmation = "Punt verloren!";
                            if (!correct && !isFastestGuessed) pointConfirmation = "";
                            $("#GainedPointText").html((isFastestGuessed ? '<img id="fastestGuesser" src="images/FirstToGuess.png" alt="" width="130px">' : '') + " " + pointConfirmation);
                            */

                            //SetSim(0, 99);
                            $('#Scoring').css('display', 'inline');
                        }
                    });
            }
        });
}

function GetColorClass(answerInt) {
    var returnValue = "";
    switch (answerInt) {
        case 0: returnValue = "Blue"; break
        case 1: returnValue = "Orange"; break
        case 2: returnValue = "Green"; break
        case 3: returnValue = "Yellow"; break
        default: returnValue = "White"; break
    }
    return returnValue;
}

//Enable/disable sumbit quantity number button
const $numberInput = $('#quantity');
const $submitButton = $('#amountsubmit');
function checkInput() {
    console.log("Check");
    if ($numberInput.val() === "") {
        $submitButton.css('color', 'grey');
    } else {
        $submitButton.css('color', 'white');
    }
}
$numberInput.on('input', checkInput);
checkInput();

//Quantity listeners
let quant = document.querySelector('#quantity');
quant.removeEventListener('change', () => { });
quant.removeEventListener('value', () => { });

//Set preset song duraction
$("#set5songs").click(function (e) {
    e.preventDefault();
    quant.value = 5;
    checkInput();
});
$("#set10songs").click(function (e) {
    e.preventDefault();
    quant.value = 10;
    checkInput();
});
$("#set15songs").click(function (e) {
    e.preventDefault();
    quant.value = 15;
    checkInput();
});

//The host changed the volume slider, update the volume of spotify via unity
$("#spotifyVolumeSlider").change(function () {
    if (this.value != null)
        EmitMessage("setSpotifyVolume", "{\"newValue\":\"" + this.value + "\"}") //TODO: < Convert to firebase and make functional
});

//The host clicked the up button during playlist selection
$('#upButton').click(function () {
    firebase.database().ref(roomNumberCookie + "/HostInput").set("playlistUp");
    return false;
});

//The host clicked the down button during playlist selection
$('#downButton').click(function () {
    firebase.database().ref(roomNumberCookie + "/HostInput").set("playlistDown");
    return false;
});

//The host selected a playlist during playlist selection
$('#chooseButton').click(function () {
    firebase.database().ref(roomNumberCookie + "/HostInput").set("playlistSelect");
    return false;
});

//The host wants to skip tutorial
$('#skipExplainButton').click(function () {
    firebase.database().ref(roomNumberCookie + "/HostInput").set("skipExplain");
    return false;
});

//The player has pressed the blue button during the guessing game
$('#BlueButtonReference').on('click touchend', function (e) {
    EnterGuess(0);
    return false;
});

//The player has pressed the orange button during the guessing game
$('#OrangeButtonReference').on('click touchend', function (e) {
    EnterGuess(1);
    return false;
});

//The player has pressed the green button during the guessing game
$('#GreenButtonReference').on('click touchend', function (e) {
    EnterGuess(2);
    return false;
});

//The player has pressed the yellow button during the guessing game
$('#YellowButtonReference').on('click touchend', function (e) {
    EnterGuess(3);
    return false;
});

//The host has clicked the pause button. The game should now pause when possible.
$('.pauseMenuButton').on('click touchend', function (e) {
    ShowMenu(!pauseMenuOpen);
    return false;
});

//The host has closed the pause button. The game should now resume when possible.
$('#closeMenu').on('click touchend', function (e) {
    ShowMenu(false);
    return false;
});

//The host has clicked on the return to lobby button. Confirm if this is what he/she wants and then return to lobby.
$('.backToLobby').on('click touchend', function (e) {
    if (window.confirm("Wil je een nieuwe afspeellijst uitkiezen?")) {
        ShowMenu(false);
        BackToLobby();
    }
    return false;
});

//A player has entered their data, check on the server if this data is valid.
$('#formSubmit').submit(function (e) {
    e.preventDefault();
    var newDisplayname = $('#pname').val();
    var ref = firebase.database().ref(roomNumberCookie);
    ref.once("value")
        .then(function (snapshot) {
    
            console.log("Name entered");
            
            if (snapshot.val() !== null)
                {
                var nameExists = false;
                snapshot.child("ActivePlayers").forEach((childSnapshot) => {
                    const userData = childSnapshot.val();
              
                    // Check if the userName matches
                    if (userData.PlayerName == userName && userData.userActive) {
                      nameExists = true;
                    }
                  });
                }
                if (nameExists)
                    {
                        ShowErrorMessage("Deze naam is al in gebruik");
                        return false;
                    }

        if (newDisplayname != "" && !nameExists) {
            const user = firebaseAuth.currentUser;
            user.updateProfile({
                displayName: newDisplayname,
            }).then(() => {
                SetupNewPlayer();
            }).catch((error) => {
                ShowErrorMessage("Database fout: " + error);
            });
        }
        else
            ShowErrorMessage("Geen naam ingevuld");
        return false;
    });
});

//The host has input how many songs there should be in this guessing game
$('#quantitySubmit').submit(function (e) {
    e.preventDefault();
    var quessAmount = $('#quantity').val();
    if (quessAmount > 0) {
        firebase.database().ref(roomNumberCookie + "/Host_SongAmount").set(quessAmount);
    }
    return false;
});

//The host wants to search for custom playlists
$('#searchSubmit').submit(function () {
    //search
    var searchText = $('#searchText').val();

    if (searchText != "") {
        firebase.database().ref(roomNumberCookie + "/Host_SearchQuery").set(searchText);
    }
    return false;
});

//The host wants to return to the user playlist overview
$('#backToUserPlaylists').click(function () {
    firebase.database().ref(roomNumberCookie + "/HostInput").set("backToUserPlaylist");
    firebase.database().ref(roomNumberCookie + "/Host_SearchQuery").set("");
});

$('#backToUserPlaylistsFromGuessAmount').click(function () {
    firebase.database().ref(roomNumberCookie + "/HostInput").set("backToUserPlaylist");
    firebase.database().ref(roomNumberCookie + "/Host_SearchQuery").set("");
});

//A player wants to return to the input field
$('.backButton').click(function () {
    SwitchActiveScreen('Setup');
    PlayerLeft();
});
