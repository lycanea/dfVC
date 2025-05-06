# dfVC
A fully open source webserver hosting both frontend pages and a backend for a voice chat implementation made to be used by diamondfire plots to provide customisable proximity voice chat to players

dfVC is designed to be plug and play for both players and developers, the df-side implementation uses very little cpu usage (averaging around 00.01% on my small dev plot) and very few codeblocks

More advanced df-side usage is supported, plots can do various things to control the voice chat from ingame to fully customise the players voice chat experience

## Public Hosted Instance at https://dfvc.lycanea.dev/
This instance will be ran by me (hopefully forever), any df plot can use the df-side implementation and add voice chat using my hosted instance without prior permission from me

## TODO:
- make it use bun instead cause god i hate node js
- basic plot voice chat controls (muting players, deafening players)
- advanced plot voice chat controls (broadcasting players voices, teams system, "radio" system)
- make the actual voicechat a bit more secure, currently the clientside is trusted a little too much and distance data and stuff can just be ignored, make it so clients dont send voice chat data to players far away
- make the actual peer connection quicker so theres less connection delay
- clean up the actual website ui, add some warning/info popups to new users
- throw in some prometheus logging stuff on backend so i can have pretty data visualisations
- make connecting and stuff more consistent

## potentially planned but idk:
- TEMPORARY plot voice recording and playback (with player consent) (think that one SCP in secret lab)
- more plotside features outside of voicechat, having sounds play to players etc
- change the whole system to be fully serversided voice chat instead of peer to peer, more secure for people, kind of inherently has "anticheat" but may have latency issues... look into it, maybe a seperate branch?
