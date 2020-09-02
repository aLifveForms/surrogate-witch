CodeMirror.defineSimpleMode("surrogate-witch", {
  start: [
    {regex: /^(wait)/,
     token: ["keyword"]},
    {regex: /^(\/\/.*)/,
     token: ["comment"]},
    {regex: /^(no_popup)/,
     token: ["keyword"]},
    {regex: /^(no_message)/,
     token: ["keyword"]},
    {regex: /^(no_interactive)/,
     token: ["keyword"]},
    {regex: /^([0-9]+ms)$/,
     token: ["meta"]},
    {regex: /^(http.*|\/.*)(\s+)(\S+)(\s+)(\S+)(\s+)(\S+)/,
     token: ["link", null, "variable-2", null, "variable-2", null, "variable-2"]},
    {regex: /^(http.*|\/.*)(\s+)(\S+)(\s+)(\S+)/,
     token: ["link", null, "variable-2", null, "variable-2"]},
    {regex: /^(http.*|\/.*)(\s+)(\S+)/,
     token: ["link", null, "variable-2"]},
    {regex: /^(http.*|\/.*)/,
     token: ["link"]},
    // arguments ^^ can be 'popup' 'interactive' 'width_#' 'height_#'


    {regex: /^(goto)(\s+)(-|\+)([0-9]+)(\s+)(-|\+)([0-9]+)/,
     token: ["keyword", null, "meta","number", null, "meta","number"]},
    {regex: /^(goto)(\s+)([0-9]+)(\s+)([0-9]+)/,
     token: ["keyword", null, "number", null, "number"]},
    {regex: /^(goto)(\s+)(-|\+)([0-9]+)/,
     token: ["keyword", null, "meta","number"]},
    {regex: /^(goto)(\s+)([0-9]+)/,
     token: ["keyword", null, "number"]},
    // GOTO only N count times (assumes a loop in play)

    {regex: /^(breathing)/,
     token: ["keyword"]},

      // audio urlcmd doonend doarg
      // audio "stop"
      // audio /wav  goto 100
      // audio /wav  goto +10
      // audio /wav  next
      // audio /wav  wait
    {regex: /^(audio)(\s+)(\S+)(\s+)(\S+)(\s+)(-|\+)(\S+)/,
     token: ["keyword", null, "link", null, "variable-2", null, "meta","variable-2"]},
    {regex: /^(audio)(\s+)(\S+)(\s+)(\S+)(\s+)(\S+)/,
     token: ["keyword", null, "link", null, "variable-2", null, "variable-2"]},
    {regex: /^(audio)(\s+)(\S+)(\s+)(\S+)/,
     token: ["keyword", null, "link", null, "variable-2"]},
    {regex: /^(audio)(\s+)(\S+)/,
     token: ["keyword", null, "link"]},
         
    {regex: /^(flicker)(\s+)(\S+)(\s+)(\S+)/,
     token: ["keyword", null, "variable-2", null, "variable-3"]},
    {regex: /^(flicker)(\s+)(\S+)/,
     token: ["keyword", null, "variable-2"]},
    {regex: /^(flicker)/,
     token: ["keyword"]},
           
    {regex: /^(video)(\s+)(\S+)(\s+)(\S+)(\s+)(\S+)/,
     token: ["keyword", null, "link", null, "variable-3", null, "variable-4"]},
    {regex: /^(video)(\s+)(\S+)(\s+)(\S+)/,
     token: ["keyword", null, "link", null, "variable-3"]},
    {regex: /^(video)(\s+)(\S+)/,
     token: ["keyword", null, "link"]},
  
     // urls provided as args
    {regex: /^(popup_test)/,
     token: ["keyword"]},

    {regex: /^(hide)/,
     token: ["keyword"]},
    {regex: /^(unhide)/,
     token: ["keyword"]},
  
    // rest is message
    {regex: /(background_|fontcolor_)(\S+)/,
     token: ["variable-2", "number"]},


  ],
  // The multi-line comment state.
  comment: [
    {regex: /.*?\*\//, token: "comment", next: "start"},
    {regex: /.*/, token: "comment"}
  ],
  // The meta property contains global information about the mode. It
  // can contain properties like lineComment, which are supported by
  // all modes, and also directives like dontIndentStates, which are
  // specific to simple modes.
  meta: {
    dontIndentStates: ["comment"],
    lineComment: "//"
  }
});