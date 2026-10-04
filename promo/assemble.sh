#!/bin/bash
set -e
F=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
T() { echo "drawtext=fontfile=$F:text='$1':fontsize=$2:fontcolor=0xfff4d6:borderw=6:bordercolor=black@0.85:shadowx=0:shadowy=4:shadowcolor=black@0.6:x=(w-tw)/2:y=$3:alpha='if(lt(t,$4),0,if(lt(t,$4+0.4),(t-$4)/0.4,if(lt(t,$5-0.4),1,if(lt(t,$5),($5-t)/0.4,0))))'"; }
ffmpeg -y -v error -framerate 10 -i /tmp/claude-0/pvpf/%05d.jpg \
 -vf "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=1280:720:flags=lanczos,unsharp=5:5:0.9:5:5:0.0,eq=contrast=1.06:saturation=1.18:gamma=1.1,eq=gamma=1.3:brightness=0.02:enable='between(t,20.4,27.2)',eq=gamma=1.15:enable='between(t,14,20.4)',format=gbrp,split[a][b];[b]colorchannelmixer=.33:.33:.33:0:.33:.33:.33:0:.33:.33:.33,curves=all='0/0 0.55/0 1/1',gblur=sigma=16[bl];[a][bl]blend=all_mode=screen:all_opacity=0.28,vignette=PI/6,format=yuv420p,\
$(T 'PVP ISLAND' 120 'h*0.30' 0.4 3.0),\
$(T 'SURVIVE  •  BUILD  •  CONQUER' 38 'h*0.30+130' 0.9 3.0),\
$(T 'GATHER' 64 'h*0.08' 3.3 8.3),\
$(T 'BUILD' 64 'h*0.08' 8.9 13.9),\
$(T 'FIGHT' 64 'h*0.08' 14.5 20.3),\
$(T 'DESTROY' 64 'h*0.08' 21.0 26.6),\
$(T 'PVP ISLAND' 110 'h*0.36' 27.4 30),\
$(T 'PLAY NOW' 46 'h*0.36+120' 27.9 30),\
fade=t=in:st=0:d=0.4,fade=t=out:st=29.3:d=0.7" \
 -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium /tmp/claude-0/pvp_silent.mp4
ffmpeg -y -v error -i /tmp/claude-0/pvp_silent.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart pvp-island-trailer.mp4
ls -la pvp-island-trailer.mp4
