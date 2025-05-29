# dfVC
A fully open source webserver hosting both frontend pages and a backend for a voice chat implementation made to be used by diamondfire plots to provide customisable proximity voice chat to players

dfVC is designed to be plug and play for both players and developers, the df-side implementation uses very little cpu usage (averaging around 00.01% on my small dev plot) and very few codeblocks (this stays true with the base implementation, using the higher update rate version/more advanced features may use higher cpu)

More advanced df-side usage is supported, plots can do various things to control the voice chat from ingame to fully customise the players voice chat experience

## Public Hosted Instance at https://dfvc.lycanea.dev/
This instance will be ran by me (hopefully forever), any df plot can use the df-side implementation and add voice chat using my hosted instance without prior permission from me

## TODO:
- advanced plot voice chat controls (broadcasting players voices, teams system, "radio" system)
- clean up the actual website ui, add some warning/info popups to new users
- throw in some prometheus logging stuff on backend so i can have pretty data visualisations
- improve latency and compress the voice chat a bit more
- better clientside voice chat, buttons to change input devices, adjust input volume, better noise suppression etc

## potentially planned but idk:
- TEMPORARY plot voice recording and playback (with player consent) (think that one SCP in secret lab)
- more plotside features outside of voicechat, having sounds play to players etc
