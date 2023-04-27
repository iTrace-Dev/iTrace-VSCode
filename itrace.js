const fs = require("fs");

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
    let { editor, pos } = CodePosServer.getFileRowCol(x, y);
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
                    + " editor_line_base_x=\"" + editor.lineLeft + "\""
                    + " editor_line_base_y=\"" + editor.lineTop + "\""
                    + "/>\n"
                   );
  }
}

const noEditorOpen = {
  lineLeft: -1,
  lineTop: -1,
  lineHeight: -1,
  fontSize: -1,
  openFile: "",
};

class CodePosServer {
  static editorRegion = undefined;

  static getEditorAttributes(x, y) {
    if (CodePosServer.editorRegion === undefined) {
      CodePosServer.editorRegion = document.getElementById("workbench.parts.editor");
    }
    if (CodePosServer.editorRegion === null) {
      CodePosServer.editorRegion = undefined;
      return noEditorOpen;
    }

    const lineNumbers = CodePosServer.editorRegion.querySelector(".line-numbers");
    if (!lineNumbers)
      return noEditorOpen;
    const lineHeight = lineNumbers.getBoundingClientRect().height;

    const editor = CodePosServer.editorRegion.querySelector(".lines-content");
    const editorBox = editor.getBoundingClientRect();
    const editorLeft = editorBox.left;
    const editorTop = editorBox.top;

    let line = undefined;
    let lineLeft = -1;
    let lineTop = -1;
    const lines = Array.from(document.querySelectorAll(".view-line"));
    if (lines?.length > 0) {
      lines.filter((l) => {
        const rect = l.getBoundingClientRect();
        return y >= rect.top && y <= rect.bottom;
      }).forEach((l) => {
        const rowRect = l.firstChild.getBoundingClientRect();
        if (x >= rowRect.left && x <= rowRect.right) {
          line = l.firstChild;
          lineLeft = rowRect.left;
          lineTop = rowRect.top;
        }
      });
    }

    let charWidth = -1;
    let fontSize = -1;
    if (line) {
      const lineBox = line.getBoundingClientRect();
      charWidth = lineBox.width / line.innerText.length;
      fontSize = parseFloat(window.getComputedStyle(line, null).fontSize);
    }

    let openFileTemp = CodePosServer.editorRegion
      .querySelector(".monaco-editor")
      .getAttribute("data-uri").replace("file:///","").replace("%3A",":");
    const openFile = openFileTemp[0].toUpperCase() + openFileTemp.slice(1);

    // these could be cached and only updated when a MutationObserver fires
    return {
      editorLeft,
      editorTop,
      line,
      lineLeft,
      lineTop,
      charWidth,
      lineHeight,
      fontSize,
      openFile,
    };
  }

  static inWindow(selector, x, y) {
    const objects = Array.from(document.querySelectorAll(selector));
    if (objects?.some((o) => {
          const rect = o.getBoundingClientRect();
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        }))
      return true;
    return false;
  }

  static getFileRowCol(x, y) {
    x /= window.devicePixelRatio;
    y /= window.devicePixelRatio;

    const editor = CodePosServer.getEditorAttributes(x, y);

    const pos = {
      row: -1,
      col: -1,
    };

    if (editor.openFile.length == 0 || !CodePosServer.inWindow(".part.editor", x, y))
      return { editor, pos };

    if (CodePosServer.inWindow(
          ".monaco-hover, "
          + ".zone-widget, "
          + ".codelens-decoration, "
          + ".quick-input-widget, "
          + ".suggest-widget, "
          + ".suggest-details-container"
          , x, y))
      return { editor, pos };

    // zone widgets "push" the editor lines down below them, so if we are
    // mapping a coord below them, subtract how many lines each one pushed
    let widgetOffset = 0;
    Array.from(document.querySelectorAll(".zone-widget"))
      .filter((z) => y >= z.getBoundingClientRect().top)
      .forEach((z) => {
        widgetOffset += z.getBoundingClientRect().height;
      });
    Array.from(document.querySelectorAll(".codelens-decoration"))
      .filter((z) => y >= z.getBoundingClientRect().top)
      .forEach((z) => {
        widgetOffset += parseFloat(window.getComputedStyle(z, null).lineHeight);
      });

    pos.row = Math.floor((y - editor.editorTop - widgetOffset) / editor.lineHeight + 1);
    pos.col = Math.floor((x - editor.editorLeft) / editor.charWidth + 1);
    return { editor: editor, pos: CodePosServer.clamp(editor, pos) };
  }

  static clamp(editor, pos) {
    if (pos.col < 0 || pos.row < 0 || !editor.line) {
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
      this.writer.write_gaze(data_arr[1], parseInt(data_arr[2]), parseInt(data_arr[3]));
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
  document.getElementsByTagName("body")[0].addEventListener("mousemove", (evnt) => {
    let { editor, pos } = CodePosServer.getFileRowCol(evnt.x, evnt.y);
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
                + " editor_line_base_x=\"" + editor.lineLeft + "\""
                + " editor_line_base_y=\"" + editor.lineTop + "\""
                + "/>"
                );
  });
}

let scanner = new CodePosServer()
