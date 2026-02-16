// ==UserScript==
// @name        bonk.io sgrAPI
// @namespace   Violentmonkey Scripts
// @match       https://bonk.io/gameframe-release.html
// @run-at      document-start
// @grant       none
// @version     1.0
// @author      StarCubey
// @license     MIT
// @description An API for bots or doing various actions programatically.
// ==/UserScript==

/*
This mod requires Excigma's code injector to be installed
https://greasyfork.org/en/scripts/433861-code-injector-bonk-io

This mod is not compatible with Salama's bonk host because you can't inject Salama's football step regex twice.

All regexes and most reverse engineering logic is copied from "bonk-host" and "bonk-playlists" by Salama.
Otherwise, the code is written by me and licensed under MIT.
https://github.com/Salama/bonk-host
https://github.com/Salama/bonk-playlists

Source / reference: https://github.com/StarCubey/bonk-rating-bot (sgrAPI from StarCubey).
Note from author: prepare for breaking changes; migration to a custom injector is in progress.

Copyright (c) 2021 Salama

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

You can access the window.sgrAPI object from inspect element. Just make sure you're in the correct frame which can be done by
right clicking the game and selecting inspect element or by selecting the frame gameframe-release.html.

window.sgrAPI.players
This is an array of players where the index is the player id and the value has player specific information.
The player array may have a lot of empty spaces (with a value of null) since each new player is given a new id.

window.sgrAPI.toolFunctions.networkEngine
Contains functions for common actions like moving players, changing host, or kicking players.
Many of these functions take a player id as a parameter.

networkEngine functions and variables:
getLSID() - Gets your player id
hostID - Variable that contains the id of the host
chatMessage("message") - Sends a chat message
kickPlayer(id)
banPlayer(id)
changeOwnTeam(team) - Spectate = 0, Playing = 1, Red = 2, Blue = 3, Green = 4, Yellow = 5
changeOtherTeam(id, team)
doTeamLock(true/false) - locks or unlocks teams
sendNoHostSwap(true/false) - If set to false, host does not swap on disconnect.
setReady(true/false) - Changes your ready state.
allReadyReset() - Sets the ready state of all players.
sendStartCountdown(num) - Sends "Game starting in num"

window.sgrAPI.state and sgrBotAPI.footballState
The state values have useful information like score and player position.

window.sgrAPI.state.scores and window.sgrAPI.footballState.scores
For team games, the score array will have 4 numbers corresponding to different team colors.
For non-team games, the score array will be similar to the player array where scores[playerId] gives you the score of that player.

window.sgrAPI.nextScores
Setting this variable to a score array will load that score at the beginning of the next game.
This is similar to the Bonk Host keep scores feature. window.sgrBotAPI.nextScores will be undefined when not in use.

sgrAPI.stateFunctions.hostHandlePlayerJoined(id, sgrAPI.players.length, team)
This is bonk host freejoin. This moves a player into a game so that they appear in the next round.
*/

window.sgrAPI = {};
// Evitar erro no WebSocket quando onReceive ainda não foi definido (ex.: antes de configureRoom)
window.sgrAPI.onReceive = () => true;

//You can wait for the script to be injected with: await sgrAPI.injected;
window.sgrAPI.injectedResolve;
window.sgrAPI.injected = new Promise(res => sgrAPI.injectedResolve = () => res());

window.sgrAPI.startGame = () => {
  for(let callback of Object.keys(window.sgrAPI.bonkCallbacks)) {
    	window.sgrAPI.bonkCallbacks[callback]("startGame");
	}
}

// Returns a condensed version of window.sgrBotAPI.players with no null values where each player has an id property.
window.sgrAPI.getPlayers = () => {
  if (window.sgrAPI.players == null) return [];
  return Object.keys(window.sgrAPI.players)
    .map(i => {
      let player = window.sgrAPI.players[i];
      if(player === null) return undefined;
      player.id = Number(i);
      return player;
    }).filter(p => p);
};

// Football = "f", Simple = "bs", Death Arrows = "ard", Arrows = "ar", Grapple = "sp", VTOL = "v", and Classic = "b".
window.sgrAPI.setMode = m => {
  if(m === "f") {
    window.sgrAPI.gameInfo[2].ga = "f";
    window.sgrAPI.gameInfo[2].tea = true;
		window.sgrAPI.toolFunctions.networkEngine.sendTeamSettingsChange(window.sgrAPI.gameInfo[2].tea);
  } else {
    window.sgrAPI.gameInfo[2].ga = "b";
  }
  window.sgrAPI.gameInfo[2].mo = m;
  window.sgrAPI.menuFunctions.updatePlayers();
  window.sgrAPI.toolFunctions.networkEngine.sendGAMO(window.sgrAPI.gameInfo[2].ga, window.sgrAPI.gameInfo[2].mo);
  window.sgrAPI.menuFunctions.updateGameSettings();
};

// Sets teams to true or false.
window.sgrAPI.setTeams = teams => {
  if(window.sgrAPI.gameInfo[2].ga === "f") return;

  window.sgrAPI.gameInfo[2].tea = teams;
  window.sgrAPI.toolFunctions.networkEngine.sendTeamSettingsChange(teams);
  window.sgrAPI.menuFunctions.updatePlayers();
  window.sgrAPI.menuFunctions.updateGameSettings();
};

// Loads a map object.
window.sgrAPI.loadMap = map => {
  let mapContainer = document.getElementById("maploadwindowmapscontainer");
  while(mapContainer.firstChild) {
    mapContainer.firstChild.remove();
  }
  window.sgrAPI.mapLoader({maps: [map]});
  mapContainer.firstChild.click();
}

// Gets a map response object containing favorited maps. response.maps is an array of map objects.
// An offset of 0 gives you the first 32 maps and incrementing by 1 gives you the next 32.
window.sgrAPI.getFav = async offset => {
  let response;

  await $.post("https://bonk2.io/scripts/map_getfave.php", {
    token: sgrAPI.token,
    startingfrom: offset * 32
    }).done(e => {

    if (e.r != "success") console.log("Failed to load favorited maps.");
    else response = e;
  });

  return response;
}

// Favorites a map.
window.sgrAPI.fav = async id => {
  await $.post("https://bonk2.io/scripts/map_fave.php", {
	  token: sgrAPI.token,
		mapid: id,
		action: "f"
		}).fail(e => {

    console.log("Failed to favorite map:" + e);
  });
};

// Gets map array from playlist string (from Salama's playlist mod) assuming maps are favorited.
// https://greasyfork.org/en/scripts/439123-bonk-playlists
window.sgrAPI.fromPlaylist = async (playlist) => {
  playlist = JSON.parse(playlist);
  let bonk2MapIds = playlist.map(p => p.maps).flat();
  let bonk1Maps = playlist.map(p => p.b1maps).flat();

  let foundMaps = [];
  for(i = 0; foundMaps.length < bonk2MapIds.length; i++) {
    let maps = (await sgrAPI.getFav(i)).maps;
    if(!maps || maps.length === 0) break;
    for(map of maps) {
      if(bonk2MapIds.find(id => id === map.id) !== undefined) {
        foundMaps.push(map);
      }
    }
  }

  return [foundMaps, bonk1Maps].flat();
};

// Left = 37, Up = 38, Right = 39, Down = 40, X = 88, Z = 90
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
window.sgrAPI.keyDown = keyCode => {
  let event = document.createEvent("HTMLEvents")
  event.initEvent("keydown", true, false);
  event["keyCode"] = keyCode;
  document.getElementById("gamerenderer").dispatchEvent(event);
};

window.sgrAPI.keyUp = keyCode => {
  let event = document.createEvent("HTMLEvents")
  event.initEvent("keyup", true, false);
  event["keyCode"] = keyCode;
  document.getElementById("gamerenderer").dispatchEvent(event);
};

// This function is called every game tick.
window.sgrAPI.onTick = () => {};

// This function returns an input object specifying the player's inputs. The input parameter contains whatever the inputs normally are.
// Example of input object: { left: false, right: false, up: false, down: false, action: false, action2: false }
window.sgrAPI.onInput = input => input;

// This function is called every time a websocket message is received.
// Returns true or false. Return false if you want to ignore default behavior.
// More information here: https://github.com/UnmatchedBracket/DemystifyBonk/blob/main/Packets.md
// message is a string. For instance, chat messages always follow the format of 42[20,playerId,"message"].
window.sgrAPI.onReceive = message => true;

window.sgrAPI.onSend = message => true;

window.sgrAPI.send = message => {
  window.sgrAPI.socket.send(message);
};

//This function can be overwritten to spoof or get data from post requests.
window.sgrAPI.onPost = (url, input) => sgrAPI.oldPost(url, input).then((output, status) => {
  return output;
});

//This function is used with onPost for wrapping post responses in JQuery promises.
window.sgrAPI.postResponse = value => {
  const deferred = $.Deferred();
  deferred.resolve(value, 'success', { status: 200 });
  return deferred.promise();
}

//onPost example. Changes username on login. Fake username is only visible for you.
/*
sgrAPI.onPost = (url, input) => sgrAPI.oldPost(url, input).then((output, status) => {
  if(url.endsWith("login_auto.php") || url.endsWith("login_legacy.php")) {
    output.username = "Fake username";
  }

  return output;
});
*/

//Example of sending spoofed data for a post response without retrieving data from bonk servers.
/*
sgrAPI.onPost = (url, input) => {
  if(url.endsWith("map_getfave.php")) {
      return postResponse({
        maps: [{
          "id": 123,
          "name": "Simple 1v1",
          "authorname": "GudStrat",
          "leveldata": "ILDuJAhZIawhiQEVgGkCqAmANgFwGMBxADxwEkARAMSwFlVyAlAZgDVYMWmBPATQAaqGAEsArhACiAVlTRgACwASAEwDqTACoqlAKQUqkwAKahJCAMIgAHCgTngGSKGGJklV0a-efSByAA5NjVpMT41AEYcAC0LSE0AQyJqUGiBAHoAN3Sc3JyodIB2PLyWLJLc4CIAWwA2FQBzIzkCcDo6AT4ScmpIAGdBJmqAIxZdPF9J7wAFAGofbO90gAYALzp1zbpwKd29-YPJh2RJaBP5f2ALUGp4JEpgAHlPQ69Ic+BPNk1iahZh2CQaJeUCUO6vHxOT6XahcSAGLAAFkQQA",
          "publisheddate": "2020-05-05 16:59:52",
          "vu": 71626,
          "vd": 14821,
          "remixname": "",
          "remixauthor": "",
          "remixdb": 1,
          "remixid": 0,
        }],
        more: false,
        r: "success",
      });
  };
};
*/

//Makes a room and returns the room link.
window.sgrAPI.makeRoom = async (name, password, maxPlayers, minLevel, maxLevel, unlisted) => {
  await sgrAPI.domContentLoaded;
  while(true) {
    document.getElementById("roomlistrefreshbutton").click();
    document.getElementById("roomlistcreatewindowgamename").value = name;
    document.getElementById("roomlistcreatewindowpassword").value = password;
    document.getElementById("roomlistcreatewindowmaxplayers").value = maxPlayers;
    document.getElementById("roomlistcreatewindowminlevel").value = minLevel;
    document.getElementById("roomlistcreatewindowmaxlevel").value = maxLevel;
    document.getElementById("roomlistcreatewindowunlistedcheckbox").checked = unlisted;
    document.getElementById("roomlistcreatecreatebutton").click();
    await new Promise(result => setTimeout(result, 500));
    let connectStr = document.getElementById("sm_connectingWindow_text").innerText;
    let connectVisibility = document.getElementById("sm_connectingContainer").style.visibility;
    if(connectStr !== "Creating room...\nConnect error" && connectVisibility !== "hidden" && connectVisibility !== "") {
      while(true) {
        document.getElementById("newbonklobby_linkbutton").click();
        await new Promise(result => setTimeout(result, 500));
        let messages = document.getElementById("newbonklobby_chat_content").children;
        if(messages.length > 2) {
          return messages[messages.length-1].innerText.slice(2);
        }
      }
    }
  }
}

// Joins room with a blank skin without updating UI or game state.
window.sgrAPI.shadowJoinRoom = async url => {
  let match = url.match(/\/(\d+)([a-z]*)$/);
  let id = match[1];
  const bypass = match[2];

  let address;
  let server;
  await $.post("https://bonk2.io/scripts/autojoin.php", {
    joinID: id
    }).done(e => {

    if (e.r != "success") console.log("Failed to get room from ID.");
    else {
      address = e.address;
      server = e.server;
    }
  });

  let response = await window.fetch(`https://${server}.bonk.io/socket.io/?EIO=3&transport=polling&t=${Date.now()}`);
  sid = (await response.text()).match(/"sid"\s*:\s*"([^"]+)"/)[1];

  //Query string parameters swapped to protect from spoofing.
  let socket = new window.WebSocket(`wss://${server}.bonk.io/socket.io/?transport=websocket&sid=${sid}&EIO=3`);
  socket.noSpoof = true;

  socket.addEventListener("open", () => {
    socket.send("5");

    let data = {
      joinID: address,
      roomPassword: "",
      guest: false,
      dbid: 2,
      version: 49,
      peerID: Math.random().toString(36).substr(2, 10) + "v00000",
      bypass: bypass,
      token: sgrAPI.token,
      avatar: {layers: [], bc: 0}
    };
    socket.send(`42[13,${JSON.stringify(data)}]`);
  });

  return socket;
}

if(!window.bonkCodeInjectors) window.bonkCodeInjectors = [];
window.bonkCodeInjectors.push((code) => {
  // Step functions
  code = code.replace(
    /[A-Za-z]\[[A-Za-z0-9\$_]{3}(\[[0-9]{1,3}\]){2}\]={discs/,
    match => "window.sgrAPI.state = arguments[0]; window.sgrAPI.onTick();" + match,
  );
  code = code.replace(
    /=\[\];if\(\![A-Za-z0-9\$_]\[[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]\[[0-9]{1,3}\]\]\)\{/,
    match => {
      match = match.split(";");
      return match[0] + ";window.sgrAPI.footballState = arguments[0]; window.sgrAPI.onTick();" + match[1];
    },
  );

  // Set state
  let stateCreationString = code.match(/[A-Za-z]\[...(\[[0-9]{1,4}\]){2}\]\(\[\{/)[0];
  let stateCreationStringIndex = stateCreationString.match(/[0-9]{1,4}/g);
  stateCreationStringIndex = stateCreationStringIndex[stateCreationStringIndex.length - 1];
  let stateCreation = code.match(`[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]=[A-Za-z0-9\$_]{3}\\[[0-9]{1,4}\\]\\[[A-Za-z0-9\$_]{3}\\[[0-9]{1,4}\\]\\[${stateCreationStringIndex}\\]\\].+?(?=;);`)[0];
  stateCreationString = stateCreation.split(']')[0] + "]";
  code = code.replace(
    /\* 999\),[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\],null,[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\],true\);/,
    match => match + `
      if(window.sgrAPI.nextScores) {
        ${stateCreationString}.scores = sgrAPI.nextScores;
      }
      window.sgrAPI.nextScores = undefined;
      `,
  );

  //Input Handler
  //Credit to gmmaker for regex: https://github.com/SneezingCactus/gmmaker
  //Original regex: /Date.{0,100}new ([^\(]+).{0,100}\$\(document/
  code = code.replace(
    /Date.{0,100}[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]\[[0-9]{1,3}\];[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]=new [^\(]+\(\);/,
    match => {
      let inputFunc = match.match(/([A-Za-z0-9\$_]{3}\[[0-9]{1,3}\])=new ([^\(]+)\(\);/);
      return match.replace(inputFunc[0], `${inputFunc[0]} window.sgrAPI.input = ${inputFunc[1]};` +
          `window.sgrAPI.oldGetInputs = window.sgrAPI.input.getInputs;`+
          `window.sgrAPI.input.getInputs = () => window.sgrAPI.onInput(window.sgrAPI.oldGetInputs());`
      );
    }
  );

  // Remove round limit (elemento pode não existir no menu / antes do lobby)
  const roundsInputEl = document.getElementById('newbonklobby_roundsinput');
  if (roundsInputEl) roundsInputEl.removeAttribute("maxlength");
  code = code.replace(
    /[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]\[[0-9]{1,3}\]\[[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]\[[0-9]{1,3}\]\]=Math\[[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]\[[0-9]{1,3}\]\]\(Math\[[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]\[[0-9]{1,3}\]\]\(1,[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]\[[0-9]{1,3}\]\[[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]\[[0-9]{1,3}\]\]\),9\);/,
    "",
  );
  code = code.replace(
    /[A-Za-z0-9\$_]{3}\[[0-9]{1,4}\]=parseInt\([A-Za-z0-9\$_]{3}(\[0\]){2}\[[A-Za-z0-9\$_]{3}(\[[0-9]{1,4}\]){2}\]\)\;/,
    match => {
      let roundValVar = match.split("=")[0];
      return `${roundValVar}=parseInt(document.getElementById('newbonklobby_roundsinput').value); if(isNaN(${roundValVar}) || ${roundValVar} <= 0) {return;}`;
    },
  );

  // Map loader
  let mapLoader = code.match(/maploadwindowsearchinput.{0,200}else if\([A-Za-z0-9\$_]{3}\[0\]\[0\]\[[A-Za-z0-9\$_]{3}\[[0-9]+\][[0-9]+\]\] == [A-Za-z0-9\$_]{3}\.[A-Za-z0-9\$_]{3}\([0-9]+\)\)\{[A-Za-z0-9\$_]{3}\([A-Za-z0-9\$_]{3}\[0\]\[0\]\);[A-Za-z0-9\$_]{3}\[[0-9]+\]=[A-Za-z0-9\$_]{3}\[0\]\[0\]\[[A-Za-z0-9\$_]{3}\[[0-9]+\]\[[0-9]+\]\];\}\}\)/g)[0].match(/[A-Za-z0-9\$_]{3}\([A-Za-z0-9\$_]{3}\[0\]\[0\]\);/)[0].slice(0, 3);
  code = code.replace(
    `function ${mapLoader}`,
    `window.sgrAPI.mapLoader=${mapLoader};function ${mapLoader}`
  );

  //Function for all callbacks
  window.sgrAPI.bonkCallbacks = {};
  let callbacks = [...code.match(/[A-Za-z0-9\$_]{3}\(\.\.\./g)];
  for(let callback of callbacks) {
    code = code.replace(
      `function ${callback}`,
      `window.sgrAPI.bonkCallbacks["${callback.split("(")[0]}"] = ${callback.split("(")[0]};` + `function ${callback}`,
    );
  }

  // Useful functions
  code = code.replace(
    /== 13\){...\(\);}}/,
    match => match + "window.sgrAPI.menuFunctions = this;",
  );
  code = code.replace(
    /=new [A-Za-z0-9\$_]{1,3}\(this,[A-Za-z0-9\$_]{1,3}\[0\]\[0\],[A-Za-z0-9\$_]{1,3}\[0\]\[1\]\);/,
    match => match + "window.sgrAPI.toolFunctions = this;",
  );
  code = code.replace(
    /[A-Za-z0-9\$_]{3}\[[0-9]{1,3}\]=\{id:-1,element:null\};/,
    match => match + "window.sgrAPI.gameInfo = arguments;",
  );
  code = code.replace("{a:0.0};", "{a:0.0};window.sgrAPI.stateFunctions = this;");
  code = code.replace(
    "newbonklobby_votewindow_close",
    "window.sgrAPI.players = arguments[1]; newbonklobby_votewindow_close",
  );

  sgrAPI.injectedResolve();
  console.log("sgrAPI run");
  return code;
});

window.sgrAPI.originalSend = window.WebSocket.prototype.send;
window.WebSocket.prototype.send = function(args) {
  let sendFilter;

  if (this.url.includes("socket.io/?EIO=3&transport=websocket&sid=") && !this.noSpoof) {
    if (!this.injectedAPI) {
      window.sgrAPI.socket = this;
      this.injectedAPI = true;

      window.sgrAPI.originalReceive = this.onmessage;
      this.onmessage = function(args) {
        const onRecv = window.sgrAPI.onReceive;
        const receiveFilter = typeof onRecv === 'function' ? onRecv(args.data) : true;
        if(receiveFilter === undefined || receiveFilter === true) return window.sgrAPI.originalReceive.call(this, args);
        else return;
      }
    } else {
      sendFilter = window.sgrAPI.onSend(args);
    }
  }

  if(sendFilter === undefined || sendFilter === true) return window.sgrAPI.originalSend.call(this, args);
  else return;
}

window.sgrAPI.token = null;
window.sgrAPI.oldPost = () => {};
window.sgrAPI.domContentLoadedResolve;
window.sgrAPI.domContentLoaded = new Promise(res => sgrAPI.domContentLoadedResolve = () => res());
document.addEventListener("DOMContentLoaded", () => {
  sgrAPI.domContentLoadedResolve();

  if (typeof $ === 'undefined' || !$.post) return;
  let olderPost = $.post;
  sgrAPI.oldPost = function() {
    return olderPost.call($, ...arguments).then((output, status) => {
      if(arguments[0].endsWith("login_auto.php") || arguments[0].endsWith("login_legacy.php")) {
        sgrAPI.token = output.token;
      }

      return output;
    });
  };

  $.post = function(url, input) {
    const output = sgrAPI.onPost(url, input);
    if(output === undefined) return sgrAPI.oldPost(...arguments);

    return output;
  }

  // Só registrar listeners se o elemento existir (no menu não existe; evita crash na criação da sala)
  const roundsInput = document.getElementById("newbonklobby_roundsinput");
  if (roundsInput) {
    roundsInput.addEventListener("focus", e => {
      e.target.value = "";
    });
    roundsInput.addEventListener("blur", e => {
      if (e.target.value == "") {
        // bonkHost é de outro mod; sem ele usamos fallback para não quebrar
        if (window.bonkHost && window.bonkHost.toolFunctions && typeof window.bonkHost.toolFunctions.getGameSettings === "function") {
          e.target.value = window.bonkHost.toolFunctions.getGameSettings().wl;
        } else {
          e.target.value = "3";
        }
      }
    });
  }
});

console.log("sgrAPI loaded");
