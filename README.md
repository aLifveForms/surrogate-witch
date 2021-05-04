# surrogate-witch

- [Install and run](#install-and-run)
- [Access](#access)
- [Script](#script)
  - [Basic commands](#basic-commands)
  - [Examples](#examples)
## Install and run

    npm install
    app_port=80 node server.js
    
## Access

* user: http://ptxx.cc 
* master: http://ptxx.cc/master  
  - Open script list with "+" in top right
  - Hold ctrl+click a script line will force **all** connected clients to jump to that line in script. All new clients, and any client that refreshes their browser. will start from that line.
* editor: http://ptxx.cc/editor

## Script

Each line in a script is a command to the client display system. This means that everything for a certain slide must be on one line. The first word a of line in the script determines what type of command or content. Example script may look like this:

    hi
    2000ms
    audio /client/files/file.mp3 wait
    /client/files/image.jpg

The example first shows the message "hi", after 2 seconds starts a mp3 file and waits for audio file to finish before moving to last line where an image is shown.

### Basic commands
* `https://...url...`  
  display web page
* `/image/location.jpg`  
  `/image/location.png`  
  `/image/location.gif`  
  display image
* `/image/location.jpg width_100% height_100%`  
  display image with specific dimensions, percentages or pixels
* `/directory/location/ interactive`  
  display directory, list of files therein. Allow user to interact with list.

* `1000ms`  
  hold/pause script for 1 second
* `wait`  
  stop here. requires master to get past, or button with goto command
* `Some text to show user`  
  display text
* `Some text fontcolor_#cccccc`  
  display text, make text color gray
* `Some text background_#0000ff`  
  display text, make background color blue
* `no_message`  
  remove message window (will show background page)
* `&nbsp;`  
  delete message, empty message
* `no_popup`  
  close popup
* `flicker`  
  flicker background
* `video /client/files/videofile.mp4 autoplay`  
  load and play video
* `audio /client/files/videofile.mp3`  
  load and play audio, continue with script
* `audio stop`  
* `video stop`
* `audio /client/files/videofile.mp3 wait`  
  load and play audio, _wait_ for finish, then after go to next script line
* `audio /client/files/videofile.mp3 next`   
  load and play audio, wait for finish, then after go to _next_ script line
* `audio /client/files/videofile.mp3 goto -10`  
  load and play audio, wait for finish, then after _go back_ 10 script lines
* `audio /client/files/videofile.mp3 goto +10`  
  load and play audio, wait for finish, then after _go forward_ 10 script lines
* `goto -5`  
  jump backward 5 slides


### Examples

* **Formatted text:**  
  `<br><center>1821 <b>Bauxite</b> discovered near Les Beaux in southern France by <b>Pierre Berthier</b> background_transparent`

  text can include html for complex text. example changes font color and background color.

* **Loop with button to jump out of loop:**  
  `Press the button`  
  `2000ms`  
  `<button onclick="goto(position+2)">Press me<button>`  
  `6000ms`  
  `goto -4`  
  `you exited lo`  
  
  User has 6 seconds to press button, else script jumps back 4 lines

* **Load URL as content:**  
  `http://johannespaulraether.net`  
  
  A URL given as the start of a script line will load the url into the main message layer. The page is not interactive; users cannot click or explore. To make interactive add the **interactive** optoin on the same line directly after url.

* **Load youtube in popup:**  
  `https://www.youtube.com/embed/sxbi6seSir4?start=144&autoplay=1 popup width_600 height_300 `  
  
  The URL with the **popup** option on the same line says to open a popup window, here window is **600** pixels wide and **300** pixels high and make the youtube video the source. It is important in this case that the youtube URL has "**autoplay=1**" so that playing starts without user interaction. 

  The width and height commands are optional. "**popup**" is also option and if it isn't there then the URL will be loaded into the current window.

* **Loop video:**  
  `video /client/Gallium_on_an_iPhone6_2000k_1024x.mp4 /client/Gallium_on_an_iPhone6_10_480_pal.gif loop autoplay muted webkit-playsinline width=100% height=100%`  

  Starts video, loop video on its end, muted, width and height defined

* **Multiple images:**  
  `<img src="/client/files/Bayan Obo1.jpg" height=30%> <img src="/client/files/Bayan Obo-crystal.jpg" height=50%>`
  
  Show two images side by side