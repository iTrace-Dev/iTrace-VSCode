const fs = require('fs');

class OutputFileWriter {
  constructor(directory,session_id) {
    this.file = fs.createWriteStream(directory+"\\itrace_vscode-"+(new Date()).getTime().toString()+".xml");
    this.file.write("<?xml version=\"1.0\"?>\n");
    this.file.write("<itrace_plugin session_id=\""+session_id+"\">\n");
    this.file.write("    <environment screen_width=\""+window.screen.width.toString()+"\" screen_height=\""+window.screen.height.toString()+"\" plugin_type=\"VSCODE\">\n");
    this.file.write("    <gazes>\n");
  }
	
  close_writer() {
    this.file.write("    <gazes/>\n");
    this.file.write("<itrace_plugin/>\n");
    this.file.end();
  }
	
  write_gaze(event_id, x, y) {
    let editor = CodePosServer.getEditorAttributes();
    let pos = CodePosServer.getFileRowCol(editor, parseInt(x), parseInt(y));
    if (pos !== undefined)
      this.file.write("        <response event_id=\""
                      + event_id
                      + "\" plugin_time=\""
                      + (new Date()).getTime().toString()
                      + "\" x=\""
                      + x
                      + "\" y=\""
                      + y
                      + "\" gaze_target=\""
                      + editor.openFile.split("\\").at(-1)
                      + "\" gaze_target_type=\""
                      + editor.openFile.split(".").at(-1)
                      + "\" source_file_path=\""
                      + editor.openFile
                      + "\" source_file_line=\""
                      + pos.row.toString()
                      + "\" source_file_col=\""
                      + pos.col.toString()
                      + "\" editor_line_height=\""
                      + editor.lineHeight
                      + "\" editor_font_height=\"\" editor_line_base_x=\"\" editor_line_base_y=\"\"/>\n"
                     );
  }
}

class CodePosServer {
  static getEditorAttributes() {
    const editorRegion = document.getElementById("workbench.parts.editor");
    const lineNumber = editorRegion.querySelector(".line-numbers");
    const lineNumberBox = lineNumber.getBoundingClientRect();
    const editor = editorRegion.querySelector(".lines-content");
    const editorBox = editor.getBoundingClientRect();
    const line = editor.querySelector(".view-line").firstChild;
    const lineBox = line.getBoundingClientRect();
    const editorLeft = editorBox.left;
    const editorTop = editorBox.top;
    const lineHeight = lineNumberBox.height;
    const charWidth = lineBox.width / line.innerText.length;
    let openFileTemp = editorRegion
      .querySelector(".monaco-editor")
      .getAttribute("data-uri").replace("file:///","").replace("%3A",":");
    const openFile = openFileTemp[0].toUpperCase() + openFileTemp.slice(1);
    // these could be cached and only updated when a MutationObserver fires
    return {
      editorLeft,
      charWidth,
      lineHeight,
      editorTop,
      openFile,
    };
  }

  static isInBounds(obj, x, y) {
    const rects = obj.getClientRects();
    if (rects.length == 0)
      return false;
    const rect = rects[0];
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }

  static inWindow(selector, x, y) {
    const objects = Array.from(document.querySelectorAll(selector));
    if (objects != null && objects.some((o) => CodePosServer.isInBounds(o, x, y)))
      return true;
    return false;
  }

  static getFileRowCol(editor, x, y) {
    x /= window.devicePixelRatio;
    y /= window.devicePixelRatio;

    if (CodePosServer.inWindow('.monaco-hover', x, y))
      return undefined;
    if (CodePosServer.inWindow('.zone-widget', x, y))
      return undefined;
    if (CodePosServer.inWindow('.quick-input-widget', x, y))
      return undefined;
    if (CodePosServer.inWindow('.suggest-widget', x, y))
      return undefined;
    if (CodePosServer.inWindow('.suggest-details-container', x, y))
      return undefined;

    // zone widgets 'push' the editor lines down below them, so if we are
    // mapping a coord below them, subtract how many lines each one pushed
    const zones = Array.from(document.querySelectorAll('.zone-widget'));
    let zoneRows = 0;
    if (zones != null && zones.length > 0)
      zones.forEach((z) => {
        const rect = z.getClientRects();
        if (rect != null && y >= rect[0].top)
        zoneRows = rect[0].height / editor.lineHeight;
      });

    const col = (x - editor.editorLeft) / editor.charWidth;
    const row = (y - editor.editorTop) / editor.lineHeight;
    return {
      row: Math.floor(row - zoneRows + 1),
      col: Math.floor(col + 1),
      file: editor.openFile,
    };
  }

  coordsCallback(websocketEvent) {
    let data_arr = websocketEvent.data.trim().split(",");
    if (data_arr[0] == "session_end" || data_arr[0] == "session_stop") {
      console.log("Done!");
      this.writer.close_writer();
    }
    else if (data_arr[0] == "session_start") {
      console.log("Start!");
      this.writer = new OutputFileWriter(data_arr[3], data_arr[1]);
    }
    else if (data_arr[0] == "gaze") {
      this.writer.write_gaze(data_arr[1], data_arr[2], data_arr[3]);
    }
    else {
      console.log("Unsupported message: " + websocketEvent.data);
    }
  }

  constructor() {
    this.ws = new WebSocket("ws://127.0.0.1:7007");
    this.ws.addEventListener("message", (evt) => this.coordsCallback(evt));
    this.stop = () => this.ws.close();
    this.ws.addEventListener("error", (event) => {
      console.log("WebSocket error: ", event);
      if (this.writer != null) this.writer.close_writer();
    });
    this.ws.addEventListener("close", (event) => {
      if (this.writer != null) this.writer.close_writer();
    });
  }
}

function testCoords() {
  const editorRegion = document.getElementById("workbench.parts.editor");
  editorRegion.addEventListener("mousemove", (evnt) => {
    let editor = CodePosServer.getEditorAttributes();
    let pos = CodePosServer.getFileRowCol(editor, evnt.x, evnt.y);
    if (pos !== undefined)
      console.log("<response"
                  + "x=\""
                  + evnt.x
                  + "\" y=\""
                  + evnt.y
                  + "\" gaze_target=\""
                  + editor.openFile.split("\\").at(-1)
                  + "\" gaze_target_type=\""
                  + editor.openFile.split(".").at(-1)
                  + "\" source_file_path=\""
                  + editor.openFile
                  + "\" source_file_line=\""
                  + pos.row.toString()
                  + "\" source_file_col=\""
                  + pos.col.toString()
                  + "\" editor_line_height=\""
                  + editor.lineHeight
                 );
  });
}

let scanner = new CodePosServer()
