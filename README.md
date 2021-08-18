# JOJO

### Events:

- when a player can play and keep playing, it sends that information to the server. when all the clients can play, the server sets the global state to "ready."
- when a player can not play and is "waiting," it sends that information to the server. the server sets everything to "pause" and waits for all the clients to be able to play again.
- when a player hits play or pause, that information is sent to the server to update the global state.
- when a player starts seeking, everyone gets paused and is shown the message "\[client name] is seeking." when the seeked event happens, the time is updated for everyone. when the client who was seeking starts playing again, meaning they lifted their pointer off the range thumb, everyone starts playing again.
- when a client hits the button to go to a different playlist item, that is an event, and the whole "wait for everyone to be able to play" thing starts over again.

I think when a video ends it should just sit there, ended, bc autoplay is a sin against god.
