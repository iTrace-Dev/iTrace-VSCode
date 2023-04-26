const fs = require('fs');

class OutputFileWriter {
  constructor(directory, session_id) {
    const filename = directory + "\\itrace_vscode-" + (new Date()).getTime().toString() + ".xml";
    console.log("iTrace: session started :: " + filename);
    this.file = fs.createWriteStream(filename);
    this.file.write("<?xml version=\"1.0\"?>\n");
    this.file.write("<itrace_plugin session_id=\"" + session_id + "\">\n");
    this.file.write("    <environment screen_width=\"" + window.screen.width.toString() + "\" screen_height=\"" + window.screen.height.toString() + "\" plugin_type=\"VSCODE\"/>\n");
    this.file.write("    <gazes>\n");
  }

  close_writer() {
    this.file.write("    </gazes>\n");
    this.file.write("</itrace_plugin>\n");
    this.file.end();
    console.log("iTrace: session finished");
  }

  write_gaze(event_id, x, y) {
    let editor = CodePosServer.getEditorAttributes();
    let pos = CodePosServer.getFileRowCol(editor, parseInt(x), parseInt(y));
    this.file.write("        <response"
                    + " event_id=\"" + event_id + "\""
                    + " plugin_time=\"" + (new Date()).getTime().toString() + "\""
                    + " x=\"" + x + "\""
                    + " y=\"" + y + "\""
                    + " gaze_target=\"" + editor.openFile.split(/[\\/]/).at(-1) + "\""
                    + " gaze_target_type=\"" + editor.openFile.split(".").at(-1) + "\""
                    + " source_file_path=\"" + editor.openFile + "\""
                    + " source_file_line=\"" + pos.row.toString() + "\""
                    + " source_file_col=\"" + pos.col.toString() + "\""
                    + " editor_line_height=\"" + editor.lineHeight + "\""
                    + " editor_font_height=\"" + editor.fontSize + "\""
                    + " editor_line_base_x=\"" + pos.lineLeft + "\""
                    + " editor_line_base_y=\"" + pos.lineTop + "\""
                    + "/>\n"
                   );
  }
}

class CodePosServer {
  static noEditorOpen = {
    openFile: "",
    fontSize: -1,
    lineHeight: -1,
  };

  static getEditorAttributes() {
    const editorRegion = document.getElementById("workbench.parts.editor");
    if (!editorRegion)
      return CodePosServer.noEditorOpen;
    const lineNumber = editorRegion.querySelector(".line-numbers");
    if (!lineNumber)
      return CodePosServer.noEditorOpen;
    const lineNumberBox = lineNumber.getBoundingClientRect();
    const editor = editorRegion.querySelector(".lines-content");
    const editorBox = editor.getBoundingClientRect();
    const line = editor.querySelector(".view-line").firstChild;
    const lineBox = line.getBoundingClientRect();
    const editorLeft = editorBox.left;
    const editorTop = editorBox.top;
    const lineHeight = lineNumberBox.height;
    const charWidth = lineBox.width / line.innerText.length;
    const fontSize = parseFloat(window.getComputedStyle(line, null).fontSize);
    let openFileTemp = editorRegion
      .querySelector(".monaco-editor")
      .getAttribute("data-uri").replace("file:///","").replace("%3A",":");
    const openFile = openFileTemp[0].toUpperCase() + openFileTemp.slice(1);
    // these could be cached and only updated when a MutationObserver fires
    return {
      editorLeft,
      charWidth,
      fontSize,
      lineHeight,
      editorTop,
      openFile,
    };
  }

  static isInBounds(obj, x, y) {
    const rect = obj.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }

  static inWindow(selector, x, y) {
    const objects = Array.from(document.querySelectorAll(selector));
    if (objects?.some((o) => CodePosServer.isInBounds(o, x, y)))
      return true;
    return false;
  }

  static getFileRowCol(editor, x, y) {
    x /= window.devicePixelRatio;
    y /= window.devicePixelRatio;

    let retValue = {
      row: -1,
      col: -1,
      lineLeft: -1,
      lineTop: -1,
      file: editor.openFile,
    };

    if (editor.openFile.length == 0 || !CodePosServer.inWindow('.part.editor', x, y))
      return retValue;

    if ([
          '.monaco-hover',
          '.zone-widget',
          '.quick-input-widget',
          '.suggest-widget',
          '.suggest-details-container',
        ].some((css) => CodePosServer.inWindow(css, x, y)))
      return retValue;

    // zone widgets 'push' the editor lines down below them, so if we are
    // mapping a coord below them, subtract how many lines each one pushed
    const zones = Array.from(document.querySelectorAll('.zone-widget'));
    let zoneRows = 0;
    if (zones?.length > 0)
      zones
        .filter((z) => y >= z.getBoundingClientRect().top)
        .forEach((z) => {
          zoneRows = rect[0].height / editor.lineHeight;
        });

    retValue.row = Math.floor((y - editor.editorTop) / editor.lineHeight - zoneRows + 1);
    retValue.col = Math.floor((x - editor.editorLeft) / editor.charWidth + 1);
    return CodePosServer.clamp(retValue, x, y);
  }

  static clamp(pos, x, y) {
    if (pos.col < 0 || pos.row < 0) {
      pos.row = -1;
      pos.col = -1;
      pos.lineLeft = -1;
      pos.lineTop = -1;
      return pos;
    }
    let onLine = false;
    let onCol = false;
    const lines = Array.from(document.querySelectorAll('.view-line'));
    if (lines?.length > 0) {
      lines.filter((l) => {
        const rect = l.getBoundingClientRect();
        return y >= rect.top && y <= rect.bottom;
      }).forEach((l) => {
        onLine = true;
        const rowRect = l.firstChild.getBoundingClientRect();
        if (x >= rowRect.left && x <= rowRect.right) {
          onCol = true;
          pos.lineLeft = rowRect.left;
          pos.lineTop = rowRect.top;
        }
      });
    }
    if (!onLine || !onCol) {
      pos.row = -1;
      pos.col = -1;
      pos.lineLeft = -1;
      pos.lineTop = -1;
    }
    return pos;
  }

  coordsCallback(websocketEvent) {
    let data_arr = websocketEvent.data.trim().split(",");
    if (data_arr[0] == "session_end" || data_arr[0] == "session_stop") {
      this.writer.close_writer();
    }
    else if (data_arr[0] == "session_start") {
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
      this.writer?.close_writer();
    });
    this.ws.addEventListener("close", (event) => {
      this.writer?.close_writer();
    });
  }
}

function testCoords() {
  const editorRegion = document.getElementsByTagName("body")[0];
  editorRegion.addEventListener("mousemove", (evnt) => {
    let editor = CodePosServer.getEditorAttributes();
    let pos = CodePosServer.getFileRowCol(editor, evnt.x, evnt.y);
    console.log("<response"
                + " x=\"" + evnt.x + "\""
                + " y=\"" + evnt.y + "\""
                + " gaze_target=\"" + editor.openFile.split(/[\\/]/).at(-1) + "\""
                + " gaze_target_type=\"" + editor.openFile.split(".").at(-1) + "\""
                + " source_file_path=\"" + editor.openFile + "\""
                + " source_file_line=\"" + pos.row.toString() + "\""
                + " source_file_col=\"" + pos.col.toString() + "\""
                + " editor_line_height=\"" + editor.lineHeight + "\""
                + " editor_font_height=\"" + editor.fontSize + "\""
                + " editor_line_base_x=\"" + pos.lineLeft + "\""
                + " editor_line_base_y=\"" + pos.lineTop + "\""
                + "/>"
                );
  });
}

let scanner = new CodePosServer()
