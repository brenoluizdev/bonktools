## Ideas for the NPM library - Bonkbot

### - New functions:
    1. room.getIP = Returns the IP of a player present in the room
    2. room.startRecording = Starts recording the match
    3. room.stopRecording = Stops the recording and can be sent via webhook to Discord (fetch, axios, etc.). It could also have a parameter to save the file locally as .mp4.
    4. Maximum players per room = Increase the limit from 8 to unlimited
    5. Ability to inject a custom map
    6. Ability to not require a bot as host — only administrators (if necessary) to manage the rooms
    7. Ability to set the maximum points or goals for a match
    8. Ability to set the maximum time for a match
    9. Uniform system = each team can have different uniforms on each player's avatar
    10. Function to increase the speed of the ball or players
    11. Function to increase the size of the ball or players


### - Fix bugs:
    !players command = The command has a bug that does not correctly return the bot host's name; it appears blank.

